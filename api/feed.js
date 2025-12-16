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
// Path disesuaikan dengan getPublicCollection di frontend
const POSTS_PATH = "artifacts/default-app-id/public/data/posts";
const USERS_PATH = "artifacts/default-app-id/public/data/userProfiles";

/* ================== UTIL ================== */
const safeMillis = ts => {
  if (ts?.toMillis) return ts.toMillis();
  if (ts instanceof Date) return ts.getTime();
  if (typeof ts === 'number') return ts;
  return 0;
};

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
  // Samakan pengambilan API Key dengan header x-api-key dari frontend
  const apiKey = String(req.headers["x-api-key"] || req.query.apiKey || "").trim();
  if (!REQUIRED_API_KEY || apiKey !== REQUIRED_API_KEY) {
    return res.status(401).json({ error: true, message: "API key invalid" });
  }

  try {
    const mode = req.query.mode || "home";
    const limitNum = Math.min(Number(req.query.limit) || 10, 50);
    const viewerId = req.query.viewerId || null;
    const userId = req.query.userId || null;
    const cursorId = req.query.cursor || null; // Frontend mengirimkan ID post sebagai cursor
    const q = (req.query.q || "").toLowerCase();

    /* ===== LOAD SEEN POSTS (Hanya untuk Home) ===== */
    let seenIds = new Set();
    if (viewerId && mode === "home") {
      const viewerSnap = await db.doc(`${USERS_PATH}/${viewerId}`).get();
      if (viewerSnap.exists) {
        seenIds = new Set(viewerSnap.data().seenPosts || []);
      }
    }

    /* ===== QUERY BUILDING ===== */
    let queryRef = db.collection(POSTS_PATH);

    // Filter berdasarkan Mode
    if (mode === "meme") queryRef = queryRef.where("category", "==", "meme");
    if (mode === "user" && userId) queryRef = queryRef.where("userId", "==", userId);

    // Sorting (Search tidak pakai orderBy Firestore karena kita filter manual di bawah)
    if (mode !== "search") {
      queryRef = queryRef.orderBy("timestamp", "desc");
    }

    // PAGINATION: Jika ada cursorId, cari dulu dokumennya untuk startAfter
    if (cursorId && mode !== "search") {
      const cursorDoc = await db.collection(POSTS_PATH).doc(cursorId).get();
      if (cursorDoc.exists) {
        queryRef = queryRef.startAfter(cursorDoc);
      }
    }

    // Ambil data (lebihkan limit untuk filtering internal)
    const snap = await queryRef.limit(limitNum * 5).get();
    
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

    /* ===== SEARCH FILTERING ===== */
    if (mode === "search" && q) {
      posts = posts.filter(p =>
        p.title?.toLowerCase().includes(q) ||
        p.content?.toLowerCase().includes(q)
      );
    }

    /* ===== ANTI DUPLIKAT (Hanya Mode Home) ===== */
    if (mode === "home") {
      posts = posts.filter(p => !seenIds.has(p.id));
    }

    /* ===== ALGORITMA SCORING ===== */
    if (mode === "home") {
      posts = posts.map(p => ({ ...p, _s: discoveryScore(p) }))
                   .sort((a,b)=>b._s-a._s);
      
      const fresh = posts.filter(p => (Date.now() - p.timestamp) < 86400000);
      const old = posts.filter(p => (Date.now() - p.timestamp) >= 86400000);
      
      posts = [...shuffle(fresh).slice(0, Math.ceil(limitNum * 0.7)), ...old];
    } else if (mode === "popular") {
      posts = posts.map(p => ({ ...p, _s: popularScore(p) }))
                   .sort((a,b)=>b._s-a._s);
    }

    // Batasi 2 post per user agar feed bervariasi (kecuali mode user)
    if (mode !== "user") {
      posts = limitPerUser(posts, 2);
    }

    posts = posts.slice(0, limitNum);

    /* ===== JOIN USER DATA (Dibutuhkan untuk Badge di Frontend) ===== */
    const uids = [...new Set(posts.map(p => p.userId))];
    if (uids.length) {
      const snaps = await Promise.all(
        uids.map(id => db.doc(`${USERS_PATH}/${id}`).get())
      );
      const userMap = {};
      snaps.forEach(s => s.exists && (userMap[s.id] = s.data()));
      
      posts = posts.map(p => ({
        ...p,
        user: {
          username: userMap[p.userId]?.username || "Unknown",
          photoURL: userMap[p.userId]?.photoURL || null,
          reputation: userMap[p.userId]?.reputation || 0, // Untuk getReputationBadge
          email: userMap[p.userId]?.email || null // Untuk deteksi isDev
        },
      }));
    }

    /* ===== UPDATE SEEN POSTS ===== */
    if (viewerId && posts.length && mode === "home") {
      await db.doc(`${USERS_PATH}/${viewerId}`).set({
        seenPosts: admin.firestore.FieldValue.arrayUnion(...posts.map(p => p.id))
      }, { merge: true });
    }

    /* ===== FINAL RESPONSE ===== */
    // nextCursor adalah ID post terakhir, ini yang dibaca oleh fetchFeedData
    const nextCursor = posts.length >= limitNum ? posts[posts.length - 1].id : null;

    res.json({ 
      posts, 
      nextCursor 
    });

  } catch (e) {
    console.error("FEED ERROR", e);
    res.status(500).json({ error: true, message: e.message });
  }
}