import admin from "firebase-admin";

/* ================== KONFIG ================== */
const REQUIRED_API_KEY = process.env.REACT_APP_FEED_API_KEY?.trim() || null;

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
    const cursorId = req.query.cursor || null;

    let queryRef = db.collection(POSTS_PATH);

    /* 1. FILTER CATEGORY */
    if (mode === "meme") queryRef = queryRef.where("category", "==", "meme");
    if (mode === "user" && req.query.userId) queryRef = queryRef.where("userId", "==", req.query.userId);

    /* 2. SISTEM AMBIL BANYAK (BUFFERING) */
    // Kita ambil data lebih banyak dari yang diminta (misal limit 10, kita ambil 30)
    // Supaya kita punya stok konten untuk diacak-acak agar tidak membosankan
    const bufferSize = limitReq * 3; 
    
    // Tetap urutkan berdasarkan timestamp agar cursor Firestore bekerja 100% (ANTI DUPLIKAT)
    queryRef = queryRef.orderBy("timestamp", "desc");

    if (cursorId) {
      const cursorDoc = await db.collection(POSTS_PATH).doc(cursorId).get();
      if (cursorDoc.exists) {
        queryRef = queryRef.startAfter(cursorDoc);
      }
    }

    const snap = await queryRef.limit(bufferSize).get();
    
    if (snap.empty) return res.json({ posts: [], nextCursor: null });

    // Mapping data awal
    let allFetchedPosts = snap.docs.map(d => ({
      ...d.data(),
      id: d.id,
      timestamp: safeMillis(d.data().timestamp),
    }));

    /* 3. LOGIKA ACAK & ANTI-SPAM (PINTAR) */
    let finalPosts = [];
    if (mode === "home" || mode === "popular") {
      // Kelompokkan per User untuk mencegah spam beruntun
      const userGroups = {};
      allFetchedPosts.forEach(p => {
        if (!userGroups[p.userId]) userGroups[p.userId] = [];
        userGroups[p.userId].push(p);
      });

      // Ambil maksimal 2 post dari tiap user dalam batch ini
      let pool = [];
      Object.values(userGroups).forEach(group => {
        pool.push(...group.slice(0, 2));
      });

      // ACAK TOTAL agar setiap refresh/scroll posisinya beda-beda
      finalPosts = shuffle(pool);
    } else {
      finalPosts = allFetchedPosts;
    }

    // Kembalikan jumlah data sesuai limit yang diminta frontend
    const result = finalPosts.slice(0, limitReq);

    /* 4. JOIN DATA USER */
    const uids = [...new Set(result.map(p => p.userId))];
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
          email: u.email || ""
        }
      };
    });

    /* 5. PENENTUAN CURSOR YANG AKURAT */
    // Kita harus ambil ID dari dokumen TERAKHIR yang benar-benar diambil dari Firestore
    // supaya request berikutnya nyambung, bukan mengulang data yang sama.
    const lastDocInSnap = snap.docs[snap.docs.length - 1];
    const nextCursor = allFetchedPosts.length >= bufferSize ? lastDocInSnap.id : (result.length > 0 ? result[result.length - 1].id : null);

    res.status(200).json({
      posts: postsResponse,
      nextCursor: nextCursor
    });

  } catch (e) {
    console.error("FEED_ERROR:", e);
    res.status(500).json({ error: true, message: e.message });
  }
}