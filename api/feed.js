import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

if (!initializeApp.apps?.length) initializeApp({ credential: cert(serviceAccount) });

const db = getFirestore();

export default async function handler(req, res) {
  try {
    const userId = req.query.userId || "guest";
    const limit = parseInt(req.query.limit) || 10;
    const startAfterTimestamp = req.query.startAfter ? new Date(parseInt(req.query.startAfter)) : null;
    const mode = req.query.mode || "home"; // home / search / profile
    const category = req.query.category || null; // meme
    const q = req.query.q?.toLowerCase() || null; // search keyword
    const profileId = req.query.profileId || null; // profile userId

    let query = db.collection("posts").orderBy("timestamp", "desc").limit(100);
    if (startAfterTimestamp) query = query.startAfter(startAfterTimestamp);

    const snapshot = await query.get();
    let posts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // ===== Mode Beranda =====
    if (mode === "home") {
      if (category) {
        // kategori meme
        posts = posts.filter(p => p.category === category || p.tags?.includes(category));
      }

      // scoring cerdas untuk beranda
      posts = posts.map(post => {
        let score = 1;
        if (post.followers?.includes(userId)) score += 3;
        if (post.tags && post.userLikes?.some(tag => post.tags.includes(tag))) score += 2;
        const ageInHours = (Date.now() - post.timestamp.toMillis()) / (1000*60*60);
        if (ageInHours < 24) score += 1.5;
        return { ...post, score };
      });
      posts.sort((a,b) => b.score - a.score);

    // ===== Mode Populer =====
    } else if (mode === "popular") {
      posts = posts.map(post => {
        let score = 0;
        score += (post.likes?.length || 0) * 2;          // likes
        score += (post.commentsCount || 0) * 1.5;       // comments
        score += (post.followers?.length || 0) * 1;     // followers
        const ageInHours = (Date.now() - post.timestamp.toMillis()) / (1000*60*60);
        if (ageInHours < 24) score += 1;                // boost post baru
        return { ...post, score };
      });
      posts.sort((a,b) => b.score - a.score);

    // ===== Mode Search =====
    } else if (mode === "search" && q) {
      posts = posts.filter(p =>
        (p.title?.toLowerCase().includes(q)) ||
        (p.content?.toLowerCase().includes(q)) ||
        (p.tags?.some(tag => tag.toLowerCase().includes(q)))
      );
      posts.sort((a,b) => b.timestamp.toMillis() - a.timestamp.toMillis());

    // ===== Mode Profile =====
    } else if (mode === "profile" && profileId) {
      posts = posts.filter(p => p.userId === profileId);
      posts.sort((a,b) => b.timestamp.toMillis() - a.timestamp.toMillis());
    }

    // Ambil batch sesuai limit
    const batch = posts.slice(0, limit);
    const lastTimestamp = batch.length ? batch[batch.length - 1].timestamp.toMillis() : null;

    res.status(200).json({ posts: batch, lastTimestamp });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
}