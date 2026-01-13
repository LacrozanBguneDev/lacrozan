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

/* ================== UTILITAS (HELPER) ================== */

// 1. Format Waktu Aman
const safeMillis = ts => {
  if (!ts) return Date.now();
  if (typeof ts.toMillis === "function") return ts.toMillis();
  if (ts._seconds) return ts._seconds * 1000;
  return Number(ts) || Date.now();
};

// 2. Acak Array (Shuffle) - Biar feed tidak membosankan
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

// 4. Filter Spam User (Membatasi max postingan per user dalam 1 batch)
const filterSpamUsers = (posts, maxPerUser = 2) => {
  const userCount = {};
  return posts.filter(p => {
    const uid = p.userId || "anon";
    if (!userCount[uid]) userCount[uid] = 0;
    
    if (userCount[uid] >= maxPerUser) {
      return false; // Skip jika user ini sudah muncul terlalu sering di batch ini
    }
    userCount[uid]++;
    return true;
  });
};

/* ===== FUNGSI KRUSIAL: UPDATE FOTO PROFIL & DATA USER ===== */
const enrichPostsWithUsers = async (posts) => {
  if (!posts || posts.length === 0) return [];

  // Ambil semua userId unik dari list post
  const userIds = [...new Set(posts.map(p => p.userId).filter(Boolean))];

  if (userIds.length === 0) return posts;

  // Fetch data user TERBARU dari database userProfiles
  // Ini kunci agar foto profil selalu update walau postingan lama
  const fetchPromises = userIds.map(uid => 
    db.collection(USERS_PATH).doc(uid).get()
      .then(snap => ({ id: uid, data: snap.exists ? snap.data() : null }))
      .catch(() => ({ id: uid, data: null }))
  );

  const userResults = await Promise.all(fetchPromises);
  
  // Buat kamus data user
  const userMap = {};
  userResults.forEach(res => {
    if (res.data) userMap[res.id] = res.data;
  });

  // Gabungkan ke postingan
  return posts.map(p => {
    const freshUser = userMap[p.userId];
    
    // Logika Prioritas: Data Terbaru DB > Data Lama di Post > Default Null
    const finalName = freshUser?.displayName || freshUser?.username || freshUser?.name || p.authorName || "User";
    
    // Cek berbagai kemungkinan nama field foto di database kamu
    const finalAvatar = freshUser?.photoURL || freshUser?.avatar || freshUser?.profilePic || freshUser?.image || p.authorAvatar || p.userAvatar || null;
    
    const isVerified = freshUser?.isVerified ?? p.authorVerified ?? false;

    return {
      ...p,
      // Timpa data lama dengan data segar
      authorName: finalName, 
      userName: finalName,      // Untuk kompatibilitas frontend
      
      authorAvatar: finalAvatar, 
      userAvatar: finalAvatar,  // Untuk kompatibilitas frontend
      photoURL: finalAvatar,    // Untuk kompatibilitas frontend
      
      authorVerified: isVerified,
      isVerified: isVerified
    };
  });
};

/* ================== HANDLER UTAMA ================== */
export default async function handler(req, res) {
  if (!db) {
    return res.status(500).json({ error: true, message: "Firestore not initialized" });
  }

  // Cek API Key
  const apiKey = String(req.headers["x-api-key"] || req.query.apiKey || "").trim();
  if (REQUIRED_API_KEY && apiKey && apiKey !== REQUIRED_API_KEY) {
    return res.status(401).json({ error: true, message: "API key invalid" });
  }

  try {
    const mode = req.query.mode || "home";
    const searchQuery = req.query.q || req.query.search || null;
    // Ambil limit, default 10. Kita akan tarik lebih banyak untuk dicampur.
    const limitReq = Math.min(Number(req.query.limit) || 10, 50);
    const cursorId = req.query.cursor || null;
    const viewerId = req.query.viewerId || null;

    let postsCollection = db.collection(POSTS_PATH);
    let rawPosts = [];
    let nextCursor = null;

    // --- MODE 1: PENCARIAN (SEARCH DIPERKUAT) ---
    if (searchQuery) {
        // Karena Firestore tidak support full-text search native yang kuat,
        // Kita gunakan trik "keywords" array jika ada, atau pencarian text field
        // Alternatif: Tarik data agak banyak lalu filter manual (mahal tapi akurat)
        
        // Coba cari berdasarkan text/caption
        const searchSnapshot = await postsCollection
            .where('text', '>=', searchQuery)
            .where('text', '<=', searchQuery + '\uf8ff')
            .limit(limitReq)
            .get();
            
        // Jika DB punya field 'keywords' (array), bisa pakai 'array-contains'
        // const keywordSnapshot = await postsCollection.where('keywords', 'array-contains', searchQuery).get();

        rawPosts = searchSnapshot.docs.map(d => ({ ...d.data(), id: d.id, timestamp: safeMillis(d.data()?.timestamp) }));
    }

    // --- MODE 2: USER PROFILE / MEME / FOLLOWING (LOGIC BIASA) ---
    else if (mode === "user" || mode === "meme" || mode === "following") {
        let query = postsCollection.orderBy("timestamp", "desc");

        if (mode === "meme") query = query.where("category", "==", "meme");
        if (mode === "user" && req.query.userId) query = query.where("userId", "==", req.query.userId);
        
        if (mode === "following" && viewerId) {
            const viewerSnap = await db.doc(`${USERS_PATH}/${viewerId}`).get();
            const following = viewerSnap.exists ? (viewerSnap.data().following || []) : [];
            // Batas Firestore "IN" query adalah 10, ambil 10 terakhir
            if (following.length > 0) {
                query = query.where("userId", "in", following.slice(0, 10));
            } else {
                // Kalau gak follow siapa2, return kosong
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

    // --- MODE 3: HOME FEED (VARIASI BARU + LAMA + ACAK) ---
    else {
        // Strategi: Tarik 2 Jenis Data
        // 1. Data Terbaru (Sequential untuk pagination) -> 60% dari limit
        // 2. Data Random/Lama (Untuk variasi) -> 40% dari limit
        
        const freshLimit = Math.ceil(limitReq * 0.6); 
        const randomLimit = Math.floor(limitReq * 0.4);

        // A. Query Terbaru (Fresh)
        let freshQuery = postsCollection.orderBy("timestamp", "desc");
        if (cursorId) {
            const doc = await postsCollection.doc(cursorId).get();
            if (doc.exists) freshQuery = freshQuery.startAfter(doc);
        }
        const freshSnap = await freshQuery.limit(freshLimit).get();
        
        // Simpan cursor HANYA berdasarkan postingan fresh agar scroll tidak loncat
        if (freshSnap.docs.length > 0) {
            nextCursor = freshSnap.docs[freshSnap.docs.length - 1].id;
        }

        // B. Query Random/Lama (Untuk variasi biar ga bosan)
        // Kita ambil postingan sebelum waktu acak dalam 1 tahun terakhir
        const randomTimeOffset = Math.floor(Math.random() * 31536000000); // 1 Tahun dalam milidetik
        const randomTimestamp = Date.now() - randomTimeOffset;
        
        const randomSnap = await postsCollection
            .where("timestamp", "<", randomTimestamp)
            .orderBy("timestamp", "desc")
            .limit(randomLimit)
            .get();

        // Gabungkan Hasil A + B
        const freshPosts = freshSnap.docs.map(d => ({ ...d.data(), id: d.id, timestamp: safeMillis(d.data()?.timestamp) }));
        const randomPosts = randomSnap.docs.map(d => ({ ...d.data(), id: d.id, timestamp: safeMillis(d.data()?.timestamp) }));

        rawPosts = [...freshPosts, ...randomPosts];

        // LOGIKA PENGACAKAN:
        // Kita acak posisinya biar user merasa "Fresh" dan tidak monoton
        rawPosts = shuffleArray(rawPosts);
    }

    /* ================== PROCESSING AKHIR (CLEANING) ================== */

    // 1. Buang Duplikat (Wajib, karena gabungan query bisa saja tumpang tindih)
    let processedPosts = uniqueById(rawPosts);

    // 2. Filter Spam (Max 2 postingan per user per tarikan)
    // Biar feed tidak isinya orang itu-itu saja
    processedPosts = filterSpamUsers(processedPosts, 2);

    // 3. ENRICH: Perbaiki Foto Profil & Data User (INTI MASALAH PERTAMA)
    // Ini akan mengambil foto profil TERBARU langsung dari userProfiles
    processedPosts = await enrichPostsWithUsers(processedPosts);

    // Kembalikan Response
    res.status(200).json({
      posts: processedPosts,
      nextCursor: nextCursor, // Cursor tetap mengarah ke flow postingan baru
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