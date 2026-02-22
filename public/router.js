// router.js

// Fungsi untuk memperbarui meta tags OG dan title
function updateMeta(title, description, image) {
  document.title = title + " - " + siteData.channel.name;
  
  setMeta("og:title", title);
  setMeta("og:description", description);
  setMeta("og:image", image || siteData.channel.logo);
  setMeta("og:url", window.location.href);
  setMeta("description", description);
}

function setMeta(name, content) {
  let selector = `meta[name="${name}"], meta[property="${name}"]`;
  let meta = document.querySelector(selector);
  if (meta) {
    meta.setAttribute("content", content);
  } else {
    // jika belum ada, buat baru
    meta = document.createElement("meta");
    if (name.startsWith("og:")) {
      meta.setAttribute("property", name);
    } else {
      meta.setAttribute("name", name);
    }
    meta.setAttribute("content", content);
    document.head.appendChild(meta);
  }
}

// Fungsi render halaman berdasarkan hash
function render() {
  const hash = window.location.hash.slice(1) || "/"; // default ke "/"
  const app = document.getElementById("app");
  
  // Routing sederhana
  if (hash === "/") {
    renderHome(app);
  } else if (hash === "/about") {
    renderAbout(app);
  } else if (hash.startsWith("/post/")) {
    const slug = hash.replace("/post/", "");
    renderPost(app, slug);
  } else {
    renderNotFound(app);
  }
}

// Render halaman home
function renderHome(container) {
  const posts = siteData.posts.map(post => `
    <div class="bg-white rounded-lg shadow-md p-4">
      <img src="${post.image}" alt="${post.title}" class="w-full h-48 object-cover rounded">
      <h2 class="text-xl font-bold mt-2">${post.title}</h2>
      <p class="text-gray-600">${post.excerpt}</p>
      <a href="#/post/${post.slug}" class="inline-block mt-2 text-blue-500">Baca selengkapnya →</a>
    </div>
  `).join('');

  container.innerHTML = `
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      ${posts}
    </div>
  `;

  updateMeta(
    "Beranda",
    siteData.channel.description,
    siteData.channel.logo
  );
}

// Render halaman about
function renderAbout(container) {
  container.innerHTML = `
    <div class="bg-white p-6 rounded-lg shadow">
      <h1 class="text-3xl font-bold mb-4">${siteData.about.title}</h1>
      <div class="prose">${siteData.about.content}</div>
    </div>
  `;

  updateMeta(
    siteData.about.title,
    "Tentang channel Minecraft Addon Master",
    siteData.channel.logo
  );
}

// Render halaman post
function renderPost(container, slug) {
  const post = siteData.posts.find(p => p.slug === slug);
  if (!post) {
    renderNotFound(container);
    return;
  }

  container.innerHTML = `
    <div class="bg-white p-6 rounded-lg shadow">
      <img src="${post.image}" alt="${post.title}" class="w-full h-64 object-cover rounded mb-4">
      <h1 class="text-3xl font-bold mb-2">${post.title}</h1>
      <div class="prose">${post.content}</div>
      <a href="#/" class="inline-block mt-4 text-blue-500">← Kembali</a>
    </div>
  `;

  updateMeta(
    post.title,
    post.excerpt,
    post.ogImage || post.image
  );
}

// Render halaman 404
function renderNotFound(container) {
  container.innerHTML = `
    <div class="text-center py-12">
      <h1 class="text-4xl font-bold">404</h1>
      <p class="text-xl">Halaman tidak ditemukan</p>
      <a href="#/" class="text-blue-500 mt-4 inline-block">Kembali ke beranda</a>
    </div>
  `;

  updateMeta("404 - Halaman tidak ditemukan", "Maaf, halaman yang kamu cari tidak ada.", siteData.channel.logo);
}

// Jalankan render saat pertama load dan setiap hash berubah
window.addEventListener("load", render);
window.addEventListener("hashchange", render);