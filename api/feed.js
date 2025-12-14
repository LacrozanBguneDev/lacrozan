import admin from "firebase-admin";

// Inisialisasi Firebase (Standard)
if (!admin.apps.length) {
  admin.initializeApp({
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
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

export default async function handler(req, res) {
  try {
    const mode = req.query.mode || "home";
    const requestedLimit = Math.min(Number(req.query.limit) || 10, 20);
    const userId = req.query.userId || null;
    const q = (req.query.q || "").toLowerCase();

    // --- 1. MEMBANGUN QUERY (HEMAT LIMIT) ---
    // Kita filter LANGSUNG di database, bukan di javascript.
    // Ini menghemat read operation.

    let query = db.collection(POSTS_PATH);

    // Kategori Meme / Filter User
    if (mode === "meme") {
      query = query.where("category", "==", "meme");
    } else if (mode === "user" && userId) {
      query = query.where("userId", "==", userId);
    }

    // Untuk search, Firestore terbatas. Kita terpaksa fetch agak banyak lalu filter manual.
    // Tapi untuk mode lain, kita sorting berdasarkan waktu dulu.
    if (mode !== "search") {
      query = query.orderBy("timestamp", "desc");
    }

    // --- 2. ALGORITMA "FRESH POOL" ---
    // Agar tidak monoton, kita ambil data LEBIH BANYAK dari limit yang diminta (multiplier 3x).
    // Contoh: User minta 10, kita ambil 30 teratas.
    // Nanti 30 itu kita acak, lalu ambil 10.
    // Efek: Tetap postingan baru (fresh), tapi urutannya acak (tidak membosankan).
    const fetchLimit = mode === "search" ? 50 : requestedLimit * 3;
    
    const snap = await query.limit(fetchLimit).get();

    if (snap.empty) {
      return res.json({ posts: [], nextCursor: null });
    }

    // Mapping awal data posts
    let posts = snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));

    // --- 3. FILTER SEARCH (Hanya jika mode search) ---
    if (mode === "search" && q) {
      posts = posts.filter(
        (p) =>
          p.title?.toLowerCase().includes(q) ||
          p.content?.toLowerCase().includes(q)
      );
    }

    // --- 4. JOIN USER PROFILES (Efisien) ---
    // Ambil semua userId unik dari postingan yang sudah didapat
    const userIds = [...new Set(posts.map((p) => p.userId).filter(Boolean))];

    if (userIds.length > 0) {
      // Fetch semua user sekaligus (Parallel) untuk hemat waktu
      const userSnaps = await Promise.all(
        userIds.map((uid) => db.doc(`${USERS_PATH}/${uid}`).get())
      );

      // Buat "Kamus" User: { userId: { photoURL: '...', name: '...' } }
      const userMap = {};
      userSnaps.forEach((doc) => {
        if (doc.exists) {
          userMap[doc.id] = doc.data();
        }
      });

      // Tempelkan data user ke postingan
      posts = posts.map((p) => {
        const userData = userMap[p.userId] || {};
        return {
          ...p,
          user: {
            photoURL: userData.photoURL || null, // Ambil foto
            username: userData.username || "Unknown", // Ambil nama jika ada
            // Tambahkan field user lain jika perlu
          },
        };
      });
    }

    // --- 5. FINAL SORTING & ALGORITMA ---

    if (mode === "home" || mode === "popular" || mode === "meme") {
      // Di sini logikanya: Kita punya kolam postingan baru (misal 30 biji).
      // Kita acak posisinya agar tidak monoton.
      // Jika ingin logic "score" (likes/comments) tetap ada tapi ada faktor acak:
      
      posts = posts.map(p => {
          const likes = Array.isArray(p.likes) ? p.likes.length : 0;
          const comments = p.commentsCount || 0;
          // Score dasar
          let score = likes * 2 + comments * 3;
          
          // FAKTOR ACAK: Tambahkan angka random besar agar urutan berubah-ubah
          // tapi postingan dengan like SANGAT banyak tetap punya peluang di atas.
          const randomBoost = Math.random() * 20; 
          
          return { ...p, finalScore: score + randomBoost };
      });

      // Sort berdasarkan score campuran tadi
      posts.sort((a, b) => b.finalScore - a.finalScore);
      
      // Opsi alternatif: Murni acak (Shuffle) dari kolam data terbaru
      // posts = shuffleArray(posts); 
    }

    // Potong sesuai limit asli permintaan user (misal 10)
    const result = posts.slice(0, requestedLimit);

    res.json({
      posts: result,
      // Cursor untuk pagination (ambil timestamp dari item terakhir)
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