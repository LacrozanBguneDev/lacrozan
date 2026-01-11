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
  serviceAccount.private_key = serviceAccount.private_key.replace(/\n/g, "\n");

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

// Fungsi acak murni HANYA untuk mode Popular (Eksplorasi)
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
  /* ====================================================== */

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
    if (mode === "following" && followingIds?.length && !isFollowingFallback)
      queryRef = queryRef.where("userId", "in", followingIds);

    // --- QUERY FIRESTORE ---
    // Buffer lebih besar (limit * 3) untuk memfilter spam user tanpa kehabisan stok
    const bufferSize = limitReq * 3;
    queryRef = queryRef.orderBy("timestamp", "desc");

    if (cursorId) {
      const cursorDoc = await db.collection(POSTS_PATH).doc(cursorId).get();
      if (cursorDoc.exists) queryRef = queryRef.startAfter(cursorDoc);
      else console.warn("Cursor not found, starting from top:", cursorId);
    }

    const snap = await queryRef.limit(bufferSize).get();

    // Jika kosong
    if (snap.empty && mode !== "following") {
      return res.json({
        posts: [],
        nextCursor: null
      });
    }

    const allFetchedPosts = snap.docs.map(d => ({
      ...d.data(),
      id: d.id,
      timestamp: safeMillis(d.data()?.timestamp)
    }));


    /* ================== LOGIKA FEED (THE BRAIN - FIXED) ================== */
    let finalPosts = [];

    // KONDISI 1: BERANDA (HOME) - Prioritas Waktu + Variasi User
    if (mode === "home" || (mode === "following" && isFollowingFallback)) {
      
      const userPostCounts = {};
      const filteredPosts = [];

      // Algoritma: Anti-Spam Linear
      // Urutan waktu TETAP DIPERTAHANKAN (karena allFetchedPosts sudah sorted by time)
      // Kita hanya membuang (skip) postingan berlebih dari user yang sama
      
      for (const p of allFetchedPosts) {
        const uid = p.userId || "anon";
        const currentCount = userPostCounts[uid] || 0;

        // MAX 2 POST per user per batch load
        // Kecuali jika feed sangat sepi (kurang dari 5 post total), biarkan saja
        if (currentCount < 2 || allFetchedPosts.length < 5) {
          filteredPosts.push(p);
          userPostCounts[uid] = currentCount + 1;
        }
      }

      // Potong sesuai limit request (misal minta 10, kita punya buffer 30, disaring jadi 15, ambil 10)
      finalPosts = filteredPosts.slice(0, limitReq);

    } 
    // KONDISI 2: POPULAR - Acak Total (Untuk eksplorasi, waktu tidak masalah)
    else if (mode === "popular") {
      finalPosts = shuffle(allFetchedPosts).slice(0, limitReq);
    } 
    // KONDISI 3: LAINNYA (Meme, User Profile, Following Asli) - MURNI URUT WAKTU
    else {
      finalPosts = allFetchedPosts.slice(0, limitReq);
    }


    /* ================== GET USER DATA ================== */
    const uids = [...new Set(finalPosts.map(p => p.userId).filter(Boolean))];
    const userMap = {};
    if (uids.length) {
      const userSnaps = await Promise.all(
        uids.map(id => db.doc(`${USERS_PATH}/${id}`).get())
      );
      userSnaps.forEach(s => {
        if (s.exists) userMap[s.id] = s.data();
      });
    }

    let postsResponse = finalPosts.map(p => {
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

    /* ================== FETCH SERVER-TO-SERVER (OPTIONAL) ================== */
    if (CONFIG.FEED_API_URL && CONFIG.FEED_API_KEY) {
      try {
        const extRes = await fetch(
          `${CONFIG.FEED_API_URL}?key=${CONFIG.FEED_API_KEY}`
        );
        if (extRes.ok) {
          const extData = await extRes.json();
          if (Array.isArray(extData.posts)) {
            // Push data eksternal (pastikan struktur datanya cocok)
            postsResponse.push(...extData.posts);
          }
        }
      } catch (err) {
        console.warn("External feed fetch error:", err);
      }
    }

    // Final slice just in case external posts made it too long
    postsResponse = postsResponse.slice(0, limitReq);

    /* ================== NEXT CURSOR LOGIC (FIXED) ================== */
    // Cursor HARUS menunjuk ke item terakhir yang DIAMBIL DARI DB (snap),
    // BUKAN item terakhir yang ditampilkan ke user.
    // Ini menjamin scroll berikutnya melanjutkan dari posisi database yang benar.
    
    let nextCursor = null;
    
    // Jika jumlah yang diambil dari DB sama dengan bufferSize, 
    // berarti kemungkinan masih ada data sisa di DB.
    if (snap.docs.length === bufferSize) {
      const lastDoc = snap.docs[snap.docs.length - 1];
      nextCursor = lastDoc.id;
    } else {
      // Data habis
      nextCursor = null; 
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