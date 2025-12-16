import admin from "firebase-admin";

/* ================== KONFIG ================== */
const REQUIRED_API_KEY = process.env.FEED_API_KEY?.trim() || null;

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(
      JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
    ),
  });
}

const db = admin.firestore();
const POSTS_PATH = "artifacts/default-app-id/public/data/posts";
const USERS_PATH = "artifacts/default-app-id/public/data/userProfiles";

/* ================== UTIL ================== */
const safeMillis = ts => ts?.toMillis ? ts.toMillis() : 0;

const shuffle = arr => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// Fungsi ini HANYA boleh digunakan untuk Discovery/Home Feed agar tidak didominasi 1 user.
const limitPerUser = (posts, max = 2) => {
  const map = {};
  return posts.filter(p => {
    map[p.userId] = (map[p.userId] || 0) + 1;
    return map[p.userId] <= max;
  });
};

/* ================== SCORE ================== */
const discoveryScore = p => {
  const ageH = (Date.now() - p.timestamp) / 3600000;
  const likes = p.likes?.length || 0;
  const comments = p.commentsCount || 0;
  const fresh = Math.max(0, 48 - ageH);
  return likes * 2 + comments * 3 + fresh - ageH * 0.3;
};

const popularScore = p => {
  const ageH = (Date.now() - p.timestamp) / 3600000;
  return (p.likes?.length || 0) * 3 +
         (p.commentsCount || 0) * 4 -
         ageH * 0.4;
};

/* ================== HANDLER ================== */
export default async function handler(req, res) {
  const apiKey = String(req.headers["x-api-key"] || req.query.apiKey || "").trim();
  if (!REQUIRED_API_KEY || apiKey !== REQUIRED_API_KEY) {
    return res.status(401).json({ error: true, message: "API key invalid" });
  }

  try {
    const mode = req.query.mode || "home";
    const limitNum = Math.min(Number(req.query.limit) || 10, 20); // Menggunakan limitNum
    const viewerId = req.query.viewerId || null;
    const userId = req.query.userId || null;
    const q = (req.query.q || "").toLowerCase();
    
    // Menerima 'cursor' dari Front End.
    const cursor = req.query.cursor ? Number(req.query.cursor) : null; 
    let nextCursor = null; 
    
    // Ambil dokumen lebih banyak (misalnya 3x limit) untuk pemfilteran/algoritma.
    // Ini penting karena filter (seperti seenIds atau search) terjadi SETELAH query.
    const firestoreLimit = limitNum * 3 + 5; 

    /* ===== LOAD SEEN POSTS (Hanya untuk mode home/discovery) ===== */
    let seenIds = new Set();
    if (viewerId && (mode === "home" || mode === "popular" || mode === "meme")) {
      const viewerSnap = await db.doc(`${USERS_PATH}/${viewerId}`).get();
      if (viewerSnap.exists) {
        seenIds = new Set(viewerSnap.data().seenPosts || []);
      }
    }

    /* ===== QUERY FIREBASE DENGAN CURSOR & WHERE ===== */
    let firestoreQuery = db.collection(POSTS_PATH);

    // 1. Tambahkan filter (WHERE clause)
    if (mode === "meme") firestoreQuery = firestoreQuery.where("category", "==", "meme");
    if (mode === "user" && userId) firestoreQuery = firestoreQuery.where("userId", "==", userId);
    
    // 2. Tambahkan pengurutan (ORDER BY) dan Pagination (START AFTER)
    // Semua mode (kecuali search, yang tidak di-paginate) diurutkan berdasarkan timestamp.
    if (mode !== "search") {
        firestoreQuery = firestoreQuery.orderBy("timestamp", "desc");
        
        // Menggunakan timestamp sebagai cursor untuk startAfter.
        if (cursor) {
            // Jika cursor ada, kita mulai setelah postingan dengan timestamp tersebut.
            firestoreQuery = firestoreQuery.startAfter(admin.firestore.Timestamp.fromMillis(cursor));
        }
    }
    
    // Terapkan Limit Fetch dari Firestore
    const snap = await firestoreQuery.limit(firestoreLimit).get();
    if (snap.empty) {
        return res.json({ posts: [], nextCursor: null });
    }

    let posts = snap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        ...data,
        timestamp: safeMillis(data.timestamp),
      };
    });

    /* ===== SEARCH (Hanya Filter di Memory, tidak ada pagination) ===== */
    if (mode === "search" && q) {
      posts = posts.filter(p =>
        p.title?.toLowerCase().includes(q) ||
        p.content?.toLowerCase().includes(q)
      );
    }

    /* ===== ANTI DUPLIKAT GLOBAL (seenIds) ===== */
    // Hanya terapkan filter seenIds untuk feed utama (discovery/popular/meme), 
    // JANGAN TERAPKAN untuk mode 'user' atau 'search'.
    if (mode === "home" || mode === "popular" || mode === "meme") {
      posts = posts.filter(p => !seenIds.has(p.id));
    }
    
    let processedPosts = [...posts];

    /* ===== ALGORITMA & SCORING ===== */
    if (mode === "home") {
        // Algoritma Home Feed (Discovery)
      processedPosts = processedPosts.map(p => ({ ...p, _s: discoveryScore(p) }))
                   .sort((a,b)=>b._s-a._s);

      const fresh = processedPosts.filter(p => Date.now() - p.timestamp < 86400000);
      const old = processedPosts.filter(p => Date.now() - p.timestamp >= 86400000);

      processedPosts = [
        ...shuffle(fresh).slice(0, Math.ceil(limitNum * 0.7)),
        ...shuffle(old).slice(0, limitNum * 2),
      ].sort((a,b)=>b._s-a._s); // Sortir lagi setelah shuffling
        
        // Terapkan limitPerUser HANYA untuk mode home/discovery
      processedPosts = limitPerUser(processedPosts, 2); 

    } else if (mode === "popular") {
        // Algoritma Popular
      processedPosts = processedPosts.map(p => ({ ...p, _s: popularScore(p) }))
                   .sort((a,b)=>b._s-a._s);
        
        // Tidak ada limitPerUser untuk Popular.

    } else if (mode === "meme" || mode === "user" || mode === "search") {
        // Mode kronologis/sederhana (User Profile, Meme Category, Search)
        // Sudah diurutkan berdasarkan timestamp di query, atau berdasarkan relevansi di search.
        // Tidak ada scoring tambahan, limitPerUser, atau shuffle.
        // Kita hanya perlu memastikan mereka terurut dengan baik (search sudah terfilter, user/meme sudah by time).
        // Biarkan processedPosts = posts jika tidak ada scoring/shuffling.
        processedPosts = processedPosts.sort((a, b) => b.timestamp - a.timestamp); // Pastikan order by time
    }

    // --- LOGIKA PAGINATION ---
    let finalPosts = processedPosts.slice(0, limitNum + 1); // Ambil 1 lebih untuk menentukan cursor

    // Menghitung nextCursor
    if (finalPosts.length > limitNum) {
        // Jika kita punya lebih dari limitNum, postingan ke-limitNum adalah penanda cursor.
        nextCursor = finalPosts[limitNum - 1].timestamp;
    } else if (snap.size === firestoreLimit) {
         // Jika jumlah post yang didapat dari Firestore sama dengan limit fetch (dan posts.length <= limitNum),
         // berarti mungkin masih ada data di Firestore.
         // Kita pakai timestamp terakhir dari hasil sebagai penanda (walaupun risikonya lebih tinggi).
         // OPSI AMAN: Hanya set nextCursor jika finalPosts.length > limitNum.
         nextCursor = finalPosts[finalPosts.length - 1]?.timestamp || null;
    } else {
        nextCursor = null; // Sudah habis
    }
    
    // Potong posts sesuai limitNum yang diminta Front End
    finalPosts = finalPosts.slice(0, limitNum); 

    /* ===== JOIN USER (Tidak berubah) ===== */
    const uids = [...new Set(finalPosts.map(p => p.userId))];
    if (uids.length) {
      const snaps = await Promise.all(
        uids.map(id => db.doc(`${USERS_PATH}/${id}`).get())
      );
      const map = {};
      snaps.forEach(s => s.exists && (map[s.id] = s.data()));
      finalPosts = finalPosts.map(p => ({
        ...p,
        user: {
          username: map[p.userId]?.username || "Unknown",
          photoURL: map[p.userId]?.photoURL || null,
          email: map[p.userId]?.email || null,
        },
      }));
    }

    /* ===== UPDATE SEEN (Hanya untuk mode feed utama) ===== */
    if (viewerId && finalPosts.length && (mode === "home" || mode === "popular" || mode === "meme")) {
      await db.doc(`${USERS_PATH}/${viewerId}`).set({
        seenPosts: [...new Set([...seenIds, ...finalPosts.map(p=>p.id)])]
      }, { merge: true });
    }

    // Mengembalikan posts DAN nextCursor
    res.json({ posts: finalPosts, nextCursor });

  } catch (e) {
    console.error("FEED ERROR", e);
    res.status(500).json({ error: true, message: e.message });
  }
}