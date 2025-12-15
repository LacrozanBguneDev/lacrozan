import admin from "firebase-admin";

/* ================== CONFIG ================== */
const REQUIRED_API_KEY = process.env.FEED_API_KEY?.trim() || null;
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
  });
}
const db = admin.firestore();
const POSTS_PATH = "artifacts/default-app-id/public/data/posts";
const USERS_PATH = "artifacts/default-app-id/public/data/userProfiles";

/* ================== UTIL & CACHE ================== */
const safeMillis = ts => ts && ts.toMillis ? ts.toMillis() : 0;

// Cache user profile biar irit reads (Memory Cache)
const userCache = new Map();
const getUserProfile = async (userId) => {
  if (!userId) return { username: "Anon", photoURL: null };
  if (userCache.has(userId)) return userCache.get(userId);
  
  const doc = await db.doc(`${USERS_PATH}/${userId}`).get();
  const data = doc.exists 
    ? { username: doc.data().username || "Unknown", photoURL: doc.data().photoURL || null }
    : { username: "Unknown", photoURL: null };
    
  userCache.set(userId, data);
  return data;
};

/* ================== DYNAMIC SCORE ================== */
const calculateChaosScore = (p) => {
  const now = Date.now();
  const hoursAgo = (now - p.timestamp) / 3600000;
  
  // 1. Freshness Factor (Makin baru makin tinggi)
  // Max score 50 untuk post < 1 jam, turun seiring waktu
  const freshness = Math.max(0, 50 - (hoursAgo * 2)); 

  // 2. Engagement Factor (Likes/Comments)
  // Tidak terlalu dominan biar post baru tetap muncul
  const likes = Array.isArray(p.likes) ? p.likes.length : 0;
  const engagement = (likes * 1) + ((p.commentsCount || 0) * 2);

  // 3. Chaos Factor (Random)
  // Angka acak 0-40. Ini yang bikin "Dynamic" dan beda tiap refresh
  const chaos = Math.floor(Math.random() * 40);

  return freshness + engagement + chaos;
};

/* ================== HANDLER ================== */
export default async function handler(req, res) {
  // 1. Auth Guard
  const apiKey = String(req.headers["x-api-key"] || req.query.apiKey || "").trim();
  if (REQUIRED_API_KEY && apiKey !== REQUIRED_API_KEY) {
    return res.status(401).json({ error: true });
  }

  try {
    // 2. Parse Params
    const limit = Math.min(Number(req.query.limit) || 10, 20);
    const viewerId = req.query.viewerId || null;
    const nextCursor = Number(req.query.nextCursor) || null; // Timestamp
    
    // OPSI BARU: Frontend bisa kirim ID yang sedang tampil biar gak dobel
    // Format: ?excludeIds=id1,id2,id3
    const clientExcluded = (req.query.excludeIds || "").split(",").filter(Boolean);

    // 3. Query Database (STRICT TIME BASED)
    // Kita ambil pool 5x limit (misal 50) untuk disaring
    let query = db.collection(POSTS_PATH)
      .orderBy("timestamp", "desc"); // Selalu urut waktu biar pagination stabil

    if (nextCursor) {
      query = query.startAfter(admin.firestore.Timestamp.fromMillis(nextCursor));
    }

    // Fetch agak banyak (Pool) untuk diacak
    const poolSize = limit * 5; 
    const snap = await query.limit(poolSize).get();

    if (snap.empty) return res.json({ posts: [], nextCursor: null });

    // 4. Tentukan Next Cursor SEKARANG (PENTING!)
    // Cursor harus berdasarkan item TERAKHIR di database yang kita pegang,
    // BUKAN item terakhir yang kita kirim ke user. 
    // Ini mencegah pagination mundur/ulang.
    const lastDocInDb = snap.docs[snap.docs.length - 1];
    const realNextCursor = safeMillis(lastDocInDb.data().timestamp);

    // 5. Mapping Data Awal
    let pool = snap.docs.map(d => ({
      id: d.id,
      ...d.data(),
      timestamp: safeMillis(d.data().timestamp),
      userId: d.data().userId || "anon"
    }));

    // 6. Filter: History User & Client Excludes
    let seenIds = new Set(clientExcluded);
    if (viewerId) {
      // Ambil history dari DB (optimasi: bisa di-skip kalau heavy load)
      const viewerDoc = await db.doc(`${USERS_PATH}/${viewerId}`).get();
      if (viewerDoc.exists) {
        (viewerDoc.data().seenPosts || []).forEach(id => seenIds.add(id));
      }
    }
    
    // Buang post yang sudah dilihat/exclude
    pool = pool.filter(p => !seenIds.has(p.id));

    // 7. SCORING & DIVERSITY (Inti Algoritma)
    
    // Beri nilai "Chaos Score" ke sisa post
    pool.forEach(p => { p._score = calculateChaosScore(p); });
    
    // Sort berdasarkan score (Campuran fresh + viral + random)
    pool.sort((a, b) => b._score - a._score);

    // SELEKSI FINAL: Strict One User Per Batch
    const finalPosts = [];
    const selectedUsers = new Set(); // Melacak user di batch ini

    // Putaran 1: Cari post dengan user yang BELUM ada di batch ini
    for (const p of pool) {
      if (finalPosts.length >= limit) break;
      if (!selectedUsers.has(p.userId)) {
        finalPosts.push(p);
        selectedUsers.add(p.userId);
      }
    }

    // Putaran 2 (Fallback): Kalau slot masih sisa (jarang terjadi kalau pool 50),
    // baru boleh ambil user yang sama
    if (finalPosts.length < limit) {
      for (const p of pool) {
        if (finalPosts.length >= limit) break;
        // Cek ID post biar gak masukin post yang sudah masuk di putaran 1
        if (!finalPosts.find(x => x.id === p.id)) {
          finalPosts.push(p);
        }
      }
    }

    // 8. Join Profile (Hemat Read, cuma buat finalPosts)
    const uniqueUserIds = [...new Set(finalPosts.map(p => p.userId))];
    const profiles = await Promise.all(uniqueUserIds.map(getUserProfile));
    const profileMap = Object.fromEntries(uniqueUserIds.map((id, i) => [id, profiles[i]]));

    const result = finalPosts.map(p => {
      const { _score, ...rest } = p; // Hapus score internal
      return {
        ...rest,
        user: profileMap[p.userId] || { username: "Unknown", photoURL: null }
      };
    });

    // 9. Update History (Fire & Forget)
    if (viewerId && result.length) {
      db.doc(`${USERS_PATH}/${viewerId}`).set({
        seenPosts: admin.firestore.FieldValue.arrayUnion(...result.map(p => p.id)),
        lastActive: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true }).catch(e => console.log("History err", e));
    }

    // 10. Return Response
    // Jika snap.size < poolSize, berarti DB sudah habis, cursor null
    const nextCursorResponse = snap.size < poolSize ? null : realNextCursor;

    res.json({
      posts: result,
      nextCursor: nextCursorResponse
    });

  } catch (e) {
    console.error("FEED ERROR:", e);
    res.status(500).json({ error: true, message: e.message });
  }
}