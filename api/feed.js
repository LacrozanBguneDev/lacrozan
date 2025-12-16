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

/* ================== UTIL (PERBAIKAN TIMESTAMP & ACAK) ================== */
// Memastikan timestamp balik ke angka murni (ms) agar tidak NaN di frontend
const safeMillis = ts => {
  if (!ts) return Date.now();
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (ts._seconds) return ts._seconds * 1000;
  if (typeof ts === 'number') return ts;
  const d = new Date(ts);
  return isNaN(d.getTime()) ? Date.now() : d.getTime();
};

const shuffle = arr => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// Mencegah spam user yang sama muncul berlebihan
const limitPerUser = (posts, max = 2) => {
  const map = {};
  return posts.filter(p => {
    map[p.userId] = (map[p.userId] || 0) + 1;
    return map[p.userId] <= max;
  });
};

/* ================== SCORE (PRIORITAS BARU & TRENDING) ================== */
const calculateScore = p => {
  const ageH = (Date.now() - p.timestamp) / 3600000;
  const likes = p.likes?.length || 0;
  const comments = p.commentsCount || 0;
  
  // Bonus untuk postingan di bawah 24 jam (Postingan baru sangat diprioritaskan)
  const freshness = Math.max(0, 24 - ageH) * 2; 
  
  // Rumus: Likes + Komentar + Bonus Baru - Penalti Waktu
  return (likes * 3) + (comments * 5) + freshness - (ageH * 0.5);
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
    const cursor = req.query.cursor || null;

    let queryRef = db.collection(POSTS_PATH);

    /* ===== FILTER MODE ===== */
    if (mode === "meme") queryRef = queryRef.where("category", "==", "meme");
    if (mode === "user" && req.query.userId) queryRef = queryRef.where("userId", "==", req.query.userId);

    // Untuk dapet data yang fresh, kita ambil lebih banyak dulu lalu diacak di server
    queryRef = queryRef.orderBy("timestamp", "desc");

    if (cursor) {
      const cursorDoc = await db.collection(POSTS_PATH).doc(cursor).get();
      if (cursorDoc.exists) queryRef = queryRef.startAfter(cursorDoc);
    }

    // Ambil data 3x lipat lebih banyak agar kita bisa acak/filter spam user
    const fetchLimit = cursor ? limitReq * 2 : limitReq * 4;
    const snap = await queryRef.limit(fetchLimit).get();
    
    if (snap.empty) return res.json({ posts: [], nextCursor: null });

    let posts = snap.docs.map(d => {
      const data = d.data();
      const ts = safeMillis(data.timestamp);
      return {
        ...data,
        id: d.id,
        timestamp: ts, // SEKARANG PASTI ANGKA (MENCEGAH NaN)
      };
    });

    /* ===== ALGORITMA ANTI MONOTON ===== */
    if (mode === "home" || mode === "popular") {
      // 1. Hitung skor untuk tiap post
      posts = posts.map(p => ({ ...p, _score: calculateScore(p) }));
      
      // 2. Pisahkan sangat baru vs lama
      const superFresh = posts.filter(p => (Date.now() - p.timestamp) < 3600000 * 6); // 6 jam terakhir
      const others = posts.filter(p => (Date.now() - p.timestamp) >= 3600000 * 6);

      // 3. Acak masing-masing grup agar tiap refresh terasa beda
      posts = [...shuffle(superFresh), ...shuffle(others)];
      
      // 4. Sortir berdasarkan skor tapi beri toleransi acak (biar gak itu-itu aja)
      posts.sort((a, b) => (b._score + Math.random() * 5) - (a._score + Math.random() * 5));
    }

    /* ===== ANTI SPAM USER ===== */
    // Maksimal 2 postingan dari user yang sama dalam satu tampilan feed
    if (mode !== "user") {
      posts = limitPerUser(posts, 2);
    }

    // Ambil sesuai limit asli
    posts = posts.slice(0, limitReq);

    /* ===== JOIN DATA USER (BADGE & FOTO) ===== */
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

    /* ===== UPDATE SEEN (BIAR GAK MUNCUL LAGI) ===== */
    if (viewerId && posts.length && mode === "home") {
      await db.doc(`${USERS_PATH}/${viewerId}`).set({
        seenPosts: admin.firestore.FieldValue.arrayUnion(...posts.map(p => p.id))
      }, { merge: true });
    }

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