import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// Ambil Service Account JSON dari Environment Variable
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

// Initialize Firebase Admin
if (!initializeApp.apps?.length) {
  initializeApp({
    credential: cert(serviceAccount)
  });
}

const db = getFirestore();

export default async function handler(req, res) {
  try {
    const userId = req.query.userId || "guest"; // ganti sesuai login user
    const limit = parseInt(req.query.limit) || 10; // batch size
    const startAfterTimestamp = req.query.startAfter ? new Date(parseInt(req.query.startAfter)) : null;

    // Query Firestore
    let query = db.collection("posts").orderBy("timestamp", "desc").limit(100);
    if (startAfterTimestamp) query = query.startAfter(startAfterTimestamp);

    const snapshot = await query.get();
    let posts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Score feed cerdas
    posts = posts.map(post => {
      let score = 1;

      // post dari akun yang di-follow
      if (post.followers?.includes(userId)) score += 3;

      // post sejenis yang user suka
      if (post.tags && post.userLikes?.some(tag => post.tags.includes(tag))) score += 2;

      // boost post baru (<24 jam)
      const ageInHours = (Date.now() - post.timestamp.toMillis()) / (1000 * 60 * 60);
      if (ageInHours < 24) score += 1.5;

      return { ...post, score };
    });

    // Sortir berdasarkan score
    posts.sort((a, b) => b.score - a.score);

    // Ambil batch sesuai limit
    const batch = posts.slice(0, limit);

    // Kirim response + last timestamp untuk pagination
    const lastTimestamp = batch.length ? batch[batch.length - 1].timestamp.toMillis() : null;

    res.status(200).json({ posts: batch, lastTimestamp });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
}