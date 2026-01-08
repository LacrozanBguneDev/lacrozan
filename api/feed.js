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
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
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

const dailySeedSort = posts => {
  const seed = Math.floor(Date.now() / 86400000);
  return [...posts].sort((a, b) => {
    const ra = Math.sin(seed + (a.id?.length || 0)) * 10000;
    const rb = Math.sin(seed + (b.id?.length || 0)) * 10000;
    return rb - ra;
  });
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

  /* ================== VALIDASI API KEY (DIPERBAIKI) ================== */
  const apiKey = String(req.headers["x-api-key"] || req.query.apiKey || "").trim();

  // Jika backend punya REQUIRED_API_KEY:
  // - API key ADA  → harus cocok
  // - API key KOSONG → dianggap request frontend (DIIZINKAN)
  if (REQUIRED_API_KEY && apiKey && apiKey !== REQUIRED_API_KEY) {
    return res.status(401).json({
      error: true,
      message: "API key invalid"
    });
  }
  /* ================================================================ */

  try {
    const mode = req.query.mode || "home";
    const limitReq = Math.min(Number(req.query.limit) || 10, 50);
    const viewerId = req.query.viewerId || null;
    const cursorId = req.query.cursor || null;

    let queryRef = db.collection(POSTS_PATH);
    let followingIds = null;
    let isFollowingFallback = false;

    if (mode === "following") {
      if (!viewerId) isFollowingFallback = true;
      else {
        const viewerSnap = await db.doc(`${USERS_PATH}/${viewerId}`).get();
        if (!viewerSnap.exists) isFollowingFallback = true;
        else {
          const viewerData = viewerSnap.data() || {};
          followingIds = Array.isArray(viewerData.following)
            ? viewerData.following.slice(0, 10)
            : [];
          if (!followingIds.length) isFollowingFallback = true;
        }
      }
    }

    // Filter category/user/following
    if (mode === "meme") queryRef = queryRef.where("category", "==", "meme");
    if (mode === "user" && req.query.userId)
      queryRef = queryRef.where("userId", "==", req.query.userId);
    if (mode === "following" && followingIds?.length && !isFollowingFallback)
      queryRef = queryRef.where("userId", "in", followingIds);

    // Query Firestore
    const bufferSize = limitReq * 3;
    queryRef = queryRef.orderBy("timestamp", "desc");

    if (cursorId) {
      const cursorDoc = await db.collection(POSTS_PATH).doc(cursorId).get();
      if (cursorDoc.exists) queryRef = queryRef.startAfter(cursorDoc);
      else console.warn("Cursor not found:", cursorId);
    }

    const snap = await queryRef.limit(bufferSize).get();
    if (snap.empty && mode !== "following") {
      return res.json({ posts: [], nextCursor: null });
    }

    const allFetchedPosts = snap.docs.map(d => ({
      ...d.data(),
      id: d.id,
      timestamp: safeMillis(d.data()?.timestamp)
    }));

    // Logika feed
    let finalPosts = [];
    if (mode === "home" || mode === "popular" || (mode === "following" && isFollowingFallback)) {
      const userGroups = {};
      allFetchedPosts.forEach(p => {
        if (!p.userId) return;
        if (!userGroups[p.userId]) userGroups[p.userId] = [];
        userGroups[p.userId].push(p);
      });
      let pool = [];
      Object.values(userGroups).forEach(group => pool.push(...group.slice(0, 2)));
      pool = dailySeedSort(pool);
      finalPosts = shuffle(pool);
    } else {
      finalPosts = dailySeedSort(allFetchedPosts);
    }

    let result = finalPosts.slice(0, limitReq);

    // Join user data
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

    /* ================== FETCH SERVER-TO-SERVER ================== */
    if (CONFIG.FEED_API_URL && CONFIG.FEED_API_KEY) {
      try {
        const extRes = await fetch(
          `${CONFIG.FEED_API_URL}?key=${CONFIG.FEED_API_KEY}`
        );
        if (extRes.ok) {
          const extData = await extRes.json();
          if (Array.isArray(extData.posts)) {
            postsResponse.push(...extData.posts);
          }
        } else {
          console.warn("External feed API response not ok:", extRes.status);
        }
      } catch (err) {
        console.warn("External feed fetch error:", err);
      }
    }

    postsResponse = postsResponse.slice(0, limitReq);

    // Next cursor
    const lastDocInSnap = snap.docs[snap.docs.length - 1];
    const nextCursor =
      allFetchedPosts.length >= bufferSize
        ? lastDocInSnap?.id || null
        : result.length
        ? result[result.length - 1].id
        : null;

    res.status(200).json({ posts: postsResponse, nextCursor });

  } catch (e) {
    console.error("FEED_ERROR:", e);
    res.status(500).json({
      error: true,
      message: e.message || "Unknown runtime error"
    });
  }
}