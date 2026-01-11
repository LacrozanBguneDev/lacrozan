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

// Fungsi acak murni untuk mode Popular
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

    // --- QUERY FIRESTORE (SELALU AMBIL TERBARU DULU) ---
    // Kita ambil buffer 3x limit untuk ruang gerak pengacakan/filtering
    const bufferSize = limitReq * 3;
    queryRef = queryRef.orderBy("timestamp", "desc");

    if (cursorId) {
      const cursorDoc = await db.collection(POSTS_PATH).doc(cursorId).get();
      if (cursorDoc.exists) queryRef = queryRef.startAfter(cursorDoc);
      else console.warn("Cursor not found:", cursorId);
    }

    const snap = await queryRef.limit(bufferSize).get();

    // Jika kosong, langsung return (kecuali mode following yg bisa fallback ke home logic)
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


    /* ================== LOGIKA FEED (THE BRAIN) ================== */
    let finalPosts = [];

    // KONDISI 1: BERANDA (HOME) - Harus Hidup, Beda-beda, tapi tetap Baru
    if (mode === "home" || (mode === "following" && isFollowingFallback)) {
      
      // Langkah A: Cegah Monoton User (Anti-Spam)
      // Jika User A posting 5 kali berurutan, kita ambil max 2 saja per batch, sisanya nanti
      let uniqueUserPosts = [];
      const userCountCheck = {};
      
      for (let p of allFetchedPosts) {
        const uid = p.userId || "anon";
        const currentCount = userCountCheck[uid] || 0;
        
        // Batasi maksimal 2 post dari user yg sama dalam satu tarikan feed
        // Kecuali postingan total memang sedikit (< 5), maka hajar saja semua
        if (currentCount < 2 || allFetchedPosts.length < 5) {
          uniqueUserPosts.push(p);
          userCountCheck[uid] = currentCount + 1;
        }
      }

      // Langkah B: Algoritma "Smart Jitter" (Acak Cerdas)
      // Kita tambahkan nilai random (0 s/d 2 jam) ke timestamp HANYA untuk sorting.
      // Efeknya: Postingan yang berdekatan waktunya akan teracak posisinya setiap refresh.
      // Tapi postingan kemarin tidak akan menyalip postingan hari ini.
      const JITTER_AMOUNT = 7200000; // 2 Jam dalam milidetik

      finalPosts = uniqueUserPosts.map(p => ({
        ...p,
        // Score sementara: Waktu asli + Random(0-2 jam)
        _sortScore: p.timestamp + (Math.random() * JITTER_AMOUNT)
      })).sort((a, b) => b._sortScore - a._sortScore); // Urutkan berdasarkan score acak tadi

    } 
    // KONDISI 2: POPULAR - Acak Total (Untuk eksplorasi)
    else if (mode === "popular") {
      finalPosts = shuffle(allFetchedPosts);
    } 
    // KONDISI 3: LAINNYA (Meme, User Profile, Following Asli) - WAJIB URUT WAKTU
    else {
      // Tidak diapa-apain, murni urutan timestamp desc dari database
      finalPosts = allFetchedPosts;
    }

    // Potong sesuai limit request
    let result = finalPosts.slice(0, limitReq);


    /* ================== GET USER DATA ================== */
    const uids = [...new Set(result.map(p => p.userId).filter(Boolean))];
    const userMap = {};
    if (uids.length) {
      const userSnaps = await Promise.all(
        uids.map(id => db.doc(`${USERS_PATH}/${id}`).get())
      );
      userSnaps.forEach(s => {
        if (s.exists) userMap[s.id] = s.data();
      });
    }

    let postsResponse = result.map(p => {
      const u = userMap[p.userId] || {};
      // Hapus properti internal _sortScore sebelum dikirim ke frontend
      delete p._sortScore; 
      
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
            // Tambahkan postingan eksternal ke bawah
            postsResponse.push(...extData.posts);
          }
        }
      } catch (err) {
        console.warn("External feed fetch error:", err);
      }
    }

    // Potong lagi jaga-jaga kalau ada tambahan dari eksternal
    postsResponse = postsResponse.slice(0, limitReq);

    /* ================== NEXT CURSOR LOGIC ================== */
    // Logic cursor diperbaiki agar infinite scroll mulus
    const lastDocInSnap = snap.docs[snap.docs.length - 1];
    
    // Jika kita mengambil dari database (bukan hasil shuffle popular total)
    // Cursor idealnya adalah ID dari item terakhir di buffer database, 
    // bukan item terakhir yang ditampilkan (karena urutan ditampilkan sudah diacak dikit).
    let nextCursor = null;
    
    if (allFetchedPosts.length >= bufferSize) {
        // Masih ada data di DB
        nextCursor = lastDocInSnap?.id || null;
    } else {
        // Data DB habis
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