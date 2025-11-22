// sw.js - Service Worker Sederhana
self.addEventListener('install', (e) => {
  console.log('[Service Worker] Install');
});

self.addEventListener('push', function(event) {
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body,
      icon: data.icon || 'https://c.termai.cc/i46/b87.png',
      badge: 'https://c.termai.cc/i46/b87.png',
      data: {
        url: data.click_action || '/' // URL tujuan saat diklik
      }
    };
    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );
  }
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url)
  );
});