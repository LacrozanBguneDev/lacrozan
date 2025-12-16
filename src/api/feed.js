import admin from "firebase-admin";

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
const safeMillis = ts => ts && ts.toMillis ? ts.toMillis() : 0;

const shuffle = arr => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/* ================== HANDLER ================== */
export default async function handler(req, res) {
  const apiKey = String(req.headers["x-api-key"] || req.query.apiKey || "").trim();
  if (!REQUIRED_API_KEY || apiKey !== REQUIRED_API_KEY) {
    return res.status(401).json({ error: true });
  }

  try {
    const limit = Math.min(Number(req.query.limit) || 10, 20);
    const viewerId = req.query.viewerId || null;

    /* === Ambil pool post besar === */
    const poolSize = limit * 15;
    const snap = await db.collection(POSTS_PATH)
      .orderBy("timestamp", "desc")
      .limit(poolSize)
      .get();

    if (snap.empty) return res.json({ posts: [] });

    let posts = snap.docs.map(d => ({
      id: d.id,
      ...d.data(),
      timestamp: safeMillis(d.data().timestamp),
    }));

    /* === Filter seen posts === */
    let seen = new Set();
    if (viewerId) {
      const v = await db.doc(`${USERS_PATH}/${viewerId}`).get();
      if (v.exists) seen = new Set(v.data().seenPosts || []);
    }
    posts = posts.filter(p => !seen.has(p.id));

    /* === Kelompokkan per user === */
    const byUser = {};
    for (const p of posts) {
      if (!byUser[p.userId]) byUser[p.userId] = [];
      byUser[p.userId].push(p);
    }

    /* === Urutkan tiap user by terbaru === */
    Object.values(byUser).forEach(arr =>
      arr.sort((a, b) => b.timestamp - a.timestamp)
    );

    /* === Round-robin anti spam === */
    let users = shuffle(Object.keys(byUser));
    let result = [];
    let round = 0;

    while (result.length < limit && users.length) {
      for (const uid of users) {
        const arr = byUser[uid];
        if (arr[round]) {
          result.push(arr[round]);
          if (result.length >= limit) break;
        }
      }
      round++;
      if (round > 2) break; // keras: max 3 post / user
    }

    /* === Join user profile (minimal) === */
    const uids = [...new Set(result.map(p => p.userId))];
    const profiles = await Promise.all(
      uids.map(uid => db.doc(`${USERS_PATH}/${uid}`).get())
    );
    const map = {};
    profiles.forEach(d => {
      map[d.id] = d.exists
        ? { username: d.data().username || "Unknown", photoURL: d.data().photoURL || null }
        : { username: "Unknown", photoURL: null };
    });

    result = result.map(p => ({ ...p, user: map[p.userId] }));

    /* === Update seen === */
    if (viewerId && result.length) {
      await db.doc(`${USERS_PATH}/${viewerId}`).set({
        seenPosts: admin.firestore.FieldValue.arrayUnion(...result.map(p => p.id))
      }, { merge: true });
    }

    res.json({ posts: result });

  } catch (e) {
    console.error(e);
    res.status(500).json({ error: true });
  }
}