import admin from "firebase-admin";

/* =====================
   INIT FIREBASE
===================== */
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(
      JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
    ),
  });
}

const db = admin.firestore();

/* =====================
   API KEY SECURITY
===================== */
const API_KEY = process.env.FEED_API_KEY;

function auth(req, res) {
  const key = req.headers["x-api-key"];
  if (!key || key !== API_KEY) {
    res.status(403).json({ error: "Forbidden" });
    return false;
  }
  return true;
}

/* =====================
   SCORE ALGORITHM
===================== */
function calcScore(post) {
  const likes = post.likes?.length || 0;
  const comments = post.commentsCount || 0;

  if (!post.timestamp) return 0;

  const ageHours =
    (Date.now() - post.timestamp.toMillis()) / 36e5;

  let freshness = 0;
  if (ageHours < 6) freshness = 30;
  else if (ageHours < 24) freshness = 15;
  else if (ageHours < 72) freshness = 5;

  return likes * 3 + comments * 5 + freshness;
}

/* =====================
   MAIN HANDLER
===================== */
export default async function handler(req, res) {
  if (!auth(req, res)) return;

  try {
    const {
      mode = "home",   // home | popular | meme | profile | search
      userId = null,
      q = "",
      limit = 10,
      cursor = null
    } = req.query;

    let ref = db
      .collection("artifacts/default-app-id/public/data/posts")
      .orderBy("timestamp", "desc");

    /* ========= FILTER ========= */
    if (mode === "meme") {
      ref = ref.where("category", "==", "meme");
    }

    if (mode === "profile" && userId) {
      ref = ref.where("user.userId", "==", userId);
    }

    if (cursor) {
      ref = ref.startAfter(
        admin.firestore.Timestamp.fromMillis(Number(cursor))
      );
    }

    const snap = await ref.limit(50).get();
    if (snap.empty) {
      return res.json({ posts: [], nextCursor: null });
    }

    let posts = snap.docs.map(d => {
      const data = d.data();

      return {
        id: d.id,

        // === POST DATA ===
        title: data.title || "",
        content: data.content || "",
        category: data.category || "general",
        likes: data.likes || [],
        commentsCount: data.commentsCount || 0,
        mediaType: data.mediaType || "text",
        mediaUrl: data.mediaUrl || "",
        mediaUrls: data.mediaUrls || [],

        // === USER (WAJIB UTUH) ===
        user: {
          userId: data.user?.userId || "",
          uid: data.user?.uid || "",
          username: data.user?.username || "",
          photoURL: data.user?.photoURL || null
        },

        // === TIME ===
        timestamp: data.timestamp
      };
    });

    /* ========= SEARCH ========= */
    if (mode === "search" && q) {
      const key = q.toLowerCase();
      posts = posts.filter(p =>
        p.title.toLowerCase().includes(key) ||
        p.content.toLowerCase().includes(key)
      );
    }

    /* ========= POPULAR / HOME ========= */
    if (mode === "popular" || mode === "home") {
      posts = posts
        .map(p => ({ ...p, score: calcScore(p) }))
        .sort((a, b) => b.score - a.score);
    }

    const result = posts.slice(0, Number(limit));
    const nextCursor =
      result[result.length - 1]?.timestamp?.toMillis() || null;

    res.json({
      posts: result.map(p => ({
        ...p,
        timestamp: p.timestamp.toMillis() // 🔥 FIX NaN
      })),
      nextCursor
    });

  } catch (e) {
    console.error(e);
    res.status(500).json({
      error: true,
      message: e.message
    });
  }
}