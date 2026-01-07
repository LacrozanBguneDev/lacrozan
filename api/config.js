export const CONFIG = {
  // 🔒 RAHASIA (backend only)
  DEVELOPER_EMAIL: process.env.DEV_EMAIL,
  API_KEY: process.env.APP_API_KEY,
  VAPID_KEY: process.env.VAPID_KEY,
  FEED_API_KEY: process.env.FEED_API_KEY,

  // 🌍 PUBLIK
  APP_NAME: "BguneNet",
  APP_LOGO: "https://c.termai.cc/i150/VrL65.png",
  DEV_PHOTO: "https://c.termai.cc/i6/EAb.jpg",

  API_ENDPOINT: "/api/feed",

  firebaseConfig: {
    apiKey: "AIzaSyDz8mZoFdWLZs9zRC2xDndRzKQ7sju-Goc",
    authDomain: "eduku-web.firebaseapp.com",
    projectId: "eduku-web",
    storageBucket: "eduku-web.firebasestorage.com",
    messagingSenderId: "662463693471",
    appId: "1:662463693471:web:e0f19e4497aa3f1de498aa",
    measurementId: "G-G0VWNHHVB8",
  }
};