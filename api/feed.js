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
  if (!db) {
    return res.status(500).json({
      error: true,
      message: "Firestore not initialized",
      details: initError
    });
  }

  const apiKey = String(req.headers["x-api-key"] || req.query.apiKey || "").trim();
  if (REQUIRED_API_KEY && apiKey && apiKey !== REQUIRED_API_KEY) {
    return res.status(401).json({ error: true, message: "API key invalid" });
  }

  try {
    const mode = req.query.mode || "home";
    const limitReq = Math.min(Number(req.query.limit) || 10, 50);
    const cursorId = req.query.cursor || null;

    // Tentukan porsi (Misal 50:50)
    const freshLimit = Math.ceil(limitReq / 2); // 5 data baru
    const legacyLimit = limitReq - freshLimit; // 5 data acak

    let postsResponse = [];
    let nextCursor = null;

    if (mode === "home") {
      // 1. Ambil Data Fresh (Sesuai urutan waktu & Pagination)
      let freshQuery = db.collection(POSTS_PATH).orderBy("timestamp", "desc");
      if (cursorId) {
        const cursorDoc = await db.collection(POSTS_PATH).doc(cursorId).get();
        if (cursorDoc.exists) freshQuery = freshQuery.startAfter(cursorDoc);
      }
      const freshSnap = await freshQuery.limit(freshLimit).get();
      
      const freshPosts = freshSnap.docs.map(d => ({
        ...d.data(),
        id: d.id,
        timestamp: safeMillis(d.data()?.timestamp),
        _tag: "fresh"
      }));

      // Set cursor berdasarkan data fresh terakhir agar pagination tidak rusak
      if (freshSnap.docs.length > 0) {
        nextCursor = freshSnap.docs[freshSnap.docs.length - 1].id;
      }

      // 2. Ambil Data Legacy/Random (Cari dari 100 post terakhir secara acak)
      // Kita ambil sampel agak jauh di belakang
      const legacySnap = await db.collection(POSTS_PATH)
        .orderBy("timestamp", "desc")
        .limit(100) 
        .get();
      
      let allLegacy = legacySnap.docs.map(d => ({
        ...d.data(),
        id: d.id,
        timestamp: safeMillis(d.data()?.timestamp),
        _tag: "legacy"
      }));

      // Filter agar tidak duplikat dengan data fresh yang baru diambil
      const freshIds = new Set(freshPosts.map(p => p.id));
      allLegacy = allLegacy.filter(p => !freshIds.has(p.id));

      // Ambil secara acak sebanyak legacyLimit
      const randomLegacy = shuffle(allLegacy).slice(0, legacyLimit);

      // 3. Gabungkan dan Kocok Ulang (The Blender)
      postsResponse = shuffle([...freshPosts, ...randomLegacy]);

    } else {
      // Untuk mode user, meme, atau following: Tetap urut waktu normal (Tanpa campur legacy)
      let normalQuery = db.collection(POSTS_PATH).orderBy("timestamp", "desc");
      if (cursorId) {
        const cursorDoc = await db.collection(POSTS_PATH).doc(cursorId).get();
        if (cursorDoc.exists) normalQuery = normalQuery.startAfter(cursorDoc);
      }
      const normalSnap = await normalQuery.limit(limitReq).get();
      postsResponse = normalSnap.docs.map(d => ({
        ...d.data(),
        id: d.id,
        timestamp: safeMillis(d.data()?.timestamp)
      }));
      if (normalSnap.docs.length > 0) {
        nextCursor = normalSnap.docs[normalSnap.docs.length - 1].id;
      }
    }

    /* ================== JOIN USER DATA ================== */
    const uids = [...new Set(postsResponse.map(p => p.userId).filter(Boolean))];
    const userMap = {};
    if (uids.length) {
      const userSnaps = await Promise.all(uids.map(id => db.doc(`${USERS_PATH}/${id}`).get()));
      userSnaps.forEach(s => { if (s.exists) userMap[s.id] = s.data(); });
    }

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

    res.status(200).json({
      posts: postsResponse,
      nextCursor: postsResponse.length < 3 ? null : nextCursor
    });

  } catch (e) {
    console.error("FEED_ERROR:", e);
    res.status(500).json({ error: true, message: e.message });
  }
}