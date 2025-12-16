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
const safeMillis = ts => (ts?.toMillis ? ts.toMillis() : 0);

const shuffle = arr => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
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
    const nextCursor = Number(req.query.nextCursor) || null;

    /* ================== QUERY ================== */
    let query = db.collection(POSTS_PATH);

    if (mode === "meme") query = query.where("category", "==", "meme");

    query = query.orderBy("timestamp", "desc");
    if (nextCursor) query = query.startAfter(nextCursor);

    const poolSize = mode === "home" ? limit * 8 : limit;
    const snap = await query.limit(poolSize).get();

    if (snap.empty) {
      return res.json({ posts: [], nextCursor: null });
    }

    let posts = snap.docs.map(d => ({
      id: d.id,
      ...d.data(),
      timestamp: safeMillis(d.data().timestamp),
    }));

    /* ================== HOME ALGORITHM ================== */
    if (mode === "home") {
      const now = Date.now();

      const fresh = posts.filter(
        p => (now - p.timestamp) / 3600000 < 24
      );
      const rest = posts.filter(p => !fresh.includes(p));

      posts = [
        ...shuffle(fresh),
        ...shuffle(rest),
      ].slice(0, limit);
    }

    /* ================== MEME & POPULER ================== */
    else {
      posts = posts.slice(0, limit);
    }

    /* ================== CURSOR ================== */
    const newCursor = posts.length
      ? posts[posts.length - 1].timestamp
      : null;

    res.json({
      posts,
      nextCursor: newCursor,
    });

  } catch (e) {
    console.error("FEED ERROR:", e);
    res.status(500).json({ error: true, message: e.message });
  }
}