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

/* ===== CONTENT SIGNATURE ===== */
const buildPostKey = p => {
  const text = (p.text || p.caption || "").trim();
  const media = Array.isArray(p.media)
    ? p.media.join(",")
    : (p.media || p.image || "");
  return `${p.userId || "anon"}|${text}|${media}`;
};

/* ===== FINAL GUARD (ID + CONTENT) ===== */
const uniqueByContent = (posts, limit) => {
  const seen = new Set();
  const result = [];

  for (const p of posts) {
    if (!p) continue;

    const key = `${p.id}|${buildPostKey(p)}`;
    if (seen.has(key)) continue;

    seen.add(key);
    result.push(p);

    if (result.length >= limit) break;
  }

  return result;
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
    return res.status(401).json({
      error: true,
      message: "API key invalid"
    });
  }

  try {
    const mode = req.query.mode || "home";
    const limitReq = Math.min(Number(req.query.limit) || 10, 50);
    const viewerId = req.query.viewerId || null;
    const cursorId = req.query.cursor || null;

    let cursorTimestamp = null;

    if (cursorId) {
      const cursorDoc = await db.collection(POSTS_PATH).doc(cursorId).get();
      if (cursorDoc.exists) {
        cursorTimestamp = safeMillis(cursorDoc.data()?.timestamp);
      }
    }

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

    if (mode === "meme") queryRef = queryRef.where("category", "==", "meme");
    if (mode === "user" && req.query.userId)
      queryRef = queryRef.where("userId", "==", req.query.userId);

    if (mode === "following" && followingIds?.length && !isFollowingFallback) {
      queryRef = queryRef.where("userId", "in", followingIds);
    }

    const freshLimit = Math.ceil(limitReq / 2);
    const legacyLimit = limitReq - freshLimit;

    let finalRawPosts = [];
    let snapForCursor = null;

    if (mode === "home" || (mode === "following" && isFollowingFallback)) {
      let freshQuery = queryRef.orderBy("timestamp", "desc");
      if (cursorId) {
        const cursorDoc = await db.collection(POSTS_PATH).doc(cursorId).get();
        if (cursorDoc.exists) freshQuery = freshQuery.startAfter(cursorDoc);
      }

      const freshSnap = await freshQuery.limit(freshLimit).get();
      snapForCursor = freshSnap;

      const freshPosts = freshSnap.docs.map(d => ({
        ...d.data(),
        id: d.id,
        timestamp: safeMillis(d.data()?.timestamp)
      }));

      const legacySnap = await db
        .collection(POSTS_PATH)
        .orderBy("timestamp", "desc")
        .limit(100)
        .get();

      let allLegacy = legacySnap.docs.map(d => ({
        ...d.data(),
        id: d.id,
        timestamp: safeMillis(d.data()?.timestamp)
      }));

      const freshIds = new Set(freshPosts.map(p => p.id));

      allLegacy = allLegacy.filter(p => {
        if (freshIds.has(p.id)) return false;
        if (cursorTimestamp && p.timestamp > cursorTimestamp) return false;
        return true;
      });

      const randomLegacy = shuffle(allLegacy).slice(0, legacyLimit);

      finalRawPosts = [...freshPosts, ...randomLegacy];
    } else {
      let normalQuery = queryRef.orderBy("timestamp", "desc");
      if (cursorId) {
        const cursorDoc = await db.collection(POSTS_PATH).doc(cursorId).get();
        if (cursorDoc.exists) normalQuery = normalQuery.startAfter(cursorDoc);
      }

      const normalSnap = await normalQuery.limit(limitReq).get();
      snapForCursor = normalSnap;

      finalRawPosts = normalSnap.docs.map(d => ({
        ...d.data(),
        id: d.id,
        timestamp: safeMillis(d.data()?.timestamp)
      }));
    }

    let finalPosts = [];

    if (mode === "home" || (mode === "following" && isFollowingFallback)) {
      const userPostCount = {};
      const uniquePosts = [];

      for (const p of finalRawPosts) {
        const uid = p.userId || "anon";
        const count = userPostCount[uid] || 0;
        if (count < 2 || finalRawPosts.length < 5) {
          uniquePosts.push(p);
          userPostCount[uid] = count + 1;
        }
      }

      finalPosts = shuffle(uniquePosts);
    } else if (mode === "popular") {
      finalPosts = shuffle(finalRawPosts);
    } else {
      finalPosts = finalRawPosts;
    }

    /* ===== FINAL DEDUP PALING AKHIR ===== */
    const postsResponse = uniqueByContent(finalPosts, limitReq);

    let nextCursor = null;
    if (snapForCursor && !snapForCursor.empty) {
      const lastDocInBatch = snapForCursor.docs[snapForCursor.docs.length - 1];
      nextCursor = lastDocInBatch ? lastDocInBatch.id : null;
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