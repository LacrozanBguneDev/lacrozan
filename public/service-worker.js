// ====================================================================
// BAGIAN 1: KONFIGURASI PWA & CACHING
// ====================================================================

// Nama versi Cache. Ganti versi (misal: v2) jika ada perubahan file
const CACHE_NAME = 'lacrozan-static-v1'; 

// Daftar file yang WAJIB disimpan saat pertama kali diinstal (Pre-caching)
// PASTIKAN SEMUA PATH INI BENAR SESUAI FOLDER PUBLIC
const URLS_TO_CACHE = [
  '/', 
  '/index.html',
  '/manifest.json',
  '/main.jsx', 
  // Jika Anda punya ikon PWA di folder public, tambahkan di sini:
  // Contoh: '/icon-192x192.png',
  // Contoh: '/icon-512x512.png',
];

// ====================================================================
// BAGIAN 2: KONFIGURASI FIREBASE MESSAGING
// ====================================================================

// IMPORTS Wajib
importScripts('https://www.gstatic.com/firebasejs/11.6.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.6.1/firebase-messaging-compat.js');

// CONFIG FIREBASE (Gunakan konfigurasi Anda yang sudah ada)
firebase.initializeApp({
  apiKey: "AIzaSyDz8mZoFdWLZs9zRC2xDndRzKQ7sju-Goc",
  authDomain: "eduku-web.firebaseapp.com",
  projectId: "eduku-web",
  storageBucket: "eduku-web.firebasestorage.com",
  messagingSenderId: "662463693471",
  appId: "1:662463693471:web:e0f19e4497aa3f1de498aa",
  measurementId: "G-G0VWNHHVB8"
});

const messaging = firebase.messaging();


// ====================================================================
// BAGIAN 3: SERVICE WORKER EVENTS (INSTALL, ACTIVATE, FETCH)
// ====================================================================

// 1. INSTALLATION (Pre-caching Aset)
self.addEventListener('install', (event) => {
  console.log('[SW] Installed. Starting pre-caching...');
  
  // Perintah untuk menyimpan semua aset di URLS_TO_CACHE
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(URLS_TO_CACHE);
      })
      .then(() => {
         console.log('[SW] Semua aset inti berhasil di-pre-cache.');
      })
      .catch((error) => {
         console.error('[SW] Gagal Pre-cache (Pastikan semua path benar!):', error);
      })
  );
  // Perintah ini membuat SW baru segera aktif (tidak perlu menutup semua tab)
  self.skipWaiting();
});

// 2. ACTIVATION (Membersihkan Cache Lama)
self.addEventListener('activate', (event) => {
  console.log('[SW] Activated.');
  // Membersihkan cache lama jika versi cache berubah (misal dari v1 ke v2)
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.filter((cacheName) => {
          return cacheName !== CACHE_NAME; // Hapus cache yang bukan versi terbaru
        }).map((cacheName) => {
          return caches.delete(cacheName);
        })
      );
    })
  );
  // Memberikan kendali penuh kepada Service Worker baru
  event.waitUntil(self.clients.claim());
});


// 3. FETCH (Strategi Caching: Cache-First)
self.addEventListener('fetch', (event) => {
  // Hanya proses GET request
  if (event.request.method !== 'GET') return; 

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Jika file ada di cache, segera kembalikan dari cache (Offline Support!)
        if (response) {
          return response;
        }

        // Jika tidak ada di cache, ambil dari jaringan
        return fetch(event.request);
      })
  );
});


// ====================================================================
// BAGIAN 4: LOGIKA NOTIFIKASI FIREBASE & PWA
// ====================================================================

// Background notif (Firebase)
messaging.onBackgroundMessage((payload) => {
  const n = payload.notification;
  self.registration.showNotification(n.title, {
    body: n.body,
    icon: 'https://n.uguu.se/qXDmMTZB.jpg',
    badge: 'https://n.uguu.se/qXDmMTZB.jpg'
  });
});

// Push Notif Manual (jika ada push notif non-firebase)
self.addEventListener('push', (event) => {
  if (!event.data) return;

  const data = event.data.json();
  self.registration.showNotification(data.title, {
    body: data.body,
    icon: data.icon || 'https://n.uguu.se/qXDmMTZB.jpg',
    badge: 'https://n.uguu.se/qXDmMTZB.jpg',
    data: { url: data.click_action || '/' }
  });
});

// Klik Notif
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data.url));
});