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
    // Error saat inisialisasi awal (misalnya, SERVICE_ACCOUNT salah)
    return { 
        status: 500, 
        json: { 
            error: true, 
            message: "Kesalahan Fatal: Gagal menginisialisasi Firebase Admin SDK. Periksa konfigurasi FIREBASE_SERVICE_ACCOUNT." 
        } 
    };
  }
}

const db = admin.firestore();
// Path koleksi postingan yang sudah dikonfirmasi
const POSTS_PATH = "artifacts/default-app-id/public/data/post"; 
const USER_PROFILES_PATH = "userProfiles"; 

// --- HELPER FUNCTIONS ---

function safeMillis(ts) {
  return ts instanceof admin.firestore.Timestamp ? ts.toMillis() : 0;
}

// Fallback pengambilan foto profil (Boros Limit!)
async function fetchUserProfile(userId) {
    if (!userId) return null;
    try {
        const userRef = db.collection(USER_PROFILES_PATH).doc(userId); 
        const userSnap = await userRef.get(); 
        if (userSnap.exists) {
            return userSnap.data().photoURL || null;
        }
    } catch (e) {
        // Abaikan error profile, lanjutkan saja
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
    
    const initialFetchCount = Math.max(limit * 2, 30); 
    const startAfterValue = req.query.cursor ? Number(req.query.cursor) : null; 

    // 1. Definisikan Query Firestore
    let query = db.collection(POSTS_PATH);
    
    // --- PENYESUAIAN QUERY BERDASARKAN MODE ---

    if (mode === "meme") {
      query = query.where("category", "==", "meme");
    } else if (mode === "user" && userId) {
      query = query.where("userId", "==", userId);
    } 
    
    // Terapkan Sorting: Selalu berdasarkan boostScore untuk Aktualitas dan Randomness
    // Catatan: Jika boostScore hilang, query ini akan gagal!
    query = query.orderBy("boostScore", "desc");

    if (startAfterValue) {
        query = query.startAfter(startAfterValue); 
    }

    query = query.limit(initialFetchCount);
    
    let snap;
    try {
        snap = await query.get();
    } catch (dbError) {
        // TANGANI ERROR INDEKS ATAU FIELD HILANG
        console.error("Firestore Query Error:", dbError);
        
        let customMessage = "Gagal mengambil data dari Firestore. ";
        
        if (dbError.message && dbError.message.includes("The query requires an index")) {
            customMessage += "⚠️ **MASALAH INDEKS KOMPOSIT** ⚠️ Query yang Anda minta (kombinasi filter dan sorting) memerlukan Indeks Komposit di Firestore. Silakan periksa log server untuk link pembuatan indeks atau buat Indeks Komposit untuk field: (category/userId, boostScore) pada koleksi: " + POSTS_PATH;
        } else if (dbError.message && dbError.message.includes("orderBy clause requires")) {
            customMessage += "⚠️ **MASALAH FIELD BOOSTSCORE** ⚠️ Query gagal karena field 'boostScore' mungkin hilang atau tidak valid di semua dokumen yang diakses. Pastikan semua dokumen di koleksi " + POSTS_PATH + " memiliki field 'boostScore' (Number).";
        } else {
            customMessage += "Terdapat kesalahan database yang tidak terduga. Detail: " + dbError.message;
        }

        return res.status(500).json({
            error: true,
            message: customMessage,
            errorCode: dbError.code || 'DB_QUERY_FAILED'
        });
    }
    
    if (snap.empty) {
      return res.json({ posts: [], nextCursor: null, message: "Tidak ada postingan yang ditemukan dengan kriteria ini." });
    }

    let posts = snap.docs.map(d => ({
        id: d.id,
        // Pastikan boostScore selalu ada, fallback ke timestamp jika null
        boostScore: d.data().boostScore || safeMillis(d.data().timestamp), 
        ...d.data(),
    }));

    // --- ALGORITMA RANKING DAN DIVERSITY (DI SISI BACKEND) ---
    
    // ... (Lanjutan logika ranking dan diversity filter, tidak diubah dari versi sebelumnya) ...
    // ... (Logika finalScore, sorting, dan diversity filter di sini) ...

    const finalResult = []; // Hasil akhir setelah diversity filter
    const postsToRank = [...posts]; // Clone array untuk ranking
    
    if (mode === "home" || mode === "popular") {
        postsToRank.map(p => {
            const engagementScore = p.engagementScore || ((Array.isArray(p.likes) ? p.likes.length : 0) * 2) + (p.commentsCount || 0) * 3;
            const boostScore = p.boostScore; 
            const FINAL_SCORE_BOOST = 0.7; 
            const finalScore = (boostScore * FINAL_SCORE_BOOST) + (engagementScore * (1 - FINAL_SCORE_BOOST)); 
            p.finalScore = finalScore;
            return p;
        }).sort((a, b) => b.finalScore - a.finalScore);


        // Diversity Filter
        const recentCategories = [];
        const recentUserIds = [];
        const DIVERSITY_WINDOW = 3; 

        for (const post of postsToRank) {
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
        // Untuk mode 'meme', 'user', atau 'search', cukup ambil 'limit' teratas (sesuai boostScore)
        finalResult.push(...postsToRank.slice(0, limit));
    }
    
    // --- AKHIR ALGORITMA ---

    // Tentukan nextCursor
    const lastDoc = snap.docs[snap.docs.length - 1];
    let nextCursor = lastDoc ? lastDoc.data().boostScore || safeMillis(lastDoc.data().timestamp) : null;

    // 5. Ambil Data Profil User (Dioptimalkan/Fallback)
    const postsWithProfiles = await Promise.all(
        finalResult.map(async post => {
            let userPhotoURL = post.userPhotoURL; 
            
            if (!userPhotoURL) {
                // Boros Limit: Fallback jika userPhotoURL tidak ada di dokumen post
                userPhotoURL = await fetchUserProfile(post.userId); 
            }
            return { ...post, userPhotoURL: userPhotoURL };
        })
    );
    

    // 6. Kirim Respons Sukses
    res.json({
      posts: postsWithProfiles,
      nextCursor: nextCursor,
      message: `Berhasil memuat ${postsWithProfiles.length} postingan untuk mode '${mode}'.`
    });

  } catch (e) {
    console.error("FEED ERROR FATAL:", e);
    // Error handler umum untuk masalah di luar query Firestore
    res.status(500).json({
      error: true,
      message: "Terjadi kesalahan server yang tidak terduga di tahap pemrosesan data (bukan database). Deskripsi: " + e.message,
      errorCode: 'GENERAL_ERROR'
    });
  }
}