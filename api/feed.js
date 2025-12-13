import admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault()
  });
}

const db = admin.firestore();
const POSTS_PATH = "artifacts/default-app-id/public/data/posts";

// AMAN: hitung score tanpa crash
function calcScore(post) {
  const likes = Array.isArray(post.likes) ? post.likes.length : 0;
  const comments = typeof post.commentsCount === "number" ? post.commentsCount : 0;

  let ageHours = 999;
  if (post.timestamp && post.timestamp.toMillis) {
    ageHours = (Date.now() - post.timestamp.toMillis()) / 36e5;
  }

  let freshness = 0;
  if (ageHours < 6) freshness = 30;
  else if (ageHours < 24) freshness = 15;
  else if (ageHours < 72) freshness = 5;

  return likes * 3 + comments * 5 + freshness;
}

export default async function handler(req, res) {
  try {
    const mode = req.query.mode || "home";
    const limit = Math.min(Number(req.query.limit) || 10, 20);

    // AMBIL DATA TANPA startAfter dulu (AMAN)
    const snap = await db
      .collection(POSTS_PATH)
      .orderBy("timestamp", "desc")
      .limit(50)
      .get();

    if (snap.empty) {
      return res.json({ posts: [], lastTimestamp: null });
    }

    let posts = snap.docs.map(d => ({
      id: d.id,
      ...d.data()
    }));

    // FILTER MODE
    if (mode === "meme") {
      posts = posts.filter(p => p.category === "meme");
    }

    if (mode === "profile") {
      posts = posts.filter(p => p.userId === req.query.userId);
    }

    if (mode === "search") {
      const q = (req.query.q || "").toLowerCase();
      posts = posts.filter(
        p =>
          p.title?.toLowerCase().includes(q) ||
          p.content?.toLowerCase().includes(q)
      );
    }

    // HOME & POPULAR = ALGORITMA
    if (mode === "home" || mode === "popular") {
      posts = posts
        .map(p => ({ ...p, score: calcScore(p) }))
        .sort((a, b) => b.score - a.score);
    }

    const result = posts.slice(0, limit);
    const last =
      result[result.length - 1]?.timestamp?.toMillis?.() || null;

    res.json({
      posts: result,
      lastTimestamp: last
    });
  } catch (err) {
    console.error("FEED ERROR:", err);
    res.status(500).json({ error: "Backend error" });
  }
}