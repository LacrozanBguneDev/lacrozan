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
const safeMillis = ts => ts?.toMillis ? ts.toMillis() : (ts instanceof Date ? ts.getTime() : (typeof ts === 'number' ? ts : 0));

const shuffle = arr => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

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
    const limitNum = Math.min(Number(req.query.limit) || 10, 50);
    const viewerId = req.query.viewerId || null;
    const userId = req.query.userId || null;
    const cursor = req.query.cursor || null;
    const q = (req.query.q || "").toLowerCase();

    /* ===== LOAD SEEN POSTS ===== */
    let seenIds = new Set();
    if (viewerId) {
      const viewerSnap = await db.doc(`${USERS_PATH}/${viewerId}`).get();
      if (viewerSnap.exists) {
        seenIds = new Set(viewerSnap.data().seenPosts || []);
      }
    }

    /* ===== QUERY ===== */
    let queryRef = db.collection(POSTS_PATH);

    // FIX: Penanganan Filter & OrderBy agar tidak error Index
    if (mode === "meme") {
      queryRef = queryRef.where("category", "==", "meme");
    }
    
    if (mode === "user" && userId) {
      queryRef = queryRef.where("userId", "==", userId);
    }

    // Selalu urutkan berdasarkan waktu terbaru kecuali saat search
    if (mode !== "search") {
      queryRef = queryRef.orderBy("timestamp", "desc");
    }

    // FIX: Cursor Logic untuk Infinite Scroll
    if (cursor && mode !== "search") {
      const cursorDoc = await db.collection(POSTS_PATH).doc(cursor).get();
      if (cursorDoc.exists) {
        queryRef = queryRef.startAfter(cursorDoc);
      }
    }

    // Ambil data lebih banyak untuk diproses algoritma scoring/filtering
    const snap = await queryRef.limit(limitNum * 5).get();
    
    if (snap.empty) return res.json({ posts: [], nextCursor: null });

    let posts = snap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        ...data,
        timestamp: safeMillis(data.timestamp),
      };
    });

    /* ===== SEARCH (In-Memory Filter) ===== */
    if (mode === "search" && q) {
      posts = posts.filter(p =>
        p.title?.toLowerCase().includes(q) ||
        p.content?.toLowerCase().includes(q)
      );
    }

    /* ===== ANTI DUPLIKAT GLOBAL ===== */
    // Hanya filter 'seen' jika bukan mode 'user' agar profile tetap lengkap
    if (mode !== "user") {
        posts = posts.filter(p => !seenIds.has(p.id));
    }

    /* ===== ALGORITMA SCORING ===== */
    if (mode === "home") {
      // Home menggunakan campuran Discovery Score dan Shuffle
      posts = posts.map(p => ({ ...p, _s: discoveryScore(p) }))
                   .sort((a,b)=>b._s-a._s);

      const fresh = posts.filter(p => Date.now() - p.timestamp < 86400000); // 24 jam terakhir
      const old = posts.filter(p => Date.now() - p.timestamp >= 86400000);

      posts = [
        ...shuffle(fresh).slice(0, Math.ceil(limitNum * 0.7)),
        ...old
      ];
    } else if (mode === "popular") {
      // Popular fokus pada interaksi tertinggi
      posts = posts.map(p => ({ ...p, _s: popularScore(p) }))
                   .sort((a,b)=>b._s-a._s);
    }

    // Batasi post per user agar feed bervariasi (kecuali di halaman profile user itu sendiri)
    if (mode !== "user") {
        posts = limitPerUser(posts, 2);
    }
    
    posts = posts.slice(0, limitNum);

    /* ===== JOIN USER DATA ===== */
    const uids = [...new Set(posts.map(p => p.userId))];
    if (uids.length) {
      const snaps = await Promise.all(
        uids.map(id => db.doc(`${USERS_PATH}/${id}`).get())
      );
      const map = {};
      snaps.forEach(s => {
        if (s.exists) {
          map[s.id] = s.data();
        }
      });
      
      posts = posts.map(p => ({
        ...p,
        user: {
          username: map[p.userId]?.username || "User",
          photoURL: map[p.userId]?.photoURL || null,
          reputation: map[p.userId]?.reputation || 0,
          isDev: map[p.userId]?.email === "irhamdika00@gmail.com"
        },
      }));
    }

    /* ===== UPDATE SEEN POSTS ===== */
    if (viewerId && posts.length && mode === "home") {
      await db.doc(`${USERS_PATH}/${viewerId}`).set({
        seenPosts: admin.firestore.FieldValue.arrayUnion(...posts.map(p => p.id))
      }, { merge: true });
    }

    // Tentukan Cursor Berikutnya
    const nextCursor = posts.length > 0 ? posts[posts.length - 1].id : null;

    res.json({ 
      posts,
      nextCursor 
    });

  } catch (e) {
    console.error("FEED ERROR", e);
    res.status(500).json({ error: true, message: e.message });
  }
}