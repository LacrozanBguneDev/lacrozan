import admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(
      JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
    ),
  });
}

const db = admin.firestore();
const POSTS_PATH = "artifacts/default-app-id/public/data/posts";

function safeMillis(ts) {
  return ts && ts.toMillis ? ts.toMillis() : 0;
}

export default async function handler(req, res) {
  try {
    const mode = req.query.mode || "home";
    const limit = Math.min(Number(req.query.limit) || 10, 20);
    const userId = req.query.userId || null;
    const q = (req.query.q || "").toLowerCase();

    let snap = await db
      .collection(POSTS_PATH)
      .orderBy("timestamp", "desc")
      .limit(50)
      .get();

    if (snap.empty) {
      return res.json({ posts: [], nextCursor: null });
    }

    let posts = snap.docs.map(d => ({
      id: d.id,
      ...d.data(),
    }));

    /* ===== FILTER MODE ===== */

    if (mode === "meme") {
      posts = posts.filter(p => p.category === "meme");
    }

    if (mode === "user" && userId) {
      posts = posts.filter(p => p.userId === userId);
    }

    if (mode === "search" && q) {
      posts = posts.filter(
        p =>
          p.title?.toLowerCase().includes(q) ||
          p.content?.toLowerCase().includes(q)
      );
    }

    /* ===== POPULAR ===== */
    if (mode === "popular" || mode === "home") {
      posts = posts
        .map(p => {
          const likes = Array.isArray(p.likes) ? p.likes.length : 0;
          const comments = p.commentsCount || 0;
          const score = likes * 2 + comments * 3;
          return { ...p, score };
        })
        .sort((a, b) => b.score - a.score);
    }

    const result = posts.slice(0, limit);

    res.json({
      posts: result,
      nextCursor:
        result.length > 0
          ? safeMillis(result[result.length - 1].timestamp)
          : null,
    });

  } catch (e) {
    console.error("FEED ERROR:", e);
    res.status(500).json({
      error: true,
      message: e.message,
    });
  }
}