// IMPORTS Wajib
importScripts('https://www.gstatic.com/firebasejs/11.6.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.6.1/firebase-messaging-compat.js');

// CONFIG FIREBASE
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

// Background notif (Firebase)
messaging.onBackgroundMessage((payload) => {
  const n = payload.notification;
  self.registration.showNotification(n.title, {
    body: n.body,
    icon: 'https://n.uguu.se/qXDmMTZB.jpg',
    badge: 'https://n.uguu.se/qXDmMTZB.jpg'
  });
});

// ======== Fitur PWA ========

// Install SW
self.addEventListener('install', () => {
  console.log('[SW] Installed');
});

// Push Notif Manual
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