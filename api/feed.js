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
    // Kita mengambil data 3x lebih banyak dari yang diminta (Buffer)
    // Tujuannya: Agar kita bisa mengacak urutan "Barang Baru" tanpa mengambil barang lama.
    const fetchBufferSize = limitReq * 3; 
    
    // WAJIB: Selalu urutkan berdasarkan waktu terbaru (DESC)
    // Ini menjamin tidak ada postingan 1 bulan lalu muncul di atas
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

    /* ================== LOGIKA "ALIVE" FEED ================== */
    let finalPosts = [];

    // KONDISI 1: HOME (BERANDA) & FOLLOWING FALLBACK
    // Algoritma: Ambil yang TERBARU -> Saring Spam -> Acak Sedikit Biar Segar
    if (mode === "home" || (mode === "following" && isFollowingFallback)) {
      
      const userPostCount = {};
      const uniquePosts = [];

      // A. Filter Anti-Spam (Jangan sampai 1 user memenuhi beranda)
      for (const p of rawPosts) {
        const uid = p.userId || "anon";
        const count = userPostCount[uid] || 0;
        
        // Ambil max 2 post per user per loading, kecuali kalau datanya dikit banget
        if (count < 2 || rawPosts.length < 5) {
          uniquePosts.push(p);
          userPostCount[uid] = count + 1;
        }
      }

      // B. The "Alive" Factor (Pengacakan Lokal)
      // Kita sudah pegang daftar postingan TERBARU. Sekarang kita acak posisinya.
      // Efek: User refresh -> Isi tetap baru, tapi urutan beda. Gak bosenin.
      finalPosts = shuffle(uniquePosts);

    } 
    // KONDISI 2: POPULAR (Eksplorasi Total)
    else if (mode === "popular") {
      // Acak total dari buffer yang diambil
      finalPosts = shuffle(rawPosts);
    } 
    // KONDISI 3: PROFILE / MEME / FOLLOWING ASLI
    else {
      // Jangan diacak, biarkan urut waktu murni (kronologis)
      finalPosts = rawPosts;
    }

    // Potong hasil akhir sesuai limit yang diminta (misal 10)
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
            postsResponse.push(...extData.posts);
          }
        }
      } catch (err) {
        console.warn("External feed fetch error:", err);
      }
    }

    // Pastikan tidak melebihi limit setelah digabung eksternal
    postsResponse = postsResponse.slice(0, limitReq);

    /* ================== NEXT CURSOR LOGIC (CRITICAL FIX) ================== */
    // Masalah scroll lompat/aneh diperbaiki disini.
    // Cursor harus menunjuk ke dokumen terakhir di DATABASE (snap), bukan di hasil acakan.
    
    let nextCursor = null;
    
    // Cek apakah kita masih punya data di DB?
    // Jika jumlah dokumen yang ditarik (snap) sama dengan yang kita minta (fetchBufferSize),
    // berarti kemungkinan besar masih ada data berikutnya.
    if (snap.docs.length >= limitReq) {
      // Ambil ID dari dokumen terakhir yang benar-benar diambil dari DB
      const lastDocInBatch = snap.docs[snap.docs.length - 1];
      nextCursor = lastDocInBatch ? lastDocInBatch.id : null;
    } else {
      nextCursor = null; // Data habis
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