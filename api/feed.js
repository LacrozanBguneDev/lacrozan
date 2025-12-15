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
function safeMillis(ts) {
  return ts && ts.toMillis ? ts.toMillis() : 0;
}

function shuffleSmall(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0 && i > a.length - 4; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ================== SCORE ================== */

// Discovery score (home)
function discoveryScore(p) {
  const now = Date.now();
  const ageHours = (now - p.timestamp) / 3600000;

  const likes = Array.isArray(p.likes) ? p.likes.length : 0;
  const comments = p.commentsCount || 0;

  const freshness = Math.max(0, 48 - ageHours); // boost 2 hari
  const decay = ageHours > 72 ? -5 : 0;         // penalti pelan

  return likes * 2 + comments * 3 + freshness + decay;
}

// Popular score
function popularScore(p) {
  const ageHours = (Date.now() - p.timestamp) / 3600000;
  const likes = Array.isArray(p.likes) ? p.likes.length : 0;
  const comments = p.commentsCount || 0;

  return likes * 3 + comments * 4 - ageHours * 0.2;
}

// Batasi spam creator
function limitPerUser(posts, max = 2) {
  const count = {};
  return posts.filter(p => {
    count[p.userId] = (count[p.userId] || 0) + 1;
    return count[p.userId] <= max;
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
    const viewerId = req.query.viewerId || null;
    const userId = req.query.userId || null;
    const q = (req.query.q || "").toLowerCase();

    let query = db.collection(POSTS_PATH);

    if (mode === "meme") query = query.where("category", "==", "meme");
    if (mode === "user" && userId) query = query.where("userId", "==", userId);

    if (mode !== "search") query = query.orderBy("timestamp", "desc");

    if (cursor) {
      query = query.startAfter(admin.firestore.Timestamp.fromMillis(cursor));
    }

    const pool = mode === "home" || mode === "popular" ? limit * 5 : limit * 3;
    const snap = await query.limit(pool).get();

    if (snap.empty) {
      return res.json({ posts: [], nextCursor: null });
    }

    let posts = snap.docs.map(d => ({
      id: d.id,
      ...d.data(),
      timestamp: safeMillis(d.data().timestamp),
    }));

    /* ===== SEARCH ===== */
    if (mode === "search" && q) {
      posts = posts.filter(p =>
        p.title?.toLowerCase().includes(q) ||
        p.content?.toLowerCase().includes(q)
      );
    }

    /* ===== JOIN USER ===== */
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

    /* ===== ALGORITMA ===== */

    if (mode === "home") {
      posts = posts.map(p => ({
        ...p,
        _score: discoveryScore(p),
      }));

      posts.sort((a, b) => b._score - a._score);

      const top = shuffleSmall(posts.slice(0, 5));
      const rest = posts.slice(5);

      posts = limitPerUser([...top, ...rest]);
    }

    if (mode === "popular") {
      posts = posts
        .map(p => ({ ...p, _score: popularScore(p) }))
        .sort((a, b) => b._score - a._score);
    }

    const result = posts.slice(0, limit);

    res.json({
      posts: result,
      nextCursor: result.length ? result[result.length - 1].timestamp : null,
    });

  } catch (e) {
    console.error("FEED ERROR:", e);
    res.status(500).json({ error: true, message: e.message });
  }
}