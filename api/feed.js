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
    throw new Error("Failed to initialize Firebase Admin SDK.");
  }
}

const db = admin.firestore();
const POSTS_PATH = "artifacts/default-app-id/public/data/posts";
const USER_PROFILES_PATH = "userProfiles"; 

// --- HELPER FUNCTIONS ---

// Mengkonversi Timestamp ke milidetik yang aman untuk penggunaan kursor
function safeMillis(ts) {
  return ts instanceof admin.firestore.Timestamp ? ts.toMillis() : 0;
}

/**
 * ⛔ FUNGSI PENGAMBILAN FOTO PROFIL BOROS LIMIT ⛔
 * Fungsi ini digunakan sebagai fallback, tapi sangat dianjurkan 
 * untuk menyimpan userPhotoURL langsung di dokumen POST.
 */
async function fetchUserProfile(userId) {
    if (!userId) return null;
    try {
        const userRef = db.collection(USER_PROFILES_PATH).doc(userId); 
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
    
    // Ambil data lebih banyak dari Firestore untuk re-ranking dan diversity
    const initialFetchCount = Math.max(limit * 2, 30); 
    
    // Kursor: Gunakan nilai 'boostScore' dari postingan sebelumnya
    const startAfterValue = req.query.cursor ? Number(req.query.cursor) : null; 

    // 1. Definisikan Query Firestore (EFISIENSI MAKSIMAL)
    let query = db.collection(POSTS_PATH);
    
    // --- PENYESUAIAN QUERY BERDASARKAN ENDPOINT (MODE) ---

    if (mode === "meme") {
      // Endpoint Khusus Kategori Meme: Hanya ambil postingan kategori 'meme'
      query = query.where("category", "==", "meme");
      
    } else if (mode === "user" && userId) {
      // Endpoint Postingan Profile User: Hanya ambil postingan dari userId tertentu
      query = query.where("userId", "==", userId);
      
    } else if (mode === "search") {
      // Endpoint Search: Firestore tidak mendukung pencarian teks penuh yang kuat.
      // Kami mengembalikan postingan home (berdasarkan boostScore) sebagai fallback 
      // untuk menghemat limit, karena pencarian teks penuh harus menggunakan Algolia/Elasticsearch.
      // Jika Anda ingin filter di sini, Anda harus menggunakan where() pada field yang diindeks.
      // Contoh filter title: query = query.where("titleKeywords", "array-contains", q); 
    } 
    
    // Terapkan Sorting: Selalu berdasarkan boostScore untuk Aktualitas dan Randomness
    query = query.orderBy("boostScore", "desc");

    if (startAfterValue) {
        query = query.startAfter(startAfterValue); 
    }

    // Ambil sejumlah data dari Firestore (hanya yang diperlukan untuk diversity filter)
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

    // 2. Kalkulasi Final Score (Hanya di mode 'home' atau 'popular')
    if (mode === "home" || mode === "popular") {
        posts = posts.map(p => {
            // Gunakan engagementScore yang sudah dihitung oleh Cloud Functions
            const engagementScore = p.engagementScore || 
                                    ((Array.isArray(p.likes) ? p.likes.length : 0) * 2) + 
                                    (p.commentsCount || 0) * 3;
            
            const boostScore = p.boostScore || safeMillis(p.timestamp); 
            
            // Bobot: 70% BoostScore (Aktualitas/Random), 30% Popularitas
            const FINAL_SCORE_BOOST = 0.7; 
            const finalScore = (boostScore * FINAL_SCORE_BOOST) + (engagementScore * (1 - FINAL_SCORE_BOOST)); 
    
            return { 
                ...p, 
                finalScore: finalScore,
            };
        });
    
        // 3. Re-Ranking Awal (Berdasarkan Final Score)
        posts.sort((a, b) => b.finalScore - a.finalScore);
    }


    // 4. Keragaman (Diversity Filter - Mencegah Monoton pada mode 'home')
    const finalResult = [];
    if (mode === "home") {
        const recentCategories = [];
        const recentUserIds = [];
        const DIVERSITY_WINDOW = 3; 

        for (const post of posts) {
            if (finalResult.length >= limit) break;

            const isCategoryMonotonous = recentCategories.includes(post.category);
            const isUserMonotonous = recentUserIds.includes(post.userId);

            if (!isCategoryMonotonous && !isUserMonotonous) {
                finalResult.push(post);
                
                recentCategories.push(post.category);
                recentUserIds.push(post.userId);

                if (recentCategories.length > DIVERSITY_WINDOW) {
                    recentCategories.shift();
                    recentUserIds.shift();
                }
            }
        }
    } else {
        // Untuk mode 'meme' atau 'user', tidak perlu diversity filter, cukup ambil 'limit' teratas
        finalResult.push(...posts.slice(0, limit));
    }
    
    // --- AKHIR ALGORITMA ---

    // Tentukan nextCursor: Ambil boostScore/timestamp dari dokumen TERAKHIR yang dibaca dari Firestore
    const lastDoc = snap.docs[snap.docs.length - 1];
    let nextCursor = lastDoc ? lastDoc.data().boostScore || safeMillis(lastDoc.data().timestamp) : null;

    // 5. Ambil Data Profil User (Dioptimalkan jika userPhotoURL sudah ada di dokumen post)
    const postsWithProfiles = await Promise.all(
        finalResult.map(async post => {
            // Cek dulu apakah userPhotoURL sudah ada di dokumen post (Optimal)
            let userPhotoURL = post.userPhotoURL; 
            
            if (!userPhotoURL) {
                // FALLBACK: Ambil dari userProfiles (BOROS LIMIT)
                userPhotoURL = await fetchUserProfile(post.userId); 
            }
            return { ...post, userPhotoURL: userPhotoURL };
        })
    );
    

    // 6. Kirim Respons
    res.json({
      posts: postsWithProfiles,
      nextCursor: nextCursor,
    });

  } catch (e) {
    console.error("FEED ERROR:", e);
    // Penanganan error yang lebih baik untuk mencegah crash
    res.status(500).json({
      error: true,
      message: e.message,
    });
  }
}