import admin from "firebase-admin";
import { CONFIG } from './config.js'; // Import config rahasia backend

/* ================== KONFIGURASI & INISIALISASI ================== */
const REQUIRED_API_KEY = process.env.FEED_API_KEY?.trim() || CONFIG.FEED_API_KEY || null;

let db = null;
let initError = null;

const POSTS_PATH = "artifacts/default-app-id/public/data/posts";
const USERS_PATH = "artifacts/default-app-id/public/data/userProfiles";

const getServiceAccount = () => {
  const rawEnv = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!rawEnv) throw new Error("Environment Variable FIREBASE_SERVICE_ACCOUNT tidak ditemukan/kosong.");

  let serviceAccount;
  try {
    serviceAccount = JSON.parse(rawEnv);
  } catch {
    try {
      const decoded = Buffer.from(rawEnv, 'base64').toString('utf-8');
      serviceAccount = JSON.parse(decoded);
    } catch {
      throw new Error("Format FIREBASE_SERVICE_ACCOUNT tidak valid.");
    }
  }

  if (!serviceAccount.private_key) throw new Error("Properti 'private_key' tidak ditemukan.");
  // Fix newline di private key
  serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, "\n");

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
  initError = err.message || "Unknown Initialization Error";
}

/* ================== UTILITAS ================== */
const safeMillis = ts => {
  if (!ts) return Date.now();
  if (typeof ts.toMillis === "function") return ts.toMillis();
  if (ts._seconds) return ts._seconds * 1000;
  return Number(ts) || Date.now();
};

// Fungsi acak (Shuffle) Fisher-Yates
const shuffle = arr => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/* ================== HANDLER UTAMA ================== */
export default async function handler(req, res) {
  // 1. Cek Firestore
  if (!db) {
    return res.status(500).json({
      error: true,
      message: "Firestore not initialized",
      details: initError
    });
  }

  /* ================== VALIDASI API KEY ================== */
  const apiKey = String(req.headers["x-api-key"] || req.query.apiKey || "").trim();

  if (REQUIRED_API_KEY && apiKey && apiKey !== REQUIRED_API_KEY) {
    return res.status(401).json({
      error: true,
      message: "API key invalid"
    });
  }

  try {
    const mode = req.query.mode || "home";
    const limitReq = Math.min(Number(req.query.limit) || 10, 50);
    const viewerId = req.query.viewerId || null;
    const cursorId = req.query.cursor || null;

    let queryRef = db.collection(POSTS_PATH);
    let followingIds = null;
    let isFollowingFallback = false;

    // --- SETUP MODE FOLLOWING ---
    if (mode === "following") {
      if (!viewerId) isFollowingFallback = true;
      else {
        const viewerSnap = await db.doc(`${USERS_PATH}/${viewerId}`).get();
        if (!viewerSnap.exists) isFollowingFallback = true;
        else {
          const viewerData = viewerSnap.data() || {};
          followingIds = Array.isArray(viewerData.following) ?
            viewerData.following.slice(0, 10) : []; 
          
          if (!followingIds.length) isFollowingFallback = true;
        }
      }
    }

    // --- FILTER QUERY ---
    if (mode === "meme") queryRef = queryRef.where("category", "==", "meme");
    if (mode === "user" && req.query.userId)
      queryRef = queryRef.where("userId", "==", req.query.userId);
    
    if (mode === "following" && followingIds?.length && !isFollowingFallback) {
      queryRef = queryRef.where("userId", "in", followingIds);
    }

    // --- STRATEGI AGGRESSIVE SAMPLING ---
    // Kita ambil 3x lipat dari yang diminta user.
    // Misal user minta 10, kita ambil 30.
    // 10 kita tampilkan (diacak), 20 sisanya kita "buang" (skip) agar next page langsung fresh beda waktu.
    const fetchBufferSize = limitReq * 3; 
    
    queryRef = queryRef.orderBy("timestamp", "desc");

    if (cursorId) {
      const cursorDoc = await db.collection(POSTS_PATH).doc(cursorId).get();
      if (cursorDoc.exists) queryRef = queryRef.startAfter(cursorDoc);
    }

    const snap = await queryRef.limit(fetchBufferSize).get();

    if (snap.empty && mode !== "following") {
      return res.json({ posts: [], nextCursor: null });
    }

    let rawPosts = snap.docs.map(d => ({
      ...d.data(),
      id: d.id,
      timestamp: safeMillis(d.data()?.timestamp)
    }));

    /* ================== LOGIKA PENGACAKAN (THE MIXER) ================== */
    let finalPosts = [];

    if (mode === "home" || (mode === "following" && isFollowingFallback)) {
      
      const userPostCount = {};
      const uniquePosts = [];

      // 1. Filter Spam Ketat
      for (const p of rawPosts) {
        const uid = p.userId || "anon";
        const count = userPostCount[uid] || 0;
        // Hanya izinkan 1 post per user per batch load agar variatif
        // Kecuali datanya sedikit, baru boleh 2.
        const maxPerUser = rawPosts.length < 10 ? 2 : 1;
        
        if (count < maxPerUser) {
          uniquePosts.push(p);
          userPostCount[uid] = count + 1;
        }
      }

      // 2. Fresh Boost Strategy
      // Ambil 3 postingan teratas (Wajib Paling Baru) agar user tau update terkini
      const freshCount = 3; 
      
      const superFresh = uniquePosts.slice(0, freshCount); // Tetap di atas
      const toShuffle = uniquePosts.slice(freshCount);     // Sisanya

      // Acak total sisa data
      const shuffledRest = shuffle(toShuffle);

      // Gabungkan
      finalPosts = [...superFresh, ...shuffledRest];

    } 
    else if (mode === "popular") {
      finalPosts = shuffle(rawPosts);
    } 
    else {
      finalPosts = rawPosts;
    }

    // Potong sesuai limit request (misal 10)
    let postsResponse = finalPosts.slice(0, limitReq);


    /* ================== JOIN USER DATA ================== */
    const uids = [...new Set(postsResponse.map(p => p.userId).filter(Boolean))];
    const userMap = {};
    
    if (uids.length) {
      const userSnaps = await Promise.all(
        uids.map(id => db.doc(`${USERS_PATH}/${id}`).get())
      );
      userSnaps.forEach(s => {
        if (s.exists) userMap[s.id] = s.data();
      });
    }

    postsResponse = postsResponse.map(p => {
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

    /* ================== EXTERNAL FEED ================== */
    if (CONFIG.FEED_API_URL && CONFIG.FEED_API_KEY) {
      try {
        const extRes = await fetch(`${CONFIG.FEED_API_URL}?key=${CONFIG.FEED_API_KEY}`);
        if (extRes.ok) {
          const extData = await extRes.json();
          if (Array.isArray(extData.posts)) {
            // Selipkan data external di posisi acak (index 2 atau 3)
            const insertIdx = Math.floor(Math.random() * 3) + 1;
            postsResponse.splice(insertIdx, 0, ...extData.posts.slice(0,2));
            // Potong lagi biar rapi
            postsResponse = postsResponse.slice(0, limitReq);
          }
        }
      } catch (err) {
        // Silent error
      }
    }

    /* ================== NEXT CURSOR LOGIC (FAST FORWARD) ================== */
    // KUNCI BIAR GAK MONOTON:
    // Kita arahkan cursor ke dokumen TERAKHIR dari buffer besar yang kita ambil (fetchBufferSize).
    // Artinya, saat user minta "Next Page", kita melompati data-data yang tidak terpilih tadi.
    // Ini membuat timeline bergerak lebih cepat mundur ke belakang (24h -> 2 days ago -> dst).
    
    let nextCursor = null;
    
    // Cek apakah data dari DB sebenarnya masih ada?
    if (snap.docs.length >= limitReq) {
      const lastDocInBuffer = snap.docs[snap.docs.length - 1];
      nextCursor = lastDocInBuffer ? lastDocInBuffer.id : null;
    }

    res.status(200).json({
      posts: postsResponse,
      nextCursor
    });

  } catch (e) {
    console.error("FEED_ERROR:", e);
    res.status(500).json({
      error: true,
      message: e.message || "Unknown runtime error"
    });
  }
}