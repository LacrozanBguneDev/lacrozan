// data.js
const siteData = {
  // Informasi umum channel
  channel: {
    name: "Minecraft Addon Master",
    logo: "https://via.placeholder.com/100?text=Logo", // ganti dengan URL logo asli
    description: "Tempatnya add-on keren dan tips Minecraft!",
    social: {
      youtube: "https://youtube.com/c/example",
      discord: "https://discord.gg/example",
      instagram: "https://instagram.com/example"
    }
  },

  // Daftar post (add-on, blog, dll)
  posts: [
    {
      id: 1,
      slug: "super-tools-addon",
      title: "Super Tools Addon",
      excerpt: "Tambahkan alat super kuat dengan efek ledakan!",
      content: "<p>Addon ini menambahkan pickaxe yang bisa menghancurkan area luas...</p><p>Unduh di <a href='#'>sini</a>.</p>",
      image: "https://via.placeholder.com/600x300?text=Super+Tools",
      ogImage: "https://via.placeholder.com/1200x630?text=Super+Tools+OG"
    },
    {
      id: 2,
      slug: "building-tips",
      title: "5 Tips Bangunan Cepat",
      excerpt: "Bangun rumah dalam 5 menit dengan trik ini!",
      content: "<p>Gunakan struktur scaffold dan bahan murah...</p>",
      image: "https://via.placeholder.com/600x300?text=Building+Tips",
      ogImage: "https://via.placeholder.com/1200x630?text=Building+Tips+OG"
    }
  ],

  // Halaman about
  about: {
    title: "Tentang Saya",
    content: "<p>Saya adalah kreator konten Minecraft sejak 2015. Spesialis add-on dan tutorial bangunan.</p><p>Gabung di Discord untuk diskusi!</p>"
  }
};