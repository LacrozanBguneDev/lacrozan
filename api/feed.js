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

/* ================== CACHE USER ================== */
const userCache = new Map();

const getUserProfile = async (userId) => {
  if (!userId) return { username: "Unknown", photoURL: null };
  if (userCache.has(userId)) return userCache.get(userId);

  const doc = await db.doc(`${USERS_PATH}/${userId}`).get();
  const data = doc.exists
    ? {
        username: doc.data().username || "Unknown",
        photoURL: doc.data().photoURL || null,
      }
    : { username: "Unknown", photoURL: null };

  userCache.set(userId, data);
  return data;
};

/* ================== UTIL ================== */
const safeMillis = (ts) => (ts?.toMillis ? ts.toMillis() : 0);

/* ================== WEIGHT ================== */
const postWeight = (p, seenIds) => {
  const ageHours = (Date.now() - p.timestamp) / 3600000;
  let weight = 1;

  if (!seenIds.has(p.id)) weight += 3;

  if (ageHours < 6) weight += 3;
  else if (ageHours < 24) weight += 2;
  else if (ageHours < 72) weight += 1;

  return weight;
};

const pickWeightedRandom = (items, limit) => {
  const pool = [...items];
  const result = [];

  while (pool.length && result.length < limit) {
    const total = pool.reduce((s, p) => s + p._weight, 0);
    let r = Math.random() * total;

    for (let i = 0; i < pool.length; i++) {
      r -= pool[i]._weight;
      if (r <= 0) {
        result.push(pool[i]);
        pool.splice(i, 1);
        break;
      }
    }
  }
  return result;
};

/* ================== HANDLER ================== */
export default async function handler(req, res) {
  const apiKey = String(
    req.headers["x-api-key"] || req.query.apiKey || ""
  ).trim();

  if (!REQUIRED_API_KEY || apiKey !== REQUIRED_API_KEY) {
    return res.status(401).json({ error: true, message: "API key invalid" });
  }

  try {
    const mode = req.query.mode || "home";
    const limit = Math.min(Number(req.query.limit) || 10, 20);
    const viewerId = req.query.viewerId || null;
    const userId = req.query.userId || null;
    const q = (req.query.q || "").toLowerCase();
    const nextCursor = Number(req.query.nextCursor) || null;

    /* ================== QUERY POSTS ================== */
    let query = db.collection(POSTS_PATH);

    if (mode === "meme") query = query.where("category", "==", "meme");
    if (mode === "user" && userId)
      query = query.where("userId", "==", userId);

    query = query.orderBy("timestamp", "desc");
    if (nextCursor) query = query.startAfter(nextCursor);

    const poolSize = limit * 8;
    const snap = await query.limit(poolSize).get();
    if (snap.empty) return res.json({ posts: [], nextCursor: null });

    let posts = snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
      timestamp: safeMillis(d.data().timestamp),
    }));

    /* ================== SEARCH ================== */
    if (mode === "search" && q) {
      posts = posts.filter(
        (p) =>
          p.title?.toLowerCase().includes(q) ||
          p.content?.toLowerCase().includes(q)
      );
    }

    /* ================== USER PROFILE ================== */
    const userIds = [...new Set(posts.map((p) => p.userId).filter(Boolean))];
    const profiles = await Promise.all(userIds.map(getUserProfile));
    const userMap = {};
    userIds.forEach((id, i) => (userMap[id] = profiles[i]));

    posts = posts.map((p) => ({
      ...p,
      user: userMap[p.userId] || {
        username: "Unknown",
        photoURL: null,
      },
    }));

    /* ================== HISTORY ================== */
    let seenIds = new Set();
    if (viewerId) {
      const viewerDoc = await db.doc(`${USERS_PATH}/${viewerId}`).get();
      if (viewerDoc.exists) {
        seenIds = new Set(viewerDoc.data().seenPosts || []);
      }
    }

    posts = posts.filter((p) => !seenIds.has(p.id));

    /* ================== ALGORITMA HOME ================== */
    if (mode === "home") {
      posts = posts.map((p) => ({
        ...p,
        _weight: postWeight(p, seenIds),
      }));

      posts = pickWeightedRandom(posts, limit);
    } else {
      posts = posts.slice(0, limit);
    }

    /* ================== UPDATE HISTORY ================== */
    if (viewerId && posts.length) {
      await db.doc(`${USERS_PATH}/${viewerId}`).set(
        {
          seenPosts: admin.firestore.FieldValue.arrayUnion(
            ...posts.map((p) => p.id)
          ),
        },
        { merge: true }
      );
    }

    /* ================== NEXT CURSOR ================== */
    const newCursor = posts.length
      ? posts[posts.length - 1].timestamp
      : null;

    res.json({ posts, nextCursor: newCursor });
  } catch (e) {
    console.error("FEED ERROR:", e);
    res.status(500).json({ error: true, message: e.message });
  }
}