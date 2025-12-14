import admin from "firebase-admin";

// --- KONFIGURASI DAN INISIALISASI ---

if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert(
        JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
      ),
    });
  } catch (error) {
    console.error("Firebase initialization failed:", error);
    // Hentikan proses jika gagal inisialisasi
    throw new Error("Failed to initialize Firebase Admin SDK.");
  }
}

const db = admin.firestore();
const POSTS_PATH = "artifacts/default-app-id/public/data/posts";
const USER_PROFILES_PATH = "userProfiles"; // Asumsi path user profile

// --- HELPER FUNCTIONS ---

// Mengkonversi Timestamp ke milidetik yang aman untuk penggunaan kursor
function safeMillis(ts) {
  return ts instanceof admin.firestore.Timestamp ? ts.toMillis() : 0;
}

/**
 * MENGAMBIL FOTO PROFIL
 * ⚠️ PERINGATAN KERAS: Fungsi ini akan memicu 1 READ PER POST.
 * Jika Anda mengizinkan 20 postingan, Anda memicu 20 reads.
 * SOLUSI: Simpan photoURL di dalam dokumen POST saat dibuat/diupdate.
 */
async function fetchUserProfile(userId) {
    if (!userId) return null;
    try {
        const userRef = db.collection(USER_PROFILES_PATH).doc(userId); 
        // Menggunakan get() memicu 1 read per user
        const userSnap = await userRef.get(); 
        if (userSnap.exists) {
            return userSnap.data().photoURL || null;
        }
    } catch (e) {
        console.error(`Error fetching profile for ${userId}:`, e.message);
    }
    return null;
}

// --- MAIN HANDLER ---

export default async function handler(req, res) {
  try {
    const mode = req.query.mode || "home";
    const limit = Math.min(Number(req.query.limit) || 10, 20);
    const userId = req.query.userId || null;
    
    // Ambil data lebih banyak dari Firestore untuk di-ranking ulang (Diversity/Keragaman)
    // Ini meningkatkan biaya read sedikit, tapi meningkatkan kualitas feed.
    const initialFetchCount = Math.max(limit * 2, 30); 
    
    // Kursor untuk Pagination (menggunakan nilai 'boostScore' dari postingan sebelumnya)
    const startAfterValue = req.query.cursor ? Number(req.query.cursor) : null; 

    // 1. Definisikan Query Firestore (Hemat Limit)
    let query = db.collection(POSTS_PATH);
    
    // Terapkan Filter di Firestore (Memastikan kategori 'meme' muncul)
    if (mode === "meme") {
      query = query.where("category", "==", "meme");
    } else if (mode === "user" && userId) {
      query = query.where("userId", "==", userId);
    } 

    // Terapkan Sorting Acak/Prioritas (Algoritma Cepat)
    // ASUMSI: Postingan memiliki field 'boostScore' (timestamp + randomness)
    query = query.orderBy("boostScore", "desc");

    if (startAfterValue) {
        query = query.startAfter(startAfterValue); 
    }

    // Ambil data dari Firestore
    query = query.limit(initialFetchCount);
    
    let snap = await query.get();
    
    if (snap.empty) {
      return res.json({ posts: [], nextCursor: null });
    }

    let posts = snap.docs.map(d => ({
        id: d.id,
        ...d.data(),
    }));

    // --- ALGORITMA RANKING DAN DIVERSITY (DI SISI BACKEND) ---

    // 2. Kalkulasi Final Score (Menggabungkan Aktualitas dan Popularitas)
    posts = posts.map(p => {
        // Fallback untuk Popularitas: (likes * 2) + (comments * 3)
        const engagementScore = p.engagementScore || 
                                ((Array.isArray(p.likes) ? p.likes.length : 0) * 2) + 
                                (p.commentsCount || 0) * 3;
        
        const boostScore = p.boostScore || safeMillis(p.timestamp); 
        
        // Bobot: 70% BoostScore (Recency/Random), 30% Popularitas
        const FINAL_SCORE_BOOST = 0.7; 
        const finalScore = (boostScore * FINAL_SCORE_BOOST) + (engagementScore * (1 - FINAL_SCORE_BOOST)); 

        return { 
            ...p, 
            finalScore: finalScore,
        };
    });

    // 3. Re-Ranking Awal (Berdasarkan Final Score)
    posts.sort((a, b) => b.finalScore - a.finalScore);

    // 4. Keragaman (Diversity Filter - Mencegah Monoton)
    const finalResult = [];
    const recentCategories = [];
    const recentUserIds = [];
    const DIVERSITY_WINDOW = 3; // Hanya izinkan 1 post per kategori/user dalam 3 post terakhir

    for (const post of posts) {
        if (finalResult.length >= limit) break;

        const isCategoryMonotonous = recentCategories.includes(post.category);
        const isUserMonotonous = recentUserIds.includes(post.userId);

        // Jika postingan ini TIDAK membuat feed monoton
        if (!isCategoryMonotonous && !isUserMonotonous) {
            finalResult.push(post);
            
            // Tambahkan ke window diversity
            recentCategories.push(post.category);
            recentUserIds.push(post.userId);

            // Jaga agar window hanya berukuran DIVERSITY_WINDOW
            if (recentCategories.length > DIVERSITY_WINDOW) {
                recentCategories.shift();
                recentUserIds.shift();
            }
        }
    }
    
    // --- AKHIR ALGORITMA RANKING DAN DIVERSITY ---

    // Tentukan nextCursor: Ambil boostScore dari item TERAKHIR dari snap.docs 
    // agar kursor konsisten untuk permintaan berikutnya.
    const lastDoc = snap.docs[snap.docs.length - 1];
    let nextCursor = lastDoc ? lastDoc.data().boostScore || safeMillis(lastDoc.data().timestamp) : null;

    // 5. Ambil Data Profil User (Langkah Boros - HARUS DIOPTIMALKAN!)
    const postsWithProfiles = await Promise.all(
        finalResult.map(async post => {
            // Ini memicu banyak read!
            const userPhotoURL = await fetchUserProfile(post.userId); 
            return { ...post, userPhotoURL: userPhotoURL };
        })
    );
    

    // 6. Kirim Respons
    res.json({
      posts: postsWithProfiles,
      // nextCursor akan menjadi 'boostScore' terakhir yang akan digunakan 
      // di permintaan berikutnya sebagai 'startAfterValue'
      nextCursor: nextCursor,
    });

  } catch (e) {
    console.error("FEED ERROR:", e);
    res.status(500).json({
      error: true,
      message: e.message,
    });
  }
}