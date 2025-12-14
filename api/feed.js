import admin from "firebase-admin";

// Variabel untuk menyimpan instance database, defaultnya null
let firestoreDb = null; 
let initError = null; // Variabel untuk menangkap error inisialisasi awal

// --- KONFIGURASI DAN INI IALISASI MODUL ---
// Kode ini dieksekusi HANYA SEKALI saat fungsi dimuat.

if (!admin.apps.length) {
  try {
    const serviceAccountStr = process.env.FIREBASE_SERVICE_ACCOUNT;
    
    // Pengecekan awal: Jika variabel lingkungan hilang, simpan error dan jangan lanjutkan.
    if (!serviceAccountStr) {
        throw new Error("Variabel FIREBASE_SERVICE_ACCOUNT hilang atau kosong.");
    }
    
    // Parse JSON di sini. Jika gagal, error akan ditangkap di catch.
    const serviceAccount = JSON.parse(serviceAccountStr); 
    
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    
    // Hanya inisialisasi Firestore setelah inisialisasi Admin berhasil.
    firestoreDb = admin.firestore();
    
  } catch (error) {
    // Tangkap error inisialisasi (JSON Parse, initApp)
    console.error("FIREBASE ADMIN CRITICAL INIT FAIL:", error);
    // Simpan error untuk didiagnosis di dalam handler
    initError = error; 
  }
} else {
    // Jika instance sudah ada, ambil referensi db (untuk dev lokal/hot reload)
    try {
        firestoreDb = admin.firestore();
    } catch(e) {
        console.error("Failed to get Firestore instance from existing admin app:", e);
        initError = e;
    }
}


const POSTS_PATH = "artifacts/default-app-id/public/data/post"; 
const USER_PROFILES_PATH = "userProfiles"; 

// ... (Helper functions: safeMillis, fetchUserProfile tetap sama) ...
// ...

export default async function handler(req, res) {
  
  // 1. Pengecekan Kritis Inisialisasi
  if (initError || !firestoreDb) {
      // Jika inisialisasi gagal di luar handler, kita akan merespons di sini
      let message = "❌ **Kesalahan Fatal:** Firebase Admin SDK gagal diinisialisasi.";
      let detail = initError ? initError.message : "Referensi database tidak ditemukan.";
      
      if (detail.includes("JSON")) {
         message += " Kemungkinan besar nilai `FIREBASE_SERVICE_ACCOUNT` bukan JSON yang valid atau rusak.";
      } else if (detail.includes("credential") || detail.includes("environment")) {
         message += " Variabel Lingkungan `FIREBASE_SERVICE_ACCOUNT` hilang, kosong, atau ada masalah izin.";
      }

      return res.status(500).json({
        error: true,
        message: message,
        detail: detail,
        errorCode: 'INIT_FAILURE'
      });
  }

  // Definisikan db di dalam handler
  const db = firestoreDb; 

  // ... (Sisa kode Anda dari baris try { ... } ke bawah tetap sama) ...
  // ... (Gunakan 'db' untuk query) ...
  
  try {
      const mode = req.query.mode || "home";
      // ... (lanjutan kode)
      
      let query = db.collection(POSTS_PATH);
      // ... (lanjutan kode)

  } catch (e) {
      // ... (Error handling yang sudah dibuat) ...
      console.error("FEED ERROR FATAL:", e);
      res.status(500).json({
        error: true,
        message: "Terjadi kesalahan server yang tidak terduga di tahap pemrosesan data. Deskripsi: " + e.message,
        errorCode: 'GENERAL_ERROR'
      });
  }
}