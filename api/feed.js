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

/* ================== CACHE ================== */
// userId -> { data, expire }
const userCache = new Map();
const USER_TTL = 1000 * 60 * 10; // 10 menit

async function getUserCached(uid) {
  const now = Date.now();
  const cached = userCache.get(uid);
  if (cached && cached.expire > now) return cached.data;

  const snap = await db.doc(`${USERS_PATH}/${uid}`).get();
  if (!snap.exists) return null;

  const data = snap.data();
  userCache.set(uid, { data, expire: now + USER_TTL });
  return data;
}

/* ================== UTIL ================== */
function safeMillis(ts) {
  return ts && ts.toMillis ? ts.toMillis() : 0;
}

function shuffleSmall(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0 && i > a.length - 3; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ================== SCORE ================== */
function discoveryScore(p) {
  const ageH = (Date.now() - p.timestamp) / 3600000;
  const likes = Array.isArray(p.likes) ? p.likes.length : 0;
  const comments = p.commentsCount || 0;

  const fresh = Math.max(0, 36 - ageH);   // boost 36 jam
  const decay = ageH > 72 ? -3 : 0;        // turun pelan

  return likes * 2 + comments * 3 + fresh + decay;
}

function popularScore(p) {
  const ageH = (Date.now() - p.timestamp) / 3600000;
  const likes = Array.isArray(p.likes) ? p.likes.length : 0;
  const comments = p.commentsCount || 0;

  return likes * 3 + comments * 4 - ageH * 0.15;
}

function limitPerUser(posts, max = 2) {
  const map = {};
  return posts.filter(p => {
    map[p.userId] = (map[p.userId] || 0) + 1;
    return map[p.userId] <= max;
  });
}

/* ================== HANDLER ================== */
export default async function handler(req, res) {
  const apiKey = String(req.headers["x-api-key"] || req.query.apiKey || "").trim();
  if (!REQUIRED_API_KEY || apiKey !== REQUIRED_API_KEY) {
    return res.status(401).json({ error: true, message: "API key invalid" });
  }

  try {
    const mode = req.query.mode || "home";
    const limit = Math.min(Number(req.query.limit) || 10, 20);
    const cursor = Number(req.query.cursor) || null;
    const userId = req.query.userId || null;
    const q = (req.query.q || "").toLowerCase();

    let query = db.collection(POSTS_PATH);

    if (mode === "meme") query = query.where("category", "==", "meme");
    if (mode === "user" && userId) query = query.where("userId", "==", userId);
    if (mode !== "search") query = query.orderBy("timestamp", "desc");
    if (cursor) query = query.startAfter(admin.firestore.Timestamp.fromMillis(cursor));

    const pool = mode === "home" ? limit * 3 : limit * 2; // HEMAT
    const snap = await query.limit(pool).get();

    if (snap.empty) {
      return res.json({ posts: [], nextCursor: null });
    }

    let posts = snap.docs.map(d => ({
      id: d.id,
      ...d.data(),
      timestamp: safeMillis(d.data().timestamp),
    }));

    /* SEARCH */
    if (mode === "search" && q) {
      posts = posts.filter(p =>
        p.title?.toLowerCase().includes(q) ||
        p.content?.toLowerCase().includes(q)
      );
    }

    /* USER JOIN (CACHED) */
    for (const p of posts) {
      if (!p.userId) continue;
      const u = await getUserCached(p.userId);
      p.user = {
        username: u?.username || "Unknown",
        photoURL: u?.photoURL || null,
      };
    }

    /* ALGORITMA */
    if (mode === "home") {
      posts = posts
        .map(p => ({ ...p, _s: discoveryScore(p) }))
        .sort((a, b) => b._s - a._s);

      posts = limitPerUser([
        ...shuffleSmall(posts.slice(0, 4)),
        ...posts.slice(4),
      ]);
    }

    if (mode === "popular") {
      posts = posts
        .map(p => ({ ...p, _s: popularScore(p) }))
        .sort((a, b) => b._s - a._s);
    }

    const result = posts.slice(0, limit);

    res.json({
      posts: result,
      nextCursor: result.length
        ? result[result.length - 1].timestamp
        : null,
    });

  } catch (e) {
    console.error("FEED ERROR:", e);
    res.status(500).json({ error: true, message: e.message });
  }
}