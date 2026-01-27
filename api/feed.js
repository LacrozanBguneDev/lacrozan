import admin from "firebase-admin";
import { CONFIG } from './config.js';

/* ================== KONFIGURASI & INISIALISASI ================== */
const REQUIRED_API_KEY = process.env.FEED_API_KEY?.trim() || CONFIG.FEED_API_KEY || null;
const DEFAULT_AVATAR = "https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png";

let db = null;
const POSTS_PATH = "artifacts/default-app-id/public/data/posts";
const USERS_PATH = "artifacts/default-app-id/public/data/userProfiles";

const getServiceAccount = () => {
  const rawEnv = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!rawEnv) throw new Error("FIREBASE_SERVICE_ACCOUNT kosong");

  let serviceAccount;
  try {
    serviceAccount = JSON.parse(rawEnv);
  } catch {
    const decoded = Buffer.from(rawEnv, 'base64').toString('utf-8');
    serviceAccount = JSON.parse(decoded);
  }
  // Fix newline di private key
  if (serviceAccount.private_key) {
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, "\n");
  }
  return serviceAccount;
};

try {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(getServiceAccount())
    });
  }
  db = admin.firestore();
} catch (e) {
  console.error("FIREBASE_INIT_ERROR:", e);
}

/* ================== HELPER ================== */
const safeMillis = ts => {
  if (!ts) return Date.now();
  if (typeof ts.toMillis === "function") return ts.toMillis();
  if (ts._seconds) return ts._seconds * 1000;
  return Number(ts) || Date.now();
};

const shuffleArray = arr => {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

const uniqueById = posts => {
  const seen = new Set();
  return posts.filter(p => p?.id && !seen.has(p.id) && seen.add(p.id));
};

const filterSpamUsers = (posts, max = 2) => {
  const count = {};
  return posts.filter(p => {
    const u = p.userId || "anon";
    count[u] = (count[u] || 0) + 1;
    return count[u] <= max;
  });
};

/* ================== ENRICH USER ================== */
const enrichPostsWithUsers = async (posts) => {
  if (!posts.length) return [];

  const uids = [...new Set(posts.map(p => p.userId).filter(Boolean))];
  
  // Fetch user data secara parallel
  let userMap = {};
  if (uids.length > 0) {
      // Bagi array UID menjadi chunk kecil (max 10 untuk 'in' query) atau fetch by doc ID (lebih aman utk jumlah banyak)
      // Disini kita pakai promise.all untuk fetch doc langsung
      const snaps = await Promise.all(
        uids.map(id => db.collection(USERS_PATH).doc(id).get())
      );
      snaps.forEach((s, i) => {
        if (s.exists) userMap[uids[i]] = s.data();
      });
  }

  return posts.map(p => {
    const u = userMap[p.userId] || {};
    const name = u.displayName || u.username || p.authorName || "Unknown";
    const avatar = u.photoURL || u.avatar || p.authorAvatar || DEFAULT_AVATAR;
    const verified = u.isVerified ?? p.authorVerified ?? false;

    return {
      ...p,
      authorName: name,
      userName: name,
      displayName: name,
      authorAvatar: avatar,
      userAvatar: avatar,
      avatar, // Fallback utama
      isVerified: verified,
      authorVerified: verified,
      author: { ...(p.author || {}), name, avatar, isVerified: verified },
      user: { ...(p.user || {}), name, avatar, isVerified: verified }
    };
  });
};

/* ================== HANDLER UTAMA ================== */
export default async function handler(req, res) {
  if (!db) return res.status(500).json({ error: true, message: "Database connection failed" });

  // 1. Cek API Key
  const apiKey = String(req.headers["x-api-key"] || req.query.apiKey || "").trim();
  if (REQUIRED_API_KEY && apiKey && apiKey !== REQUIRED_API_KEY) {
    return res.status(401).json({ error: true, message: "API key invalid" });
  }

  try {
    const mode = req.query.mode || "home";
    const limitReq = Math.min(Number(req.query.limit) || 10, 50);
    
    // PERBAIKAN: Jangan convert cursor ke Number secara paksa. Biarkan String (ID).
    const cursorParam = req.query.cursor || null;

    const viewerId = req.query.viewerId || null;
    const tagRaw = req.query.tag || null;
    const searchQuery = req.query.q || req.query.query || null;

    const postsCollection = db.collection(POSTS_PATH);
    let rawPosts = [];
    let nextCursor = null;

    /* ========== MODE SEARCH (DIPERBAIKI) ========== */
    if (mode === "search" && searchQuery) {
      const needle = searchQuery.toLowerCase().trim();
      let results = [];
      
      // Ambil Doc Snapshot untuk pagination jika ada cursor
      let lastDocSnapshot = null;
      if (cursorParam) {
        const cDoc = await postsCollection.doc(cursorParam).get();
        if (cDoc.exists) lastDocSnapshot = cDoc;
      }

      let safetyLoop = 0;
      // Loop fetch batch sampai kita mendapatkan jumlah hasil yang cukup
      while (results.length < limitReq && safetyLoop < 5) {
        let q = postsCollection
          .orderBy("timestamp", "desc")
          .limit(100); // Scan 100 item sekaligus

        if (lastDocSnapshot) {
            q = q.startAfter(lastDocSnapshot);
        }

        const snap = await q.get();
        if (snap.empty) break;

        // Update snapshot terakhir untuk iterasi berikutnya (PENTING)
        lastDocSnapshot = snap.docs[snap.docs.length - 1];

        // Filter manual di backend (Search in-memory)
        for (const d of snap.docs) {
          const data = d.data();
          const text = (data.text || data.content || "").toLowerCase();
          const title = (data.title || "").toLowerCase();

          if (text.includes(needle) || title.includes(needle)) {
            results.push({
              ...data,
              id: d.id,
              timestamp: safeMillis(data.timestamp)
            });
            if (results.length >= limitReq) break;
          }
        }
        safetyLoop++;
      }

      rawPosts = results;
      // Cursor berikutnya adalah ID dari dokumen TERAKHIR YANG DI-SCAN (bukan yang match)
      // agar loop berikutnya mulai setelah scan terakhir.
      nextCursor = lastDocSnapshot ? lastDocSnapshot.id : null;
    }

    /* ========== MODE HASHTAG (DIPERBAIKI) ========== */
    else if (mode === "hashtag" && tagRaw) {
      const tag = tagRaw.toLowerCase().replace("#", "");
      const needle = `#${tag}`;

      let results = [];
      let lastDocSnapshot = null;

      if (cursorParam) {
        const cDoc = await postsCollection.doc(cursorParam).get();
        if (cDoc.exists) lastDocSnapshot = cDoc;
      }

      let safetyLoop = 0;
      while (results.length < limitReq && safetyLoop < 5) {
        let q = postsCollection.orderBy("timestamp", "desc").limit(100);
        if (lastDocSnapshot) q = q.startAfter(lastDocSnapshot);

        const snap = await q.get();
        if (snap.empty) break;

        lastDocSnapshot = snap.docs[snap.docs.length - 1];

        for (const d of snap.docs) {
          const text = (d.data().text || d.data().content || "").toLowerCase();
          if (text.includes(needle)) {
            results.push({
              ...d.data(),
              id: d.id,
              timestamp: safeMillis(d.data()?.timestamp)
            });
            if (results.length >= limitReq) break;
          }
        }
        safetyLoop++;
      }

      rawPosts = results;
      nextCursor = lastDocSnapshot ? lastDocSnapshot.id : null;
    }

    /* ========== MODE USER / MEME / FOLLOWING ========== */
    else if (mode === "user" || mode === "meme" || mode === "following") {
      let q = postsCollection.orderBy("timestamp", "desc");

      if (mode === "meme") q = q.where("category", "==", "meme");
      if (mode === "user" && req.query.userId) q = q.where("userId", "==", req.query.userId);

      if (mode === "following" && viewerId) {
        const snap = await db.doc(`${USERS_PATH}/${viewerId}`).get();
        const following = snap.exists ? snap.data().following || [] : [];
        if (!following.length) return res.json({ posts: [], nextCursor: null });
        q = q.where("userId", "in", following.slice(0, 10));
      }

      if (cursorParam) {
        const c = await postsCollection.doc(cursorParam).get();
        if (c.exists) q = q.startAfter(c);
      }

      const snap = await q.limit(limitReq).get();
      rawPosts = snap.docs.map(d => ({
        ...d.data(),
        id: d.id,
        timestamp: safeMillis(d.data()?.timestamp)
      }));
      nextCursor = snap.docs.at(-1)?.id || null;
    }

    /* ========== MODE HOME (DEFAULT) ========== */
    else {
      // Logika Home: Campuran Fresh (Terbaru) + Random (Lama)
      const freshLimit = Math.ceil(limitReq * 0.6);
      const randomLimit = limitReq - freshLimit;

      let q = postsCollection.orderBy("timestamp", "desc");
      
      // Menggunakan Cursor ID
      if (cursorParam) {
        const c = await postsCollection.doc(cursorParam).get();
        if (c.exists) q = q.startAfter(c);
      }

      const freshSnap = await q.limit(freshLimit).get();
      
      // Next Cursor diambil dari item terakhir batch 'fresh'
      nextCursor = freshSnap.docs.at(-1)?.id || null;

      // Ambil beberapa post lama secara random untuk variasi
      const randomTime = Date.now() - Math.floor(Math.random() * 31536000000); // 1 tahun terakhir
      const randomSnap = await postsCollection
        .where("timestamp", "<", randomTime)
        .orderBy("timestamp", "desc")
        .limit(randomLimit)
        .get();

      rawPosts = shuffleArray([
        ...freshSnap.docs,
        ...randomSnap.docs
      ].map(d => ({
        ...d.data(),
        id: d.id,
        timestamp: safeMillis(d.data()?.timestamp)
      })));
    }

    /* ========== FINAL PROCESSING ========== */
    let posts = uniqueById(rawPosts);
    
    // Filter spam jika bukan melihat profil user spesifik
    if (mode !== 'user') {
      posts = filterSpamUsers(posts, 2);
    }
    
    posts = await enrichPostsWithUsers(posts);

    res.json({ posts, nextCursor, count: posts.length });

  } catch (e) {
    console.error("FEED_ERROR:", e);
    res.status(500).json({ error: true, message: e.message });
  }
}