import admin from "firebase-admin";
import { CONFIG } from './config.js';

/* ================== KONFIGURASI & INISIALISASI ================== */
const REQUIRED_API_KEY = process.env.FEED_API_KEY?.trim() || CONFIG.FEED_API_KEY || null;

// URL Default jika user tidak punya foto / error (Gambar User Polos Abu-abu)
const DEFAULT_AVATAR = "https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png";

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

/* ================== UTILITAS (HELPER) ================== */

// 1. Format Waktu Aman
const safeMillis = ts => {
  if (!ts) return Date.now();
  if (typeof ts.toMillis === "function") return ts.toMillis();
  if (ts._seconds) return ts._seconds * 1000;
  return Number(ts) || Date.now();
};

// 2. Acak Array (Shuffle) - Biar feed variatif
const shuffleArray = (array) => {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
};

// 3. Bersihkan Duplikat ID
const uniqueById = (posts) => {
  const seen = new Set();
  return posts.filter(p => {
    if (!p || !p.id) return false;
    if (seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });
};

// 4. Filter Spam User (Max 2 post per user per batch)
const filterSpamUsers = (posts, maxPerUser = 2) => {
  const userCount = {};
  return posts.filter(p => {
    const uid = p.userId || "anon";
    if (!userCount[uid]) userCount[uid] = 0;
    
    if (userCount[uid] >= maxPerUser) {
      return false; // Skip
    }
    userCount[uid]++;
    return true;
  });
};

/* ===== FUNGSI INTI: FORCE UPDATE DATA USER ===== */
const enrichPostsWithUsers = async (posts) => {
  if (!posts || posts.length === 0) return [];

  const userIds = [...new Set(posts.map(p => p.userId).filter(Boolean))];
  if (userIds.length === 0) return posts;

  // Fetch data user TERBARU
  const fetchPromises = userIds.map(uid => 
    db.collection(USERS_PATH).doc(uid).get()
      .then(snap => ({ id: uid, data: snap.exists ? snap.data() : null }))
      .catch(() => ({ id: uid, data: null }))
  );

  const userResults = await Promise.all(fetchPromises);
  const userMap = {};
  userResults.forEach(res => {
    if (res.data) userMap[res.id] = res.data;
  });

  return posts.map(p => {
    const freshUser = userMap[p.userId];
    
    // 1. Ambil Nama (Prioritas: DB Terbaru > Postingan Lama > Default)
    const finalName = freshUser?.displayName || freshUser?.username || freshUser?.name || p.authorName || p.userName || "Unknown User";
    
    // 2. Ambil Foto (Prioritas: DB Terbaru > Postingan Lama > DEFAULT AVATAR)
    // Kita cek semua kemungkinan key di database
    let rawAvatar = freshUser?.photoURL || freshUser?.avatar || freshUser?.profilePic || freshUser?.image || freshUser?.profileImage || p.authorAvatar || p.userAvatar;
    
    // Jika masih kosong/null, PAKSA pakai Default Avatar
    const finalAvatar = rawAvatar ? rawAvatar : DEFAULT_AVATAR;

    const isVerified = freshUser?.isVerified ?? p.authorVerified ?? false;

    // 3. KONSTRUKSI OBJEK BARU
    // Kita timpa di level ROOT dan level OBJECT (author/user) agar frontend pasti membacanya
    
    // Copy postingan asli
    const updatedPost = { 
      ...p,
      // Update Root Fields (Standar Umum)
      authorName: finalName,
      userName: finalName,
      displayName: finalName,
      
      authorAvatar: finalAvatar,
      userAvatar: finalAvatar,
      photoURL: finalAvatar,
      avatar: finalAvatar,       // Sering dipakai frontend simple
      
      authorVerified: isVerified,
      isVerified: isVerified
    };

    // Update Nested Objects (Jika frontend membaca post.author.avatar)
    if (!updatedPost.author) updatedPost.author = {};
    updatedPost.author = {
        ...updatedPost.author,
        name: finalName,
        displayName: finalName,
        avatar: finalAvatar,
        photoURL: finalAvatar,
        isVerified: isVerified
    };

    // Update Nested Objects (Jika frontend membaca post.user.avatar)
    if (!updatedPost.user) updatedPost.user = {};
    updatedPost.user = {
        ...updatedPost.user,
        name: finalName,
        displayName: finalName,
        avatar: finalAvatar,
        photoURL: finalAvatar,
        isVerified: isVerified
    };

    return updatedPost;
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
    const searchQuery = req.query.q || req.query.search || null;
    const limitReq = Math.min(Number(req.query.limit) || 10, 50);
    const cursorId = req.query.cursor || null;
    const viewerId = req.query.viewerId || null;

    let postsCollection = db.collection(POSTS_PATH);
    let rawPosts = [];
    let nextCursor = null;

    // --- MODE SEARCH ---
    if (searchQuery) {
        const searchSnapshot = await postsCollection
            .where('text', '>=', searchQuery)
            .where('text', '<=', searchQuery + '\uf8ff')
            .limit(limitReq)
            .get();
        rawPosts = searchSnapshot.docs.map(d => ({ ...d.data(), id: d.id, timestamp: safeMillis(d.data()?.timestamp) }));
    }

    // --- MODE USER / MEME / FOLLOWING ---
    else if (mode === "user" || mode === "meme" || mode === "following") {
        let query = postsCollection.orderBy("timestamp", "desc");
        if (mode === "meme") query = query.where("category", "==", "meme");
        if (mode === "user" && req.query.userId) query = query.where("userId", "==", req.query.userId);
        if (mode === "following" && viewerId) {
            const viewerSnap = await db.doc(`${USERS_PATH}/${viewerId}`).get();
            const following = viewerSnap.exists ? (viewerSnap.data().following || []) : [];
            if (following.length > 0) {
                query = query.where("userId", "in", following.slice(0, 10));
            } else {
                return res.status(200).json({ posts: [], nextCursor: null });
            }
        }
        if (cursorId) {
            const doc = await postsCollection.doc(cursorId).get();
            if (doc.exists) query = query.startAfter(doc);
        }
        const snap = await query.limit(limitReq).get();
        rawPosts = snap.docs.map(d => ({ ...d.data(), id: d.id, timestamp: safeMillis(d.data()?.timestamp) }));
        if (snap.docs.length > 0) nextCursor = snap.docs[snap.docs.length - 1].id;
    }

    // --- MODE HOME (VARIASI MIXED: 60% BARU / 40% RANDOM LAMA) ---
    else {
        const freshLimit = Math.ceil(limitReq * 0.6); 
        const randomLimit = Math.floor(limitReq * 0.4);

        // 1. Ambil Postingan FRESH (Terbaru)
        let freshQuery = postsCollection.orderBy("timestamp", "desc");
        if (cursorId) {
            const doc = await postsCollection.doc(cursorId).get();
            if (doc.exists) freshQuery = freshQuery.startAfter(doc);
        }
        const freshSnap = await freshQuery.limit(freshLimit).get();
        
        // Simpan cursor dari yang fresh
        if (freshSnap.docs.length > 0) {
            nextCursor = freshSnap.docs[freshSnap.docs.length - 1].id;
        }

        // 2. Ambil Postingan RANDOM (Lama)
        const randomTimeOffset = Math.floor(Math.random() * 31536000000); 
        const randomTimestamp = Date.now() - randomTimeOffset;
        const randomSnap = await postsCollection
            .where("timestamp", "<", randomTimestamp)
            .orderBy("timestamp", "desc")
            .limit(randomLimit)
            .get();

        const freshPosts = freshSnap.docs.map(d => ({ ...d.data(), id: d.id, timestamp: safeMillis(d.data()?.timestamp) }));
        const randomPosts = randomSnap.docs.map(d => ({ ...d.data(), id: d.id, timestamp: safeMillis(d.data()?.timestamp) }));

        // Gabung & Acak
        rawPosts = [...freshPosts, ...randomPosts];
        rawPosts = shuffleArray(rawPosts);
    }

    /* ================== PROCESSING AKHIR ================== */

    // 1. Hapus Duplikat
    let processedPosts = uniqueById(rawPosts);

    // 2. Anti Spam (Max 2 post per user)
    processedPosts = filterSpamUsers(processedPosts, 2);

    // 3. FIX PROFILE PICTURE (SUPER UPDATE)
    // Memastikan setiap postingan punya data user terbaru dan foto default jika kosong
    processedPosts = await enrichPostsWithUsers(processedPosts);

    res.status(200).json({
      posts: processedPosts,
      nextCursor: nextCursor,
      count: processedPosts.length
    });

  } catch (e) {
    console.error("FEED_ERROR:", e);
    res.status(500).json({
      error: true,
      message: e.message || "Unknown runtime error"
    });
  }
}