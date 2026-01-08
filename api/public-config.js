export default function handler(req, res) {
  res.status(200).json({
    APP_NAME: "BguneNet",
    APP_LOGO: "https://c.termai.cc/i150/VrL65.png",
    DEV_PHOTO: "https://c.termai.cc/i6/EAb.jpg",
    API_ENDPOINT: "/api/feed"
  });
}