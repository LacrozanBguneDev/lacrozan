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

// Fungsi acak (Shuffle) untuk membuat feed terasa hidup
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
    // Batasi limit agar tidak memberatkan loading (default 10)
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
            viewerData.following.slice(0, 10) : []; // Max 10 following untuk query 'in'
          
          if (!followingIds.length) isFollowingFallback = true;
        }
      }
    }

    // --- FILTER QUERY ---
    // Mode Meme & User Filter
    if (mode === "meme") queryRef = queryRef.where("category", "==", "meme");
    if (mode === "user" && req.query.userId)
      queryRef = queryRef.where("userId", "==", req.query.userId);
    
    // Mode Following Asli
    if (mode === "following" && followingIds?.length && !isFollowingFallback) {
      queryRef = queryRef.where("userId", "in", followingIds);
    }

    // --- INTI ALGORITMA: PENGAMBILAN DATA (5 FRESH + 5 RANDOM) ---
    const freshLimit = Math.ceil(limitReq / 2);
    const legacyLimit = limitReq - freshLimit;

    let finalRawPosts = [];
    let snapForCursor = null;

    if (mode === "home" || (mode === "following" && isFollowingFallback)) {
      // AMBIL DATA TERBARU (FRESH)
      let freshQuery = queryRef.orderBy("timestamp", "desc");
      if (cursorId) {
        const cursorDoc = await db.collection(POSTS_PATH).doc(cursorId).get();
        if (cursorDoc.exists) freshQuery = freshQuery.startAfter(cursorDoc);
      }
      const freshSnap = await freshQuery.limit(freshLimit).get();
      snapForCursor = freshSnap; // Cursor ikut data fresh

      const freshPosts = freshSnap.docs.map(d => ({
        ...d.data(), id: d.id, timestamp: safeMillis(d.data()?.timestamp)
      }));

      // AMBIL DATA ACAK (LEGACY) DARI 100 TERAKHIR
      const legacySnap = await db.collection(POSTS_PATH).orderBy("timestamp", "desc").limit(100).get();
      let allLegacy = legacySnap.docs.map(d => ({
        ...d.data(), id: d.id, timestamp: safeMillis(d.data()?.timestamp)
      }));
      
      const freshIds = new Set(freshPosts.map(p => p.id));
      allLegacy = allLegacy.filter(p => !freshIds.has(p.id));
      const randomLegacy = shuffle(allLegacy).slice(0, legacyLimit);

      finalRawPosts = [...freshPosts, ...randomLegacy];
    } else {
      // MODE LAIN (Meme, User, Following Asli) - Tetap Normal
      let normalQuery = queryRef.orderBy("timestamp", "desc");
      if (cursorId) {
        const cursorDoc = await db.collection(POSTS_PATH).doc(cursorId).get();
        if (cursorDoc.exists) normalQuery = normalQuery.startAfter(cursorDoc);
      }
      const normalSnap = await normalQuery.limit(limitReq).get();
      snapForCursor = normalSnap;
      finalRawPosts = normalSnap.docs.map(d => ({
        ...d.data(), id: d.id, timestamp: safeMillis(d.data()?.timestamp)
      }));
    }

    /* ================== LOGIKA "ALIVE" FEED ================== */
    let finalPosts = [];

    if (mode === "home" || (mode === "following" && isFollowingFallback)) {
      const userPostCount = {};
      const uniquePosts = [];

      for (const p of finalRawPosts) {
        const uid = p.userId || "anon";
        const count = userPostCount[uid] || 0;
        if (count < 2 || finalRawPosts.length < 5) {
          uniquePosts.push(p);
          userPostCount[uid] = count + 1;
        }
      }
      finalPosts = shuffle(uniquePosts); // Acak lagi hasil blend tadi biar makin liar
    } 
    else if (mode === "popular") {
      finalPosts = shuffle(finalRawPosts);
    } 
    else {
      finalPosts = finalRawPosts;
    }

    let postsResponse = finalPosts.slice(0, limitReq);

    /* ================== GET USER DATA (JOIN) ================== */
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

    /* ================== FETCH SERVER EKSTERNAL (OPSIONAL) ================== */
    if (CONFIG.FEED_API_URL && CONFIG.FEED_API_KEY) {
      try {
        const extRes = await fetch(`${CONFIG.FEED_API_URL}?key=${CONFIG.FEED_API_KEY}`);
        if (extRes.ok) {
          const extData = await extRes.json();
          if (Array.isArray(extData.posts)) {
            postsResponse.push(...extData.posts);
          }
        }
      } catch (err) {
        console.warn("External feed fetch error:", err);
      }
    }

    postsResponse = postsResponse.slice(0, limitReq);

    /* ================== NEXT CURSOR LOGIC ================== */
    let nextCursor = null;
    if (snapForCursor && !snapForCursor.empty) {
      const lastDocInBatch = snapForCursor.docs[snapForCursor.docs.length - 1];
      nextCursor = lastDocInBatch ? lastDocInBatch.id : null;
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