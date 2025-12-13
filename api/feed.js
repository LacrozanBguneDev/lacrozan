import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

if (!initializeApp.apps?.length) initializeApp({ credential: cert(serviceAccount) });

const db = getFirestore();

export default async function handler(req, res) {
  try {
    // Ambil 10 post terakhir tanpa filter apapun
    const snapshot = await db.collection("posts")
                             .orderBy("timestamp", "desc")
                             .limit(10)
                             .get();

    if (snapshot.empty) {
      return res.status(200).json({ posts: [], message: "Tidak ada data di Firestore!" });
    }

    const posts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.status(200).json({ posts });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
}