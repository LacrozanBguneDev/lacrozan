import admin from "firebase-admin";
import { CONFIG } from "./config.js";

/* ================== KONFIGURASI & INISIALISASI ================== */
const REQUIRED_API_KEY =
  process.env.FEED_API_KEY?.trim() || CONFIG.FEED_API_KEY || null;

let db = null;
let initError = null;

const POSTS_PATH = "artifacts/default-app-id/public/data/posts";
const USERS_PATH = "artifacts/default-app-id/public/data/userProfiles";

const getServiceAccount = () => {
  const rawEnv = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!rawEnv) throw new Error("FIREBASE_SERVICE_ACCOUNT kosong.");

  try {
    const parsed = rawEnv.trim().startsWith("{")
      ? JSON.parse(rawEnv)
      : JSON.parse(Buffer.from(rawEnv, "base64").toString("utf8"));

    parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
    return parsed;
  } catch {
    throw new Error("Format FIREBASE_SERVICE_ACCOUNT invalid.");
  }
};

try {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(getServiceAccount())
    });
  }
  db = admin.firestore();
} catch (e) {
  initError = e.message;
}

/* ================== UTIL ================== */
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

const limitPerUser = (posts, max = 2) => {
  const map = {};
  return posts.filter(p => {
    map[p.userId] = (map[p.userId] || 0) + 1;
    return map[p.userId] <= max;
  });
};

/* ================== HANDLER ================== */
export default async function handler(req, res) {
  if (!db) {
    return res.status(500).json({ error: true, message: initError });
  }

  const apiKey = String(req.headers["x-api-key"] || "").trim();
  if (REQUIRED_API_KEY && apiKey !== REQUIRED_API_KEY) {
    return res.status(401).json({ error: true, message: "API key invalid" });
  }

  try {
    const mode = req.query.mode || "home";
    const limitReq = Math.min(Number(req.query.limit) || 10, 50);
    const page = Math.max(Number(req.query.page) || 0, 0);
    const viewerId = req.query.viewerId || null;

    let queryRef = db.collection(POSTS_PATH);
    let followingIds = [];

    if (mode === "following" && viewerId) {
      const snap = await db.doc(`${USERS_PATH}/${viewerId}`).get();
      followingIds = snap.exists ? snap.data()?.following || [] : [];
      followingIds = followingIds.slice(0, 10);
      if (followingIds.length) {
        queryRef = queryRef.where("userId", "in", followingIds);
      }
    }

    if (mode === "meme") {
      queryRef = queryRef.where("category", "==", "meme");
    }

    if (mode === "user" && req.query.userId) {
      queryRef = queryRef.where("userId", "==", req.query.userId);
    }

    // AMBIL BANYAK DATA SEKALI
    const snap = await queryRef
      .orderBy("timestamp", "desc")
      .limit(120)
      .get();

    if (snap.empty) {
      return res.json({ posts: [], nextPage: null });
    }

    const allPosts = snap.docs.map(d => ({
      ...d.data(),
      id: d.id,
      timestamp: safeMillis(d.data()?.timestamp),
      likeCount: Number(d.data()?.likeCount || 0)
    }));

    /* ================== FEED ENGINE ================== */
    let finalPosts = [];

    if (mode === "home") {
      const now = Date.now();

      const scored = allPosts.map(p => {
        const ageH = (now - p.timestamp) / 36e5;

        const freshness =
          ageH < 3 ? 2.2 :
          ageH < 12 ? 1.7 :
          ageH < 24 ? 1.3 :
          ageH < 72 ? 1 :
          0.6;

        const engagement = Math.log10(p.likeCount + 1) + 1;
        const noise = Math.random() * 0.6;

        return { ...p, _score: freshness * engagement + noise };
      });

      finalPosts = limitPerUser(
        shuffle(scored.sort((a, b) => b._score - a._score)),
        2
      );
    }

    else if (mode === "popular") {
      const now = Date.now();
      finalPosts = allPosts
        .map(p => {
          const ageH = (now - p.timestamp) / 36e5;
          const decay = Math.exp(-ageH / 48);
          return { ...p, _score: p.likeCount * decay };
        })
        .sort((a, b) => b._score - a._score);
    }

    else {
      finalPosts = shuffle(allPosts);
    }

    /* ================== PAGINATION OFFSET ================== */
    const start = page * limitReq;
    const end = start + limitReq;
    const result = finalPosts.slice(start, end);

    /* ================== USER DATA ================== */
    const uids = [...new Set(result.map(p => p.userId).filter(Boolean))];
    const userMap = {};

    if (uids.length) {
      const snaps = await Promise.all(
        uids.map(id => db.doc(`${USERS_PATH}/${id}`).get())
      );
      snaps.forEach(s => {
        if (s.exists) userMap[s.id] = s.data();
      });
    }

    const postsResponse = result.map(p => {
      const u = userMap[p.userId] || {};
      return {
        ...p,
        user: {
          username: u.username || "User",
          photoURL: u.photoURL || null,
          reputation: u.reputation || 0
        }
      };
    });

    res.json({
      posts: postsResponse,
      nextPage: end < finalPosts.length ? page + 1 : null
    });

  } catch (e) {
    console.error("FEED_ERROR:", e);
    res.status(500).json({ error: true, message: e.message });
  }
}