import admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    databaseURL: "https://eduku-web.firebaseio.com"
  });
}

const db = admin.firestore();

export default async function handler(req, res) {
  try {
    const userId = req.query.userId || "guest"; // ganti sesuai user login

    // Ambil 100 post terbaru
    const snapshot = await db.collection("posts")
                             .orderBy("timestamp", "desc")
                             .limit(100)
                             .get();

    let posts = [];
    snapshot.forEach(doc => posts.push({ id: doc.id, ...doc.data() }));

    // Hitung score feed
    posts = posts.map(post => {
      let score = 1; // base chance

      // post dari akun yang di-follow
      if (post.followers?.includes(userId)) score += 3;

      // post sejenis yang user suka
      if (post.tags && post.tags.some(tag => post.userLikes?.includes(tag))) score += 2;

      // post baru sedikit di-boost
      const ageInHours = (Date.now() - post.timestamp.toMillis()) / (1000*60*60);
      if (ageInHours < 24) score += 1.5;

      return { ...post, score };
    });

    // Sortir berdasarkan score
    posts.sort((a,b) => b.score - a.score);

    // Ambil batch kecil untuk frontend (misal 10 post)
    const batch = posts.slice(0, 10);

    // Return JSON siap render
    res.status(200).json({ posts: batch });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
}