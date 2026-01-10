import admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });
}

const db = admin.firestore();

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/xml");

  const baseUrl = "https://app.bgunenet.my.id";

  let urls = [];

  // Homepage
  urls.push(`
    <url>
      <loc>${baseUrl}/</loc>
      <changefreq>daily</changefreq>
      <priority>1.0</priority>
    </url>
  `);

  // POSTS
  const postsSnap = await db.collection("posts").get();
  postsSnap.forEach(doc => {
    urls.push(`
      <url>
        <loc>${baseUrl}/?post=${doc.id}</loc>
        <changefreq>weekly</changefreq>
        <priority>0.8</priority>
      </url>
    `);
  });

  // USERS
  const usersSnap = await db.collection("users").get();
  usersSnap.forEach(doc => {
    urls.push(`
      <url>
        <loc>${baseUrl}/?user=${doc.id}</loc>
        <changefreq>monthly</changefreq>
        <priority>0.5</priority>
      </url>
    `);
  });

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
  <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    ${urls.join("")}
  </urlset>`;

  res.status(200).send(sitemap);
}
