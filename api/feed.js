import admin from "firebase-admin";

/* ================== KONFIGURASI ================== */
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
const safeMillis = ts => ts && ts.toMillis ? ts.toMillis() : 0;

const shuffleArray = arr => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/* ================== SCORE ================== */
const discoveryScore = p => {
  const ageHours = (Date.now() - p.timestamp) / 3600000;
  const likes = Array.isArray(p.likes) ? p.likes.length : 0;
  const comments = p.commentsCount || 0;
  const freshness = Math.max(0, 48 - ageHours);
  const decay = ageHours > 72 ? -10 : 0;
  return likes * 2 + comments * 3 + freshness + decay;
};

const popularScore = p => {
  const ageHours = (Date.now() - p.timestamp) / 3600000;
  const likes = Array.isArray(p.likes) ? p.likes.length : 0;
  const comments = p.commentsCount || 0;
  return likes * 3 + comments * 4 - ageHours * 0.3;
};

const limitPerUser = (posts, max = 2) => {
  const map = {};
  return posts.filter(p => {
    map[p.userId] = (map[p.userId] || 0) + 1;
    return map[p.userId] <= max;
  });
};

/* ================== HANDLER ================== */
export default async function handler(req, res) {
  const apiKey = String(req.headers["x-api-key"] || req.query.apiKey || "").trim();
  if (!REQUIRED_API_KEY || apiKey !== REQUIRED_API_KEY) {
    return res.status(401).json({ error: true, message: "API key invalid" });
  }

  try {
    const mode = req.query.mode || "home";
    const limit = Math.min(Number(req.query.limit) || 5, 20);
    const viewerId = req.query.viewerId || null;
    const userId = req.query.userId || null;
    const q = (req.query.q || "").toLowerCase();
    const cursor = Number(req.query.cursor || 0);

    /* ====== LOAD HISTORY (ANTI DUPLIKAT GLOBAL) ====== */
    let seenIds = new Set();
    if (viewerId) {
      const viewerDoc = await db.doc(`${USERS_PATH}/${viewerId}`).get();
      if (viewerDoc.exists) {
        seenIds = new Set(viewerDoc.data().seenPosts || []);
      }
    }

    /* ====== QUERY ====== */
    let query = db.collection(POSTS_PATH);

    if (mode === "meme") query = query.where("category", "==", "meme");
    if (mode === "user" && userId) query = query.where("userId", "==", userId);
    if (mode !== "search") query = query.orderBy("timestamp", "desc");

    if (cursor) {
      query = query.startAfter(cursor);
    }

    const poolSize = limit * 20;
    const snap = await query.limit(poolSize).get();
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

    /* ====== SEARCH ====== */
    if (mode === "search" && q) {
      posts = posts.filter(p =>
        p.title?.toLowerCase().includes(q) ||
        p.content?.toLowerCase().includes(q)
      );
    }

    /* ====== FILTER DUPLIKAT USER ====== */
    posts = posts.filter(p => !seenIds.has(p.id));

    /* ====== ALGORITMA ====== */
    if (mode === "home") {
      posts = posts.map(p => ({ ...p, _score: discoveryScore(p) }));
      posts.sort((a, b) => b._score - a._score);

      const fresh = posts.filter(p => (Date.now() - p.timestamp) < 24 * 3600000);
      const old = posts.filter(p => !fresh.includes(p));

      const mixed = [
        ...shuffleArray(fresh).slice(0, Math.ceil(limit * 0.7)),
        ...shuffleArray(old).slice(0, limit),
      ];

      posts = limitPerUser(mixed, 2);
    }

    if (mode === "popular") {
      posts = posts
        .map(p => ({ ...p, _score: popularScore(p) }))
        .sort((a, b) => b._score - a._score);
    }

    /* ====== JOIN USER ====== */
    const userIds = [...new Set(posts.map(p => p.userId).filter(Boolean))];
    if (userIds.length) {
      const snaps = await Promise.all(
        userIds.map(uid => db.doc(`${USERS_PATH}/${uid}`).get())
      );
      const map = {};
      snaps.forEach(d => d.exists && (map[d.id] = d.data()));
      posts = posts.map(p => ({
        ...p,
        user: {
          username: map[p.userId]?.username || "Unknown",
          photoURL: map[p.userId]?.photoURL || null,
        },
      }));
    }

    const result = posts.slice(0, limit);

    /* ====== UPDATE HISTORY ====== */
    if (viewerId && result.length) {
      await db.doc(`${USERS_PATH}/${viewerId}`).set({
        seenPosts: Array.from(
          new Set([...seenIds, ...result.map(p => p.id)])
        )
      }, { merge: true });
    }

    res.json({
      posts: result,
      nextCursor: result.length ? result[result.length - 1].timestamp : null,
    });

  } catch (e) {
    console.error("FEED ERROR:", e);
    res.status(500).json({ error: true, message: e.message });
  }
}