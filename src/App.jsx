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

const limitPerUser = (posts, max = 2) => {
  const count = {};
  return posts.filter(p => {
    count[p.userId] = (count[p.userId] || 0) + 1;
    return count[p.userId] <= max;
  });
};

/* ================== SCORE (ASLI) ================== */
const discoveryScore = p => {
  const ageHours = (Date.now() - p.timestamp) / 3600000;
  const likes = Array.isArray(p.likes) ? p.likes.length : 0;
  const comments = p.commentsCount || 0;
  const freshness = Math.max(0, 48 - ageHours);
  const decay = ageHours > 72 ? -5 : 0;
  return likes * 2 + comments * 3 + freshness + decay;
};

const popularScore = p => {
  const ageHours = (Date.now() - p.timestamp) / 3600000;
  const likes = Array.isArray(p.likes) ? p.likes.length : 0;
  const comments = p.commentsCount || 0;
  return likes * 3 + comments * 4 - ageHours * 0.2;
};

/* ================== PROFILE CACHE ================== */
const profileCache = new Map();
const PROFILE_TTL = 5 * 60 * 1000;

const getUserProfile = async userId => {
  const cached = profileCache.get(userId);
  const now = Date.now();
  if (cached && cached.expires > now) return cached.data;

  const snap = await db.doc(`${USERS_PATH}/${userId}`).get();
  const data = snap.exists ? snap.data() : null;

  profileCache.set(userId, {
    data,
    expires: now + PROFILE_TTL,
  });

  return data;
};

/* ================== HANDLER ================== */
export default async function handler(req, res) {
  const apiKey = String(req.headers["x-api-key"] || req.query.apiKey || "").trim();
  if (!REQUIRED_API_KEY || apiKey !== REQUIRED_API_KEY) {
    return res.status(401).json({ error: true, message: "API key invalid" });
  }

  try {
    const mode = req.query.mode || "home";
    const limit = Math.min(Number(req.query.limit) || 5, 20); // FRONTEND LAMA AMAN
    const viewerId = req.query.viewerId || null;
    const userId = req.query.userId || null;
    const q = (req.query.q || "").toLowerCase();

    /* ================== QUERY ASLI ================== */
    let query = db.collection(POSTS_PATH);
    if (mode === "meme") query = query.where("category", "==", "meme");
    if (mode === "user" && userId) query = query.where("userId", "==", userId);
    if (mode !== "search") query = query.orderBy("timestamp", "desc");

    const snap = await query.limit(limit * 15).get();
    if (snap.empty) return res.json({ posts: [], nextCursor: null });

    let posts = snap.docs.map(d => ({
      id: d.id,
      ...d.data(),
      timestamp: safeMillis(d.data().timestamp),
    }));

    /* ================== SEARCH ================== */
    if (mode === "search" && q) {
      posts = posts.filter(p =>
        p.title?.toLowerCase().includes(q) ||
        p.content?.toLowerCase().includes(q)
      );
    }

    /* ================== SEEN POSTS (ANTI DUPLIKAT KERAS) ================== */
    let seenIds = new Set();
    if (viewerId) {
      const viewerDoc = await db.doc(`${USERS_PATH}/${viewerId}`).get();
      if (viewerDoc.exists) {
        seenIds = new Set(viewerDoc.data().seenPosts || []);
      }
    }

    posts = posts.filter(p => !seenIds.has(p.id));

    /* ================== MODE LOGIC (ASLI + AMAN) ================== */
    if (mode === "home") {
      posts = posts.map(p => ({ ...p, _score: discoveryScore(p) }))
                   .sort((a, b) => b._score - a._score);

      const now = Date.now();
      const FRESH_LIMIT = now - 48 * 3600000;

      let fresh = posts.filter(p => p.timestamp >= FRESH_LIMIT);
      let old   = posts.filter(p => p.timestamp < FRESH_LIMIT);

      fresh = shuffleArray(fresh);
      old   = shuffleArray(old);

      const freshTake = Math.ceil(limit * 0.7);
      const oldTake   = limit - freshTake;

      posts = [
        ...fresh.slice(0, freshTake),
        ...old.slice(0, oldTake),
      ];

      posts = shuffleArray(limitPerUser(posts));
    }

    if (mode === "popular") {
      posts = posts.map(p => ({ ...p, _score: popularScore(p) }))
                   .sort((a, b) => b._score - a._score)
                   .slice(0, limit);
    }

    posts = posts.slice(0, limit);

    /* ================== JOIN USER (CACHE) ================== */
    for (let p of posts) {
      if (!p.userId) {
        p.user = { username: "Unknown", photoURL: null };
        continue;
      }
      const profile = await getUserProfile(p.userId);
      p.user = {
        username: profile?.username || "Unknown",
        photoURL: profile?.photoURL || null,
      };
    }

    /* ================== UPDATE SEEN (ANTI DUPLIKAT FINAL) ================== */
    if (viewerId && posts.length) {
      await db.doc(`${USERS_PATH}/${viewerId}`).set({
        seenPosts: admin.firestore.FieldValue.arrayUnion(
          ...posts.map(p => p.id)
        )
      }, { merge: true });
    }

    res.json({
      posts,
      nextCursor: posts.length
        ? posts[posts.length - 1].timestamp
        : null,
    });

  } catch (e) {
    console.error("FEED ERROR:", e);
    res.status(500).json({ error: true, message: e.message });
  }
}