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
const safeMillis = ts => ts && ts.toMillis ? ts.toMillis() : 0;

const shuffleArray = arr => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/* ================== USER PROFILE CACHE ================== */
// { userId: { data, expires } }
const profileCache = new Map();
const PROFILE_TTL = 5 * 60 * 1000; // 5 menit

const getUserProfile = async userId => {
  const cached = profileCache.get(userId);
  const now = Date.now();

  if (cached && cached.expires > now) {
    return cached.data;
  }

  const snap = await db.doc(`${USERS_PATH}/${userId}`).get();
  const data = snap.exists ? snap.data() : null;

  profileCache.set(userId, {
    data,
    expires: now + PROFILE_TTL,
  });

  return data;
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
    const cursor = Number(req.query.cursor || Date.now());

    /* ================== SEEN POSTS ================== */
    let seenIds = new Set();
    if (viewerId) {
      const viewerDoc = await db.doc(`${USERS_PATH}/${viewerId}`).get();
      if (viewerDoc.exists) {
        seenIds = new Set(viewerDoc.data().seenPosts || []);
      }
    }

    /* ================== POOL BARU & LAMA ================== */
    const now = Date.now();
    const FRESH_LIMIT = now - 48 * 3600000;

    const freshSnap = await db.collection(POSTS_PATH)
      .where("timestamp", ">=", admin.firestore.Timestamp.fromMillis(FRESH_LIMIT))
      .orderBy("timestamp", "desc")
      .limit(limit * 5)
      .get();

    const oldSnap = await db.collection(POSTS_PATH)
      .where("timestamp", "<", admin.firestore.Timestamp.fromMillis(FRESH_LIMIT))
      .orderBy("timestamp", "desc")
      .limit(limit * 3)
      .get();

    let freshPosts = freshSnap.docs.map(d => ({
      id: d.id,
      ...d.data(),
      timestamp: safeMillis(d.data().timestamp),
    }));

    let oldPosts = oldSnap.docs.map(d => ({
      id: d.id,
      ...d.data(),
      timestamp: safeMillis(d.data().timestamp),
    }));

    // FILTER CURSOR + SEEN
    freshPosts = freshPosts.filter(p => p.timestamp < cursor && !seenIds.has(p.id));
    oldPosts   = oldPosts.filter(p => p.timestamp < cursor && !seenIds.has(p.id));

    /* ================== RANDOM PROPORSIONAL ================== */
    const freshTake = Math.ceil(limit * 0.7);
    const oldTake   = limit - freshTake;

    const pickedFresh = shuffleArray(freshPosts).slice(0, freshTake);
    const pickedOld   = shuffleArray(oldPosts).slice(0, oldTake);

    let posts = shuffleArray([...pickedFresh, ...pickedOld]);

    /* ================== JOIN USER (CACHE) ================== */
    for (let p of posts) {
      if (!p.userId) {
        p.user = { username: "Unknown", photoURL: null };
        continue;
      }

      const profile = await getUserProfile(p.userId);
      p.user = {
        username: profile?.username || "Unknown",
        photoURL: profile?.photoURL || null,
      };
    }

    /* ================== UPDATE SEEN ================== */
    if (viewerId && posts.length) {
      await db.doc(`${USERS_PATH}/${viewerId}`).set({
        seenPosts: admin.firestore.FieldValue.arrayUnion(
          ...posts.map(p => p.id)
        )
      }, { merge: true });
    }

    /* ================== RESPONSE ================== */
    res.json({
      posts,
      nextCursor: posts.length
        ? posts[posts.length - 1].timestamp
        : null,
    });

  } catch (e) {
    console.error("FEED ERROR:", e);
    res.status(500).json({ error: true, message: e.message });
  }
}