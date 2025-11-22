importScripts('https://www.gstatic.com/firebasejs/11.6.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.6.1/firebase-messaging-compat.js');

// Masukkan Config Firebase KAMU di sini (Sama seperti di file React)
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

// Ini yang menangani pesan saat Web Tertutup (Background)
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: 'https://n.uguu.se/qXDmMTZB.jpg', // Ganti icon app kamu
    badge: 'https://n.uguu.se/qXDmMTZB.jpg'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
