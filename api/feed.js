import admin from "firebase-admin";
import { CONFIG } from './config.js';

/* ================== KONFIGURASI & INISIALISASI ================== */
const REQUIRED_API_KEY = process.env.FEED_API_KEY?.trim() || CONFIG.FEED_API_KEY || null;

let db = null;
let initError = null;

// Path database kamu (JANGAN DIUBAH)
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

/* ===== 1. BERSIHKAN DUPLIKAT BERDASARKAN ID ===== */
const uniqueById = (posts) => {
  const seen = new Set();
  return posts.filter(p => {
    if (!p || !p.id) return false;
    if (seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });
};

/* ===== 2. AMBIL DATA USER (FIX FOTO PROFIL) ===== */
const enrichPostsWithUsers = async (posts) => {
  if (!posts || posts.length === 0) return [];

  // Ambil semua userId unik dari list post
  const userIds = [...new Set(posts.map(p => p.userId).filter(Boolean))];

  if (userIds.length === 0) return posts;

  // Fetch data user secara parallel (Cepat)
  const userDocsPromise = userIds.map(uid => 
    db.collection(USERS_PATH).doc(uid).get()
      .then(snap => ({ id: uid, data: snap.exists ? snap.data() : null }))
      .catch(() => ({ id: uid, data: null }))
  );

  const userResults = await Promise.all(userDocsPromise);
  
  // Buat map: userId -> userData
  const userMap = {};
  userResults.forEach(res => {
    if (res.data) userMap[res.id] = res.data;
  });

  // Tempel data user ke post
  return posts.map(p => {
    const user = userMap[p.userId];
    
    // Jika user ketemu di DB, pakai datanya. 
    // Jika tidak, pakai data sisa yang nempel di post (fallback).
    // Jika tidak ada juga, biarkan null (Frontend yang handle).
    
    // Mapping field yang mungkin dipakai frontend
    const finalName = user?.displayName || user?.username || user?.name || p.authorName || p.userName || null;
    const finalAvatar = user?.photoURL || user?.avatar || user?.profilePic || p.authorAvatar || p.userAvatar || null;
    const isVerified = user?.isVerified || p.authorVerified || false;

    return {
      ...p,
      // Standarisasi output ke frontend
      authorName: finalName, 
      authorAvatar: finalAvatar, 
      authorVerified: isVerified,
      
      // Simpan field lama jaga-jaga frontend pakai nama lain
      userAvatar: finalAvatar,
      userName: finalName,
      photoURL: finalAvatar
    };
  });
};

/* ================== HANDLER UTAMA ================== */
export default async function handler(req, res) {
  if (!db) {
    return res.status(500).json({ error: true, message: "Firestore not initialized" });
  }

  const apiKey = String(req.headers["x-api-key"] || req.query.apiKey || "").trim();
  if (REQUIRED_API_KEY && apiKey && apiKey !== REQUIRED_API_KEY) {
    return res.status(401).json({ error: true, message: "API key invalid" });
  }

  try {
    const mode = req.query.mode || "home";
    const limitReq = Math.min(Number(req.query.limit) || 10, 50);
    const cursorId = req.query.cursor || null;
    const viewerId = req.query.viewerId || null;

    let queryRef = db.collection(POSTS_PATH);
    
    // --- LOGIC FILTERING ---
    if (mode === "meme") {
      queryRef = queryRef.where("category", "==", "meme");
    } 
    else if (mode === "user" && req.query.userId) {
      queryRef = queryRef.where("userId", "==", req.query.userId);
    }
    else if (mode === "following") {
      // Logic Following sederhana
      let followingIds = [];
      if (viewerId) {
        const viewerSnap = await db.doc(`${USERS_PATH}/${viewerId}`).get();
        if (viewerSnap.exists) {
          const vData = viewerSnap.data();
          followingIds = Array.isArray(vData.following) ? vData.following.slice(0, 10) : [];
        }
      }
      
      if (followingIds.length > 0) {
        queryRef = queryRef.where("userId", "in", followingIds);
      } else {
        // Fallback: Jika tidak follow siapa-siapa, kembalikan ke mode home biasa
        // Tidak perlu filter where
      }
    }

    // --- LOGIC UTAMA (ANTI DUPLIKAT & ANTI NYANGKUT) ---
    // Gunakan murni Timestamp Descending.
    // Ini menjamin postingan baru muncul duluan, dan saat scroll urutannya konsisten.
    
    let mainQuery = queryRef.orderBy("timestamp", "desc");

    // Pagination Logic
    if (cursorId) {
      const cursorDoc = await db.collection(POSTS_PATH).doc(cursorId).get();
      if (cursorDoc.exists) {
        mainQuery = mainQuery.startAfter(cursorDoc);
      } else {
        // Jika cursor tidak valid (misal postingan dihapus), reset cursor (start from top)
        // atau return kosong. Di sini kita return kosong agar frontend stop loading.
        return res.status(200).json({ posts: [], nextCursor: null });
      }
    }

    // Eksekusi Query
    const snapshot = await mainQuery.limit(limitReq).get();

    // Mapping awal data dari Firestore
    let rawPosts = snapshot.docs.map(d => ({
      ...d.data(),
      id: d.id,
      timestamp: safeMillis(d.data()?.timestamp)
    }));

    // --- FINAL PROCESSING ---

    // 1. Bersihkan Duplikat (Jaga-jaga)
    let finalPosts = uniqueById(rawPosts);

    // 2. Tempel Data User (Foto Profil)
    finalPosts = await enrichPostsWithUsers(finalPosts);

    // 3. Set Next Cursor
    let nextCursor = null;
    if (snapshot.docs.length > 0) {
      // Ambil ID dokumen terakhir sebagai cursor berikutnya
      nextCursor = snapshot.docs[snapshot.docs.length - 1].id;
    }

    res.status(200).json({
      posts: finalPosts,
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