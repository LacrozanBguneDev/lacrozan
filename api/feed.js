import admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault()
  });
}

const db = admin.firestore();

function calcScore(post) {
  const likes = post.likes?.length || 0;
  const comments = post.commentsCount || 0;
  const ageHours =
    (Date.now() - post.timestamp.toMillis()) / 36e5;

  let freshness = 0;
  if (ageHours < 6) freshness = 30;
  else if (ageHours < 24) freshness = 15;
  else if (ageHours < 72) freshness = 5;

  return likes * 3 + comments * 5 + freshness;
}

export default async function handler(req, res) {
  try {
    const mode = req.query.mode || "home";
    const limit = Number(req.query.limit || 10);
    const cursor = req.query.cursor;

    let query = db
      .collection("artifacts/default-app-id/public/data/posts")
      .orderBy("timestamp", "desc")
      .limit(50);

    if (cursor) {
      query = query.startAfter(
        admin.firestore.Timestamp.fromMillis(Number(cursor))
      );
    }

    const snap = await query.get();
    if (snap.empty) {
      return res.json({ posts: [], lastTimestamp: null });
    }

    let posts = snap.docs.map(d => ({
      id: d.id,
      ...d.data()
    }));

    // MODE FILTER
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

    // POPULAR / HOME = scoring
    if (mode === "popular" || mode === "home") {
      posts = posts
        .map(p => ({ ...p, score: calcScore(p) }))
        .sort((a, b) => b.score - a.score);
    }

    const result = posts.slice(0, limit);
    const last =
      result[result.length - 1]?.timestamp?.toMillis() || null;

    res.json({
      posts: result,
      lastTimestamp: last
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Backend error" });
  }
}