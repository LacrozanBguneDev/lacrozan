import admin from "firebase-admin";

/* ================== KONFIG ================== */
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
const safeMillis = ts => {
  if (!ts) return 0;
  if (ts.toMillis) return ts.toMillis();
  if (ts._seconds) return ts._seconds * 1000;
  if (ts instanceof Date) return ts.getTime();
  return Number(ts) || 0;
};

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
  // 1. Pastikan Header & API Key sesuai request frontend
  const apiKey = String(req.headers["x-api-key"] || req.query.apiKey || "").trim();
  if (!REQUIRED_API_KEY || apiKey !== REQUIRED_API_KEY) {
    return res.status(401).json({ error: true, message: "API key invalid" });
  }

  try {
    const mode = req.query.mode || "home";
    const limitReq = Number(req.query.limit) || 10;
    const viewerId = req.query.viewerId || null;
    const cursor = req.query.cursor || null;

    /* ===== 2. QUERY BASE ===== */
    let queryRef = db.collection(POSTS_PATH);

    if (mode === "meme") queryRef = queryRef.where("category", "==", "meme");
    if (mode === "user" && req.query.userId) queryRef = queryRef.where("userId", "==", req.query.userId);

    // Frontend butuh urutan terbaru agar scroll terasa natural
    queryRef = queryRef.orderBy("timestamp", "desc");

    /* ===== 3. PAGINATION (PENTING) ===== */
    if (cursor) {
      const cursorDoc = await db.collection(POSTS_PATH).doc(cursor).get();
      if (cursorDoc.exists) {
        queryRef = queryRef.startAfter(cursorDoc);
      }
    }

    // Kita ambil data sesuai limit yang diminta frontend
    const snap = await queryRef.limit(limitReq).get();
    
    if (snap.empty) {
      return res.json({ posts: [], nextCursor: null });
    }

    /* ===== 4. MAPPING DATA (SESUAI POSTCARD.JSX) ===== */
    let posts = snap.docs.map(d => {
      const data = d.data();
      return {
        ...data,
        id: d.id, // ID harus ada di level atas
        timestamp: data.timestamp, // Biarkan dalam format asli atau millis, PostCard biasanya handle keduanya
      };
    });

    /* ===== 5. JOIN USER DATA ===== */
    const uids = [...new Set(posts.map(p => p.userId))];
    const userMap = {};
    
    if (uids.length) {
      const userSnaps = await Promise.all(uids.map(id => db.doc(`${USERS_PATH}/${id}`).get()));
      userSnaps.forEach(s => {
        if (s.exists) userMap[s.id] = s.data();
      });
    }

    // Gabungkan data user ke post
    posts = posts.map(p => {
      const userData = userMap[p.userId] || {};
      return {
        ...p,
        user: {
          username: userData.username || "Anonim",
          photoURL: userData.photoURL || null,
          reputation: userData.reputation || 0,
          email: userData.email || ""
        }
      };
    });

    /* ===== 6. RESPONSE SESUAI FRONTEND ===== */
    // Frontend Anda mengecek: data.posts.length === limit
    // Jadi kita kirim balik ID terakhir sebagai cursor
    const lastDocId = posts.length > 0 ? posts[posts.length - 1].id : null;

    res.status(200).json({
      posts: posts,
      nextCursor: lastDocId
    });

  } catch (e) {
    console.error("FEED_ERROR:", e);
    res.status(500).json({ error: true, message: e.message });
  }
}