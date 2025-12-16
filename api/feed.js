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
const safeMillis = ts => ts?.toMillis ? ts.toMillis() : (ts instanceof Date ? ts.getTime() : 0);

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
    const limitNum = Math.min(Number(req.query.limit) || 10, 50); // Sesuaikan default limit
    const viewerId = req.query.viewerId || null;
    const userId = req.query.userId || null;
    const cursor = req.query.cursor || null; // Ambil cursor dari frontend
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

    if (mode === "meme") queryRef = queryRef.where("category", "==", "meme");
    if (mode === "user" && userId) queryRef = queryRef.where("userId", "==", userId);
    
    // Penanganan Pagination (Cursor)
    if (mode !== "search") {
      queryRef = queryRef.orderBy("timestamp", "desc");
      if (cursor) {
        // Karena frontend mengirim cursor (timestamp/ID), kita gunakan startAfter
        const cursorDoc = await db.collection(POSTS_PATH).doc(cursor).get();
        if (cursorDoc.exists) {
            queryRef = queryRef.startAfter(cursorDoc);
        }
      }
    }

    // Ambil data lebih banyak sedikit untuk filtering (anti-duplikat/limit per user)
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

    /* ===== SEARCH ===== */
    if (mode === "search" && q) {
      posts = posts.filter(p =>
        p.title?.toLowerCase().includes(q) ||
        p.content?.toLowerCase().includes(q)
      );
    }

    /* ===== ANTI DUPLIKAT GLOBAL ===== */
    // Filter post yang sudah dilihat (dari seenIds)
    posts = posts.filter(p => !seenIds.has(p.id));

    /* ===== ALGORITMA ===== */
    if (mode === "home") {
      posts = posts.map(p => ({ ...p, _s: discoveryScore(p) }))
                   .sort((a,b)=>b._s-a._s);

      const fresh = posts.filter(p => Date.now() - p.timestamp < 86400000);
      const old = posts.filter(p => Date.now() - p.timestamp >= 86400000);

      posts = [
        ...shuffle(fresh).slice(0, Math.ceil(limitNum * 0.7)),
        ...shuffle(old).slice(0, limitNum),
      ];
    }

    if (mode === "popular") {
      posts = posts.map(p => ({ ...p, _s: popularScore(p) }))
                   .sort((a,b)=>b._s-a._s);
    }

    posts = limitPerUser(posts, 2);
    posts = posts.slice(0, limitNum);

    /* ===== JOIN USER ===== */
    const uids = [...new Set(posts.map(p => p.userId))];
    if (uids.length) {
      const snaps = await Promise.all(
        uids.map(id => db.doc(`${USERS_PATH}/${id}`).get())
      );
      const map = {};
      snaps.forEach(s => s.exists && (map[s.id] = s.data()));
      posts = posts.map(p => ({
        ...p,
        user: {
          username: map[p.userId]?.username || "Unknown",
          photoURL: map[p.userId]?.photoURL || null,
          email: map[p.userId]?.email || null,
          reputation: map[p.userId]?.reputation || 0, // Tambahan info user
          isDev: map[p.userId]?.email === "irhamdika00@gmail.com"
        },
      }));
    }

    /* ===== UPDATE SEEN ===== */
    if (viewerId && posts.length) {
      await db.doc(`${USERS_PATH}/${viewerId}`).set({
        seenPosts: [...new Set([...seenIds, ...posts.map(p=>p.id)])]
      }, { merge: true });
    }

    // Tentukan Next Cursor untuk Infinite Scroll
    // Kita gunakan ID dokumen terakhir sebagai cursor
    const nextCursor = posts.length > 0 ? posts[posts.length - 1].id : null;

    res.json({ 
      posts,
      nextCursor: nextCursor // Kirim balik ke frontend
    });

  } catch (e) {
    console.error("FEED ERROR", e);
    res.status(500).json({ error: true, message: e.message });
  }
}