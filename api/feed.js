import admin from "firebase-admin";
import { CONFIG } from './config.js';

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

/* ===== UTIL TAMBAHAN (NEXT STAGE) ===== */
const boostIfFresh = timestamp => {
  const ageHours = (Date.now() - timestamp) / 36e5;
  return ageHours < 24 ? 1.3 : 1;
};

const scoreWithDecay = (likeCount, timestamp) => {
  const ageHours = (Date.now() - timestamp) / 36e5;
  const decay = Math.exp(-ageHours / 48);
  return likeCount * decay;
};

const limitPerUser = (posts, max = 2) => {
  const map = {};
  return posts.filter(p => {
    map[p.userId] = (map[p.userId] || 0) + 1;
    return map[p.userId] <= max;
  });
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
          followingIds = Array.isArray(viewerSnap.data()?.following)
            ? viewerSnap.data().following.slice(0, 10)
            : [];
          if (!followingIds.length) isFollowingFallback = true;
        }
      }
    }

    if (mode === "meme") queryRef = queryRef.where("category", "==", "meme");
    if (mode === "user" && req.query.userId)
      queryRef = queryRef.where("userId", "==", req.query.userId);
    if (mode === "following" && followingIds?.length && !isFollowingFallback)
      queryRef = queryRef.where("userId", "in", followingIds);

    const bufferSize = limitReq * 3;
    queryRef = queryRef.orderBy("timestamp", "desc");

    if (cursorId) {
      const cursorDoc = await db.collection(POSTS_PATH).doc(cursorId).get();
      if (cursorDoc.exists) queryRef = queryRef.startAfter(cursorDoc);
    }

    const snap = await queryRef.limit(bufferSize).get();
    if (snap.empty && mode !== "following") {
      return res.json({ posts: [], nextCursor: null });
    }

    const allFetchedPosts = snap.docs.map(d => ({
      ...d.data(),
      id: d.id,
      timestamp: safeMillis(d.data()?.timestamp),
      likeCount: Number(d.data()?.likeCount || 0)
    }));

    /* ================== LOGIKA FEED FINAL ================== */
    let finalPosts = [];

    if (mode === "home") {
      const scored = allFetchedPosts.map(p => ({
        ...p,
        _score:
          boostIfFresh(p.timestamp) *
          (1 + p.likeCount * 0.1)
      }));

      const sorted = scored.sort((a, b) =>
        (b.timestamp + b._score * 1000) -
        (a.timestamp + a._score * 1000)
      );

      finalPosts = limitPerUser(sorted, 2);
    }

    else if (mode === "popular") {
      finalPosts = [...allFetchedPosts]
        .map(p => ({
          ...p,
          _score: scoreWithDecay(p.likeCount, p.timestamp)
        }))
        .sort((a, b) => b._score - a._score);
    }

    else {
      finalPosts = [...allFetchedPosts].sort((a, b) => b.timestamp - a.timestamp);
    }
    /* ======================================================= */

    const result = finalPosts.slice(0, limitReq);

    const uids = [...new Set(result.map(p => p.userId).filter(Boolean))];
    const userMap = {};
    if (uids.length) {
      const snaps = await Promise.all(uids.map(id => db.doc(`${USERS_PATH}/${id}`).get()));
      snaps.forEach(s => { if (s.exists) userMap[s.id] = s.data(); });
    }

    const postsResponse = result.map(p => {
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

    const lastDocInSnap = snap.docs[snap.docs.length - 1];
    const nextCursor =
      allFetchedPosts.length >= bufferSize
        ? lastDocInSnap?.id || null
        : result[result.length - 1]?.id || null;

    res.status(200).json({ posts: postsResponse, nextCursor });

  } catch (e) {
    console.error("FEED_ERROR:", e);
    res.status(500).json({
      error: true,
      message: e.message || "Unknown runtime error"
    });
  }
}