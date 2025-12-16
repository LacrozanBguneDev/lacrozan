import admin from "firebase-admin";

/* ================== INIT ================== */
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(
      JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
    ),
  });
}

const db = admin.firestore();
const POSTS_PATH = "artifacts/default-app-id/public/data/posts";

/* ================== UTIL ================== */
const safeMillis = ts => (ts?.toMillis ? ts.toMillis() : 0);

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
  try {
    const mode = req.query.mode || "home";
    const limit = Math.min(Number(req.query.limit) || 10, 20);

    // 🔑 ID POST YANG SUDAH DIKIRIM KE FRONTEND
    const sentIds = new Set(
      (req.query.sentIds || "")
        .split(",")
        .filter(Boolean)
    );

    /* ================== QUERY ================== */
    let query = db.collection(POSTS_PATH).orderBy("timestamp", "desc");
    if (mode === "meme") query = query.where("category", "==", "meme");

    const snap = await query.limit(limit * 10).get();
    if (snap.empty) return res.json({ posts: [], sentIds: [...sentIds] });

    let posts = snap.docs.map(d => ({
      id: d.id,
      ...d.data(),
      timestamp: safeMillis(d.data().timestamp),
    }));

    /* ================== FILTER DUPLIKAT ================== */
    posts = posts.filter(p => !sentIds.has(p.id));

    /* ================== HOME ALGORITHM ================== */
    if (mode === "home") {
      const now = Date.now();

      const fresh = posts.filter(
        p => (now - p.timestamp) / 3600000 < 24
      );
      const rest = posts.filter(p => !fresh.includes(p));

      posts = [
        ...shuffle(fresh),
        ...shuffle(rest),
      ];
    } else {
      posts = shuffle(posts);
    }

    posts = posts.slice(0, limit);

    /* ================== UPDATE sentIds ================== */
    posts.forEach(p => sentIds.add(p.id));

    res.json({
      posts,
      sentIds: [...sentIds], // kirim balik ke frontend
    });

  } catch (e) {
    console.error("FEED ERROR:", e);
    res.status(500).json({ error: true, message: e.message });
  }
}