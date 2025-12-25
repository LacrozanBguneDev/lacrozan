import admin from "firebase-admin";

/* ================== KONFIG ================== */
const REQUIRED_API_KEY = process.env.FEED_API_KEY?.trim() || null;

let db;

if (!admin.apps.length) {
  try {
    if (!process.env.FIREBASE_SERVICE_ACCOUNT) throw new Error("Env var FIREBASE_SERVICE_ACCOUNT missing");

    const serviceAccount = JSON.parse(
      process.env.FIREBASE_SERVICE_ACCOUNT.replace(/\\n/g, "\n")
    );

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });

    db = admin.firestore();
    console.log("Firestore initialized ✅");
  } catch (err) {
    console.error("FIREBASE INIT ERROR:", err);
  }
} else {
  db = admin.firestore();
}

const POSTS_PATH = "artifacts/default-app-id/public/data/posts";
const USERS_PATH = "artifacts/default-app-id/public/data/userProfiles";

/* ================== UTIL ================== */
const safeMillis = ts => {
  if (!ts) return Date.now();
  if (typeof ts.toMillis === "function") return ts.toMillis();
  if (ts._seconds) return ts._seconds * 1000;
  return Number(ts) || Date.now();
};

const shuffle = arr => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const dailySeedSort = posts => {
  const seed = Math.floor(Date.now() / 86400000);
  return [...posts].sort((a, b) => {
    const ra = Math.sin(seed + (a.id?.length || 0)) * 10000;
    const rb = Math.sin(seed + (b.id?.length || 0)) * 10000;
    return rb - ra;
  });
};

/* ================== HANDLER ================== */
export default async function handler(req, res) {
  if (!db) {
    return res.status(500).json({ error: true, message: "Firestore not initialized" });
  }

  const apiKey = String(req.headers["x-api-key"] || req.query.apiKey || "").trim();
  if (!REQUIRED_API_KEY || apiKey !== REQUIRED_API_KEY) {
    return res.status(401).json({ error: true, message: "API key invalid" });
  }

  try {
    const mode = req.query.mode || "home";
    const limitReq = Math.min(Number(req.query.limit) || 10, 50);
    const viewerId = req.query.viewerId || null;
    const cursorId = req.query.cursor || null;

    let queryRef = db.collection(POSTS_PATH);

    /* ================== MODE FOLLOWING ================== */
    let followingIds = null;
    let isFollowingFallback = false;

    if (mode === "following") {
      if (!viewerId) isFollowingFallback = true;
      else {
        const viewerSnap = await db.doc(`${USERS_PATH}/${viewerId}`).get();
        if (!viewerSnap.exists) isFollowingFallback = true;
        else {
          const viewerData = viewerSnap.data() || {};
          followingIds = Array.isArray(viewerData.following)
            ? viewerData.following.slice(0, 10)
            : [];
          if (followingIds.length === 0) isFollowingFallback = true;
        }
      }
    }

    /* ================== FILTER CATEGORY ================== */
    if (mode === "meme") queryRef = queryRef.where("category", "==", "meme");
    if (mode === "user" && req.query.userId) queryRef = queryRef.where("userId", "==", req.query.userId);
    if (mode === "following" && followingIds?.length && !isFollowingFallback)
      queryRef = queryRef.where("userId", "in", followingIds);

    /* ================== BUFFERING ================== */
    const bufferSize = limitReq * 3;
    queryRef = queryRef.orderBy("timestamp", "desc");

    if (cursorId) {
      const cursorDoc = await db.collection(POSTS_PATH).doc(cursorId).get();
      if (cursorDoc.exists) queryRef = queryRef.startAfter(cursorDoc);
      else console.warn("Cursor not found:", cursorId);
    }

    const snap = await queryRef.limit(bufferSize).get();

    if (snap.empty) {
      if (mode === "following") isFollowingFallback = true;
      else return res.json({ posts: [], nextCursor: null });
    }

    const allFetchedPosts = snap.docs.map(d => ({
      ...d.data(),
      id: d.id,
      timestamp: safeMillis(d.data()?.timestamp),
    }));

    /* ================== LOGIKA FEED ================== */
    let finalPosts = [];
    if (mode === "home" || mode === "popular" || (mode === "following" && isFollowingFallback)) {
      const userGroups = {};
      allFetchedPosts.forEach(p => {
        if (!p.userId) return;
        if (!userGroups[p.userId]) userGroups[p.userId] = [];
        userGroups[p.userId].push(p);
      });

      let pool = [];
      Object.values(userGroups).forEach(group => pool.push(...group.slice(0, 2)));

      pool = dailySeedSort(pool);
      finalPosts = shuffle(pool);
    } else finalPosts = dailySeedSort(allFetchedPosts);

    const result = finalPosts.slice(0, limitReq);

    /* ================== JOIN USER DATA ================== */
    const uids = [...new Set(result.map(p => p.userId).filter(Boolean))];
    const userMap = {};
    if (uids.length) {
      const userSnaps = await Promise.all(uids.map(id => db.doc(`${USERS_PATH}/${id}`).get()));
      userSnaps.forEach(s => { if (s.exists) userMap[s.id] = s.data(); });
    }

    const postsResponse = result.map(p => {
      const u = userMap[p.userId] || {};
      return {
        ...p,
        user: {
          username: u.username || "User",
          photoURL: u.photoURL || null,
          reputation: u.reputation || 0,
          email: u.email || "",
        },
      };
    });

    /* ================== CURSOR ================== */
    const lastDocInSnap = snap.docs[snap.docs.length - 1];
    const nextCursor = allFetchedPosts.length >= bufferSize
      ? lastDocInSnap?.id || null
      : result.length > 0
      ? result[result.length - 1].id
      : null;

    res.status(200).json({ posts: postsResponse, nextCursor });
  } catch (e) {
    console.error("FEED_ERROR:", e);
    res.status(500).json({ error: true, message: e.message || "Unknown error" });
  }
}