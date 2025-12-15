import admin from "firebase-admin";

/* ================== CONFIG ================== */
const REQUIRED_API_KEY = process.env.FEED_API_KEY?.trim() || null;

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(
      JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
    ),
  });
}

const db = admin.firestore();
const POSTS_PATH = "artifacts/default-app-id/public/data/posts";
const USERS_PATH = "artifacts/default-app-id/public/data/userProfiles";

/* ================== UTIL ================== */
// Helper aman buat convert timestamp
const safeMillis = (ts) => {
  if (!ts) return Date.now(); // Fallback kalau null
  if (typeof ts === 'number') return ts;
  if (ts.toMillis) return ts.toMillis();
  return Date.now();
};

// Cache User Profile (Hemat Read)
const userCache = new Map();
const getUserProfile = async (userId) => {
  if (!userId) return { username: "Anonim", photoURL: null };
  if (userCache.has(userId)) return userCache.get(userId);
  try {
    const doc = await db.doc(`${USERS_PATH}/${userId}`).get();
    const data = doc.exists
      ? { username: doc.data().username || "User", photoURL: doc.data().photoURL || null }
      : { username: "Unknown", photoURL: null };
    userCache.set(userId, data);
    return data;
  } catch (e) {
    return { username: "Error", photoURL: null };
  }
};

/* ================== SCORING ================== */
const calculateChaosScore = (p) => {
  const ageHours = Math.max(0.1, (Date.now() - p.timestamp) / 3600000);
  const likes = Array.isArray(p.likes) ? p.likes.length : 0;
  const comments = p.commentsCount || 0;
  
  // Rumus: (Interaksi) / (Umur^1.5) + Faktor Random
  const rawScore = (likes + comments * 2) / Math.pow(ageHours, 1.5);
  const chaos = Math.random() * 5; // Tambah sedikit bumbu random
  return rawScore + chaos;
};

/* ================== HANDLER ================== */
export default async function handler(req, res) {
  // Set JSON header biar frontend gak bingung
  res.setHeader('Content-Type', 'application/json');

  const apiKey = String(req.headers["x-api-key"] || req.query.apiKey || "").trim();
  if (REQUIRED_API_KEY && apiKey !== REQUIRED_API_KEY) {
    return res.status(401).json({ error: true, message: "Unauthorized" });
  }

  try {
    // 1. INPUT VALIDATION (Biar gak crash kena NaN)
    const limit = Math.min(Number(req.query.limit) || 10, 20);
    const viewerId = req.query.viewerId || null;
    
    // Validasi Cursor: Pastikan Number valid, bukan NaN
    let nextCursor = req.query.nextCursor;
    if (nextCursor === "null" || nextCursor === "undefined") nextCursor = null;
    nextCursor = Number(nextCursor);
    if (isNaN(nextCursor) || nextCursor === 0) nextCursor = null;

    const excludeIdsRaw = req.query.excludeIds || "";
    const excludeIds = excludeIdsRaw.split(",").filter(id => id && id.length > 0);

    // 2. QUERY DB (TIME BASED)
    let query = db.collection(POSTS_PATH).orderBy("timestamp", "desc");
    
    // Hanya pasang cursor kalau valid
    if (nextCursor) {
      query = query.startAfter(admin.firestore.Timestamp.fromMillis(nextCursor));
    }

    // Ambil Pool (3x limit cukup, 5x kebanyakan bikin lemot)
    const poolSize = limit * 3;
    const snap = await query.limit(poolSize).get();

    // Kalau kosong, return struktur standar
    if (snap.empty) {
      return res.json({ posts: [], nextCursor: null });
    }

    // 3. SIMPAN POSISI DATABASE TERAKHIR (Untuk Cursor Berikutnya)
    const lastDoc = snap.docs[snap.docs.length - 1];
    const realNextCursor = safeMillis(lastDoc.data().timestamp); // Ini kunci anti-duplikat

    // 4. MAPPING DATA
    let pool = snap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        ...data,
        timestamp: safeMillis(data.timestamp),
        userId: data.userId || "anon",
        _score: 0 // Placeholder
      };
    });

    // 5. FILTER: History & Exclude
    let blockList = new Set(excludeIds);
    if (viewerId) {
      // Logic history opsional (bisa di-skip kalau bikin berat)
      const viewerDoc = await db.doc(`${USERS_PATH}/${viewerId}`).get();
      if (viewerDoc.exists) {
        (viewerDoc.data().seenPosts || []).forEach(id => blockList.add(id));
      }
    }
    pool = pool.filter(p => !blockList.has(p.id));

    // 6. SORTING (Chaos Algorithm)
    pool.forEach(p => p._score = calculateChaosScore(p));
    pool.sort((a, b) => b._score - a._score);

    // 7. DIVERSITY (1 Post per User)
    const finalPosts = [];
    const usedUsers = new Set();
    
    // Putaran 1: User Unik
    for (const p of pool) {
      if (finalPosts.length >= limit) break;
      if (!usedUsers.has(p.userId)) {
        finalPosts.push(p);
        usedUsers.add(p.userId);
      }
    }
    
    // Putaran 2: Isi sisa slot (jika perlu)
    if (finalPosts.length < limit) {
      for (const p of pool) {
        if (finalPosts.length >= limit) break;
        // Cek ID post, bukan user lagi (biar gak duplikat item)
        if (!finalPosts.find(existing => existing.id === p.id)) {
          finalPosts.push(p);
        }
      }
    }

    // 8. JOIN PROFILES
    const userIds = [...new Set(finalPosts.map(p => p.userId))];
    const profiles = await Promise.all(userIds.map(getUserProfile));
    const userMap = {};
    userIds.forEach((id, i) => userMap[id] = profiles[i]);

    const result = finalPosts.map(p => {
      const { _score, ...rest } = p;
      return { ...rest, user: userMap[p.userId] };
    });

    // 9. RESPONSE AMAN
    // Cek apakah DB masih ada sisa? Kalau snap kurang dari limit, berarti habis.
    const hasMore = snap.size >= poolSize; 
    
    res.json({
      posts: result,
      // Pastikan return null jika DB habis, biar frontend stop request
      nextCursor: hasMore ? realNextCursor : null 
    });

  } catch (e) {
    console.error("FEED ERROR:", e);
    // Return empty array biar frontend gak nge-freeze/crash
    res.status(200).json({ posts: [], nextCursor: null, error: e.message });
  }
}