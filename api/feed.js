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

/* ================== CACHE USER PROFILE ================== */
const userCache = new Map();
const getUserProfile = async (userId) => {
  if (!userId) return { username: "Unknown", photoURL: null };
  if (userCache.has(userId)) return userCache.get(userId);
  const doc = await db.doc(`${USERS_PATH}/${userId}`).get();
  const data = doc.exists
    ? { username: doc.data().username || "Unknown", photoURL: doc.data().photoURL || null }
    : { username: "Unknown", photoURL: null };
  userCache.set(userId, data);
  return data;
};

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
  const decay = ageHours > 72 ? -5 : 0;
  return likes * 2 + comments * 3 + freshness + decay;
};

/* ================== HANDLER ================== */
export default async function handler(req, res) {
  const apiKey = String(req.headers["x-api-key"] || req.query.apiKey || "").trim();
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
    if (mode === "user" && userId) query = query.where("userId", "==", userId);
    query = query.orderBy("timestamp", "desc");
    if (nextCursor) query = query.startAfter(nextCursor);

    const poolMultiplier = mode === "home" || mode === "popular" ? 10 : 8;
    const snap = await query.limit(limit * poolMultiplier).get();
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

    /* ================== JOIN USER PROFILES ================== */
    const userIds = [...new Set(posts.map(p => p.userId).filter(Boolean))];
    const userProfiles = await Promise.all(userIds.map(getUserProfile));
    const userMap = {};
    userIds.forEach((uid, i) => userMap[uid] = userProfiles[i]);
    posts = posts.map(p => ({ ...p, user: userMap[p.userId] || { username: "Unknown", photoURL: null } }));

    /* ================== HISTORY USER ================== */
    let seenIds = new Set();
    if (viewerId) {
      const viewerDoc = await db.doc(`${USERS_PATH}/${viewerId}`).get();
      if (viewerDoc.exists) {
        seenIds = new Set(viewerDoc.data().seenPosts || []);
      }
    }
    posts = posts.filter(p => !seenIds.has(p.id));

    /* ================== SCORE & WEIGHTED RANDOM ================== */
    posts = posts.map(p => ({ ...p, _score: discoveryScore(p) }));
    
    // Pisahkan post terbaru (<12 jam)
    const newPosts = posts.filter(p => (Date.now() - p.timestamp) / 3600000 < 12);
    let rest = posts.filter(p => !newPosts.includes(p));
    rest = shuffleArray(rest);

    // Weighted random selection
    const finalPosts = [];
    const count = {};
    const allPosts = [...newPosts, ...rest];
    while (finalPosts.length < limit && allPosts.length) {
      const totalScore = allPosts.reduce((sum, p) => sum + p._score + 1, 0);
      let r = Math.random() * totalScore;
      let chosenIndex = 0;
      let sum = 0;
      for (let i = 0; i < allPosts.length; i++) {
        sum += allPosts[i]._score + 1;
        if (sum >= r) {
          chosenIndex = i;
          break;
        }
      }
      const p = allPosts[chosenIndex];
      if ((count[p.userId] || 0) < 2) {
        finalPosts.push(p);
        count[p.userId] = (count[p.userId] || 0) + 1;
      }
      allPosts.splice(chosenIndex, 1); // remove selected
    }

    /* ================== UPDATE HISTORY USER ================== */
    if (viewerId && finalPosts.length) {
      const viewerRef = db.doc(`${USERS_PATH}/${viewerId}`);
      await viewerRef.set({
        seenPosts: admin.firestore.FieldValue.arrayUnion(...finalPosts.map(p => p.id))
      }, { merge: true });
    }

    /* ================== NEXT CURSOR ================== */
    const newCursor = finalPosts.length ? finalPosts[finalPosts.length - 1].timestamp : null;

    res.json({ posts: finalPosts, nextCursor: newCursor });

  } catch (e) {
    console.error("FEED ERROR:", e);
    res.status(500).json({ error: true, message: e.message });
  }
}