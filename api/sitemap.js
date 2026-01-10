import fs from "fs";
import path from "path";

/* ====================== PATH DATA ====================== */
// Sesuaikan sesuai hosting / project
const POSTS_PATH = "artifacts/default-app-id/public/data/posts";
const USERS_PATH = "artifacts/default-app-id/public/data/userProfiles";

export default function handler(req, res) {
  const baseUrl = "https://app.bgunenet.my.id";
  let urls = [];

  // ====================== HOMEPAGE ======================
  urls.push(`
    <url>
      <loc>${baseUrl}/</loc>
      <priority>1.0</priority>
      <changefreq>daily</changefreq>
    </url>
  `);

  // ====================== POSTS ======================
  try {
    const postFiles = fs.readdirSync(POSTS_PATH); // baca semua file
    postFiles.forEach(file => {
      const postId = path.parse(file).name; // nama file = postId
      urls.push(`
        <url>
          <loc>${baseUrl}/?post=${postId}</loc>
          <priority>0.8</priority>
          <changefreq>weekly</changefreq>
        </url>
      `);
    });
  } catch (err) {
    console.error("Error reading posts:", err.message);
  }

  // ====================== USERS ======================
  try {
    const userFiles = fs.readdirSync(USERS_PATH); // baca semua file
    userFiles.forEach(file => {
      const userId = path.parse(file).name; // nama file = userId
      urls.push(`
        <url>
          <loc>${baseUrl}/?user=${userId}</loc>
          <priority>0.5</priority>
          <changefreq>monthly</changefreq>
        </url>
      `);
    });
  } catch (err) {
    console.error("Error reading users:", err.message);
  }

  // ====================== GENERATE XML ======================
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("")}
</urlset>`;

  // ====================== RESPONSE ======================
  res.setHeader("Content-Type", "application/xml");
  res.status(200).send(sitemap);
}