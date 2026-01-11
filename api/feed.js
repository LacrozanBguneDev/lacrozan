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

    // --- INTI ALGORITMA: PENGAMBILAN DATA ---
    // Mengambil buffer secukupnya (limit + sedikit spare) agar timeline tidak lompat jauh
    const fetchBufferSize = limitReq + 5; 
    
    // WAJIB: Selalu urutkan berdasarkan waktu terbaru (DESC)
    // Ini menjamin urutan: 24 jam terakhir -> kemarin -> bulan lalu -> dst
    queryRef = queryRef.orderBy("timestamp", "desc");

    if (cursorId) {
      const cursorDoc = await db.collection(POSTS_PATH).doc(cursorId).get();
      if (cursorDoc.exists) queryRef = queryRef.startAfter(cursorDoc);
    }

    // Eksekusi Query ke Database
    const snap = await queryRef.limit(fetchBufferSize).get();

    // Jika data habis/kosong
    if (snap.empty && mode !== "following") {
      return res.json({
        posts: [],
        nextCursor: null
      });
    }

    // Ubah data snapshot ke format JSON bersih
    let rawPosts = snap.docs.map(d => ({
      ...d.data(),
      id: d.id,
      timestamp: safeMillis(d.data()?.timestamp)
    }));

    /* ================== LOGIKA "ALIVE" FEED (DIPERBAIKI) ================== */
    let finalPosts = [];

    // KONDISI 1: HOME (BERANDA) & FOLLOWING FALLBACK
    // Algoritma Baru: Freshness Boost + Random Tail
    if (mode === "home" || (mode === "following" && isFollowingFallback)) {
      
      const userPostCount = {};
      const uniquePosts = [];

      // A. Filter Anti-Spam (Maksimal 2 post per user dalam satu batch load)
      for (const p of rawPosts) {
        const uid = p.userId || "anon";
        const count = userPostCount[uid] || 0;
        
        if (count < 2 || rawPosts.length < 5) {
          uniquePosts.push(p);
          userPostCount[uid] = count + 1;
        }
      }

      // B. LOGIC BARU: "Fresh Boost"
      // Data sudah urut waktu (DESC). Kita ambil bagian paling atas (terbaru).
      // Misal: 30% data teratas (atau min 2 postingan) JANGAN DIACAK (Boost).
      // Sisanya baru diacak biar terasa "beda" tapi tidak menghilangkan barang baru.
      
      const boostAmount = Math.max(2, Math.floor(uniquePosts.length * 0.3)); 
      
      const freshBatch = uniquePosts.slice(0, boostAmount); // Bagian Paling Baru (Boost)
      const mixBatch = uniquePosts.slice(boostAmount);      // Bagian Agak Lama (Acak)

      // Gabungkan: [Terbaru Tetap] + [Sisanya Diacak]
      finalPosts = [...freshBatch, ...shuffle(mixBatch)];

    } 
    // KONDISI 2: POPULAR (Eksplorasi Total)
    else if (mode === "popular") {
      finalPosts = shuffle(rawPosts);
    } 
    // KONDISI 3: PROFILE / MEME / FOLLOWING ASLI
    else {
      finalPosts = rawPosts;
    }

    // Potong hasil akhir sesuai limit yang diminta user
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

    // Gabungkan data post dengan data user
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
            // Masukkan data eksternal secara acak ke dalam feed
            const combined = [...postsResponse, ...extData.posts];
            postsResponse = combined.slice(0, limitReq); // Potong lagi biar pas limit
          }
        }
      } catch (err) {
        console.warn("External feed fetch error:", err);
      }
    }

    /* ================== NEXT CURSOR LOGIC ================== */
    // Cursor harus menunjuk ke dokumen terakhir yang diambil dari DATABASE (snap),
    // BUKAN dari hasil acakan (postsResponse). Ini menjaga urutan waktu timeline.
    
    let nextCursor = null;
    
    // Kita cek apakah masih ada data di DB?
    if (snap.docs.length > 0) {
      // Ambil ID dari dokumen terakhir yang kita fetch dari DB
      const lastDocInBatch = snap.docs[snap.docs.length - 1];
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