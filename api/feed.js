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
  if (!ts) return Date.now();
  if (typeof ts.toMillis === 'function') return ts.toMillis();
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

// Filter agar user tidak spam (max 2 post per batch)
const filterSpamUser = (posts, max = 2) => {
  const map = {};
  return posts.filter(p => {
    map[p.userId] = (map[p.userId] || 0) + 1;
    return map[p.userId] <= max;
  });
};

/* ================== HANDLER ================== */
export default async function handler(req, res) {
  const apiKey = String(req.headers["x-api-key"] || req.query.apiKey || "").trim();
  if (!REQUIRED_API_KEY || apiKey !== REQUIRED_API_KEY) {
    return res.status(401).json({ error: true, message: "API key invalid" });
  }

  try {
    const mode = req.query.mode || "home";
    const limitReq = Number(req.query.limit) || 10;
    const viewerId = req.query.viewerId || null;
    const cursorId = req.query.cursor || null; // ID post terakhir dari frontend

    let queryRef = db.collection(POSTS_PATH);

    /* 1. FILTER BERDASARKAN MODE */
    if (mode === "meme") queryRef = queryRef.where("category", "==", "meme");
    if (mode === "user" && req.query.userId) queryRef = queryRef.where("userId", "==", req.query.userId);

    /* 2. ORDERING TETAP BERDASARKAN TIMESTAMP (WAJIB UNTUK CURSOR) */
    // Kita tidak boleh pakai scoring di level database agar cursor tidak duplikat
    queryRef = queryRef.orderBy("timestamp", "desc");

    /* 3. HANDLING CURSOR (ANTIDUPLIKAT SCROLL) */
    if (cursorId) {
      const cursorDoc = await db.collection(POSTS_PATH).doc(cursorId).get();
      if (cursorDoc.exists) {
        queryRef = queryRef.startAfter(cursorDoc);
      }
    }

    // Ambil sedikit lebih banyak untuk filter spam user di level aplikasi
    const snap = await queryRef.limit(limitReq + 5).get();
    
    if (snap.empty) return res.json({ posts: [], nextCursor: null });

    let posts = snap.docs.map(d => {
      const data = d.data();
      return {
        ...data,
        id: d.id,
        timestamp: safeMillis(data.timestamp),
      };
    });

    /* 4. LOGIKA ACAK & ANTI-SPAM (Hanya dilakukan per-batch) */
    if (mode !== "user") {
      // Filter spam user dulu
      posts = filterSpamUser(posts, 2);
      
      // Kita acak urutan di dalam batch ini saja agar terasa fresh tiap scroll
      // Tapi tidak merusak 'nextCursor' karena kita ambil ID asli dari data Firestore
      if (mode === "home") {
        posts = shuffle(posts);
      }
    }

    // Kembalikan ke jumlah limit yang diminta
    posts = posts.slice(0, limitReq);

    /* 5. JOIN DATA USER */
    const uids = [...new Set(posts.map(p => p.userId))];
    const userMap = {};
    if (uids.length) {
      const userSnaps = await Promise.all(uids.map(id => db.doc(`${USERS_PATH}/${id}`).get()));
      userSnaps.forEach(s => { if (s.exists) userMap[s.id] = s.data(); });
    }

    posts = posts.map(p => {
      const u = userMap[p.userId] || {};
      return {
        ...p,
        user: {
          username: u.username || "User",
          photoURL: u.photoURL || null,
          reputation: u.reputation || 0,
          email: u.email || ""
        }
      };
    });

    /* 6. NEXT CURSOR */
    // PENTING: Cursor harus ID asli dari dokumen terakhir di batch ini
    // agar request berikutnya 'startAfter' tepat di titik ini.
    const lastId = posts.length > 0 ? posts[posts.length - 1].id : null;

    res.status(200).json({
      posts: posts,
      nextCursor: lastId
    });

  } catch (e) {
    console.error("FEED_ERROR:", e);
    res.status(500).json({ error: true, message: e.message });
  }
}