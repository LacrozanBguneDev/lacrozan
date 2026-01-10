import admin from "firebase-admin";

/* ================== INIT FIREBASE ADMIN ================== */
let db;

function initFirebase() {
  if (admin.apps.length) {
    db = admin.firestore();
    return;
  }

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT tidak ada");

  const serviceAccount = JSON.parse(
    raw.trim().startsWith("{")
      ? raw
      : Buffer.from(raw, "base64").toString("utf-8")
  );

  serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, "\n");

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  db = admin.firestore();
}

/* ================== SITEMAP HANDLER ================== */
export default async function handler(req, res) {
  try {
    initFirebase();

    res.setHeader("Content-Type", "application/xml");

    const baseUrl = "https://app.bgunenet.my.id";
    let urls = [];

    // HOME
    urls.push(`
      <url>
        <loc>${baseUrl}/</loc>
        <priority>1.0</priority>
      </url>
    `);

    // POSTS
    const postsSnap = await db.collection("posts").limit(500).get();
    postsSnap.forEach(doc => {
      urls.push(`
        <url>
          <loc>${baseUrl}/?post=${doc.id}</loc>
          <priority>0.8</priority>
        </url>
      `);
    });

    // USERS
    const usersSnap = await db.collection("userProfiles").limit(500).get();
    usersSnap.forEach(doc => {
      urls.push(`
        <url>
          <loc>${baseUrl}/?user=${doc.id}</loc>
          <priority>0.5</priority>
        </url>
      </url>
      `);
    });

    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("")}
</urlset>`;

    res.status(200).send(sitemap);
  } catch (err) {
    console.error("SITEMAP ERROR:", err.message);
    res.status(500).send("Sitemap generation failed");
  }
}