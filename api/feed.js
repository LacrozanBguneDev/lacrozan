import admin from "firebase-admin";

// --- KONFIGURASI KEAMANAN ---
// API Key yang harus dicocokkan dari request header
const REQUIRED_API_KEY = process.env.FEED_API_KEY; 

// Inisialisasi Firebase (Standard)
if (!admin.apps.length) {
  admin.initializeApp({
    // Pastikan ini diisi di environment variables saat deployment
    credential: admin.credential.cert(
      JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
    ),
  });
}

const db = admin.firestore();

// Path Postingan
const POSTS_PATH = "artifacts/default-app-id/public/data/posts";
// Path User Profile (Asumsi berdasarkan deskripsi kamu)
const USERS_PATH = "artifacts/default-app-id/public/data/userProfiles";

function safeMillis(ts) {
  return ts && ts.toMillis ? ts.toMillis() : 0;
}

// Helper untuk mengacak array (Fisher-Yates Shuffle)
function shuffleArray(array) {
  const shuffled = [...array]; 
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Helper untuk menghitung skor popularitas
function calculatePopularityScore(p) {
    const likes = Array.isArray(p.likes) ? p.likes.length : 0;
    const comments = p.commentsCount || 0;
    return likes * 2 + comments * 3;
}


export default async function handler(req, res) {
  // --- 0. VALIDASI API KEY (KEAMANAN) ---
  const apiKey = req.headers['x-api-key'] || req.query.apiKey; // Bisa dari header atau query param (disarankan header)
  
  // Jika API Key tidak disetel di environment atau tidak cocok dengan yang dikirim
  if (!REQUIRED_API_KEY || apiKey !== REQUIRED_API_KEY) {
      // Menggunakan 401 Unauthorized untuk akses yang salah
      return res.status(401).json({
          error: true,
          message: "Akses Ditolak. API Key tidak valid atau hilang."
      });
  }

  try {
    const mode = req.query.mode || "home";
    const requestedLimit = Math.min(Number(req.query.limit) || 10, 20);
    
    // ID User yang sedang login (untuk filtering Home)
    const viewerId = req.query.viewerId || null; 
    
    // ID User yang postingannya akan difilter (untuk mode="user")
    const filterUserId = req.query.userId || null; 
    const q = (req.query.q || "").toLowerCase();

    // --- 1. MEMBANGUN QUERY (HEMAT LIMIT) ---
    let query = db.collection(POSTS_PATH);

    // Kategori Meme / Filter User
    if (mode === "meme") {
      query = query.where("category", "==", "meme");
    } else if (mode === "user" && filterUserId) {
      query = query.where("userId", "==", filterUserId);
    } 
    
    // Order By (Untuk semua mode, kecuali search)
    if (mode !== "search") {
      query = query.orderBy("timestamp", "desc");
    }

    // --- 2. TENTUKAN BATAS AMBIL DATA (POOL SIZE) ---
    const poolMultiplier = (mode === "home" || mode === "popular") ? 5 : 3;
    const fetchLimit = mode === "search" ? 50 : requestedLimit * poolMultiplier;

    const snap = await query.limit(fetchLimit).get();

    if (snap.empty) {
      return res.json({ posts: [], nextCursor: null });
    }

    let posts = snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));

    // --- 3. FILTER SEARCH ---
    if (mode === "search" && q) {
      posts = posts.filter(
        (p) =>
          p.title?.toLowerCase().includes(q) ||
          p.content?.toLowerCase().includes(q)
      );
    }
    
    // --- 4. FETCH INTERAKSI PENGGUNA (HANYA UNTUK MODE HOME) ---
    let interactionPostIds = new Set();
    if (mode === "home" && viewerId) {
        // Hanya fetch 1 dokumen user, tetap hemat
        const viewerDoc = await db.doc(`${USERS_PATH}/${viewerId}`).get();
        if (viewerDoc.exists) {
            const data = viewerDoc.data();
            
            const likedPosts = data.likedPosts || {}; 
            const commentedPosts = data.commentedPosts || {}; 
            
            Object.keys(likedPosts).forEach(id => interactionPostIds.add(id));
            Object.keys(commentedPosts).forEach(id => interactionPostIds.add(id));
        }
    }


    // --- 5. JOIN USER PROFILES (Efisien) ---
    const userIds = [...new Set(posts.map((p) => p.userId).filter(Boolean))];

    if (userIds.length > 0) {
      // Parallel fetch user profiles
      const userSnaps = await Promise.all(
        userIds.map((uid) => db.doc(`${USERS_PATH}/${uid}`).get())
      );

      const userMap = {};
      userSnaps.forEach((doc) => {
        if (doc.exists) {
          userMap[doc.id] = doc.data();
        }
      });

      posts = posts.map((p) => {
        const userData = userMap[p.userId] || {};
        return {
          ...p,
          user: {
            photoURL: userData.photoURL || null, 
            username: userData.username || "Unknown", 
          },
        };
      });
    }

    // --- 6. FINAL SORTING & ALGORITMA DISCOVERY ---

    if (mode === "home") {
        let newPosts = [];
        let oldPosts = [];
        
        // 6a. PISAHKAN: Bagi postingan yang belum pernah diinteraksi dan yang sudah
        if (viewerId && interactionPostIds.size > 0) {
            posts.forEach(p => {
                if (interactionPostIds.has(p.id)) {
                    oldPosts.push(p); // Sudah diinteraksi
                } else {
                    newPosts.push(p); // Belum diinteraksi (PRIORITAS)
                }
            });
        } else {
            // Semua postingan dianggap "baru"
            newPosts = posts; 
        }

        // 6b. ACAK DAN GABUNGKAN (FALLBACK): 
        // Gabungkan: yang belum dilihat (shuffled) + yang sudah dilihat (shuffled)
        const shuffledNewPosts = shuffleArray(newPosts);
        const shuffledOldPosts = shuffleArray(oldPosts);

        posts = [...shuffledNewPosts, ...shuffledOldPosts];
            
    } else if (mode === "popular") {
        // 6c. MODE POPULAR: Hitung skor dan urutkan murni (TIDAK ACAK)
        posts = posts
            .map(p => ({ 
                ...p, 
                score: calculatePopularityScore(p) 
            }))
            .sort((a, b) => b.score - a.score);
            
    } 

    // Potong sesuai limit asli permintaan user (misal 10)
    const result = posts.slice(0, requestedLimit);

    res.json({
      posts: result,
      // Cursor untuk pagination
      nextCursor:
        result.length > 0
          ? safeMillis(result[result.length - 1].timestamp)
          : null,
    });

  } catch (e) {
    console.error("FEED ERROR:", e);
    res.status(500).json({
      error: true,
      message: e.message,
    });
  }
}