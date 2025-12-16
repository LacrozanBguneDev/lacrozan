import admin from "firebase-admin";

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

const safeMillis = ts => ts && ts.toMillis ? ts.toMillis() : 0;
const shuffleArray = arr => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

export default async function handler(req, res) {
  const apiKey = String(req.headers["x-api-key"] || req.query.apiKey || "").trim();
  if (!REQUIRED_API_KEY || apiKey !== REQUIRED_API_KEY) {
    return res.status(401).json({ error: true, message: "API key invalid" });
  }

  try {
    const limit = Math.min(Number(req.query.limit) || 10, 20);
    const viewerId = req.query.viewerId || null;

    // Ambil semua post terbaru (pool multiplier)
    const poolMultiplier = 10;
    let snap = await db.collection(POSTS_PATH)
      .orderBy("timestamp", "desc")
      .limit(limit * poolMultiplier)
      .get();

    if (snap.empty) return res.json({ posts: [], nextCursor: null });

    let posts = snap.docs.map(d => ({ id: d.id, ...d.data(), timestamp: safeMillis(d.data().timestamp) }));

    // Ambil history user
    let seenIds = new Set();
    if (viewerId) {
      const viewerDoc = await db.doc(`${USERS_PATH}/${viewerId}`).get();
      if (viewerDoc.exists) seenIds = new Set(viewerDoc.data().seenPosts || []);
    }

    // Filter post yang belum dilihat
    posts = posts.filter(p => !seenIds.has(p.id));

    // Boost post terbaru (<12 jam)
    const newPosts = posts.filter(p => (Date.now() - p.timestamp) / 3600000 < 12);
    let rest = posts.filter(p => !newPosts.includes(p));
    rest = shuffleArray(rest);

    // Gabungkan
    let finalPosts = shuffleArray(newPosts).concat(rest);

    // Batasi max 2 post per user
    const count = {};
    finalPosts = finalPosts.filter(p => {
      count[p.userId] = (count[p.userId] || 0) + 1;
      return count[p.userId] <= 2;
    });

    // Ambil sesuai limit
    finalPosts = finalPosts.slice(0, limit);

    // Join user profile
    const userIds = [...new Set(finalPosts.map(p => p.userId).filter(Boolean))];
    const userProfiles = await Promise.all(userIds.map(getUserProfile));
    const userMap = {};
    userIds.forEach((uid, i) => userMap[uid] = userProfiles[i]);
    finalPosts = finalPosts.map(p => ({ ...p, user: userMap[p.userId] || { username: "Unknown", photoURL: null } }));

    // Update history user
    if (viewerId && finalPosts.length) {
      const viewerRef = db.doc(`${USERS_PATH}/${viewerId}`);
      await viewerRef.set({
        seenPosts: admin.firestore.FieldValue.arrayUnion(...finalPosts.map(p => p.id))
      }, { merge: true });
    }

    res.json({ posts: finalPosts, nextCursor: finalPosts.length ? finalPosts[finalPosts.length - 1].timestamp : null });

  } catch (e) {
    console.error("FEED ERROR:", e);
    res.status(500).json({ error: true, message: e.message });
  }
}