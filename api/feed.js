import admin from "firebase-admin";
import { CONFIG } from './config.js'; 

/* ================== KONFIGURASI ================== */
const REQUIRED_API_KEY = process.env.FEED_API_KEY?.trim() || CONFIG.FEED_API_KEY || null;

// SETTING BATAS UMUR POSTINGAN (Agar tidak muncul post zaman purba)
// 90 Hari = 90 * 24 * 60 * 60 * 1000. Ubah angka 90 jika ingin lebih singkat.
const MAX_POST_AGE_MS = 90 * 24 * 60 * 60 * 1000; 

let db = null;
let initError = null;

const POSTS_PATH = "artifacts/default-app-id/public/data/posts";
const USERS_PATH = "artifacts/default-app-id/public/data/userProfiles";

/* ================== SETUP FIREBASE ================== */
const getServiceAccount = () => {
  const rawEnv = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!rawEnv) throw new Error("Environment Variable FIREBASE_SERVICE_ACCOUNT kosong.");

  let serviceAccount;
  try {
    serviceAccount = JSON.parse(rawEnv);
  } catch {
    try {
      const decoded = Buffer.from(rawEnv, 'base64').toString('utf-8');
      serviceAccount = JSON.parse(decoded);
    } catch {
      throw new Error("Format FIREBASE_SERVICE_ACCOUNT rusak.");
    }
  }
  
  // Fix format private key
  if (serviceAccount.private_key) {
    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, "\n");
  }

  return serviceAccount;
};

try {
  if (!admin.apps.length) {
    const serviceAccount = getServiceAccount();
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  }
  db = admin.firestore();
} catch (err) {
  console.error("FIREBASE_INIT_ERROR:", err);
  initError = err.message;
}

/* ================== HELPERS ================== */
const safeMillis = ts => {
  if (!ts) return Date.now();
  if (typeof ts.toMillis === "function") return ts.toMillis();
  if (ts._seconds) return ts._seconds * 1000;
  return Number(ts) || Date.now();
};

// Fungsi pengacak array (Fisher-Yates Shuffle)
const shuffle = arr => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/* ================== MAIN HANDLER ================== */
export default async function handler(req, res) {
  if (!db) return res.status(500).json({ error: true, message: "DB Error", details: initError });

  // 1. Cek API Key
  const apiKey = String(req.headers["x-api-key"] || req.query.apiKey || "").trim();
  if (REQUIRED_API_KEY && apiKey !== REQUIRED_API_KEY) {
    return res.status(401).json({ error: true, message: "Unauthorized" });
  }

  try {
    const mode = req.query.mode || "home";
    const limitReq = Math.min(Number(req.query.limit) || 10, 50);
    const viewerId = req.query.viewerId || null;
    const cursorId = req.query.cursor || null;

    let queryRef = db.collection(POSTS_PATH);
    let isFollowingFallback = false;

    // 2. Logic Mode Following (Cek User dulu)
    if (mode === "following") {
      let followingIds = [];
      if (viewerId) {
        const viewerSnap = await db.doc(`${USERS_PATH}/${viewerId}`).get();
        if (viewerSnap.exists) {
            followingIds = viewerSnap.data().following || [];
        }
      }
      
      // Kalau punya following, filter. Kalau gak punya, jadi mode Home (fallback)
      if (followingIds.length > 0) {
        // Firestore 'in' query max 10 item, hati-hati disini. Ambil 10 pertama aja.
        queryRef = queryRef.where("userId", "in", followingIds.slice(0, 10));
      } else {
        isFollowingFallback = true;
      }
    }

    // 3. Logic Filter Biasa
    if (mode === "meme") queryRef = queryRef.where("category", "==", "meme");
    if (mode === "user" && req.query.userId) queryRef = queryRef.where("userId", "==", req.query.userId);

    // 4. SORTING UTAMA: Waktu (Terbaru)
    // Kita ambil buffer lebih banyak (limit * 2) biar bisa diacak isinya
    const fetchLimit = limitReq * 2; 
    queryRef = queryRef.orderBy("timestamp", "desc");

    if (cursorId) {
      const cursorDoc = await db.collection(POSTS_PATH).doc(cursorId).get();
      if (cursorDoc.exists) queryRef = queryRef.startAfter(cursorDoc);
    }

    const snap = await queryRef.limit(fetchLimit).get();

    // 5. DATA FETCHING
    let rawPosts = snap.docs.map(d => ({
      ...d.data(),
      id: d.id,
      timestamp: safeMillis(d.data()?.timestamp)
    }));

    // === FILTER: BUANG POSTINGAN KADALUARSA (Zaman Purba) ===
    // Kalau mode Home/Popular, buang yg lebih tua dari 3 bulan (MAX_POST_AGE_MS)
    if (mode === "home" || mode === "popular") {
        const cutoffTime = Date.now() - MAX_POST_AGE_MS;
        rawPosts = rawPosts.filter(p => p.timestamp > cutoffTime);
    }

    // Jika setelah difilter kosong, return kosong
    if (rawPosts.length === 0) {
      return res.json({ posts: [], nextCursor: null });
    }

    // 6. PROCESSING (ALGORITMA DISINI)
    let finalPosts = [];

    if (mode === "home" || isFollowingFallback) {
      // TEKNIK: "LOCAL SHUFFLE"
      // Kita sudah ambil data TERBARU dari DB.
      // Sekarang kita acak urutannya BIAR GAK BORING saat direfresh.
      // Tapi isinya tetap postingan-postingan baru.
      
      // Deduping (Max 2 post per user dalam satu layar)
      const userCounts = {};
      const uniquePosts = [];
      for (let p of rawPosts) {
        const uid = p.userId || "anon";
        if ((userCounts[uid] || 0) < 2) {
            uniquePosts.push(p);
            userCounts[uid] = (userCounts[uid] || 0) + 1;
        }
      }

      // ACAK HASILNYA! Ini kunci biar "pas direfresh urutan berubah"
      finalPosts = shuffle(uniquePosts);

    } else if (mode === "popular") {
      // Mode popular acak total
      finalPosts = shuffle(rawPosts);
    } else {
      // Mode User/Meme/Following asli tetep urut waktu biar rapi
      finalPosts = rawPosts;
    }

    // Potong sesuai limit yang diminta user (misal 10)
    finalPosts = finalPosts.slice(0, limitReq);

    // 7. AMBIL DATA USER (JOIN)
    const uids = [...new Set(finalPosts.map(p => p.userId).filter(Boolean))];
    const userMap = {};
    if (uids.length) {
      const userSnaps = await Promise.all(uids.map(id => db.doc(`${USERS_PATH}/${id}`).get()));
      userSnaps.forEach(s => { if (s.exists) userMap[s.id] = s.data(); });
    }

    const responsePosts = finalPosts.map(p => {
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

    // 8. NEXT CURSOR LOGIC (PENTING!)
    // Cursor harus nunjuk ke ID terakhir dari RAW DATA DATABASE (snap),
    // BUKAN hasil acakan. Biar scroll selanjutnya nyambung mulus.
    let nextCursor = null;
    
    // Logika: Jika jumlah data yg ditarik dari DB (sebelum filter/acak)
    // sama dengan batas fetchLimit, berarti masih ada data sisa di DB.
    if (snap.docs.length === fetchLimit) {
        const lastDoc = snap.docs[snap.docs.length - 1];
        nextCursor = lastDoc.id;
    } else {
        // Kalau DB ngasih kurang dari limit, berarti data sudah habis.
        nextCursor = null; 
    }

    res.json({
      posts: responsePosts,
      nextCursor
    });

  } catch (e) {
    console.error("FEED_ERROR:", e);
    res.status(500).json({ error: true, message: e.message });
  }
}