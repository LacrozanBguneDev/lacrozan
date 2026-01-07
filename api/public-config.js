import { CONFIG } from "./config";

export default function handler(req, res) {
  res.json({
    APP_NAME: CONFIG.APP_NAME,
    APP_LOGO: CONFIG.APP_LOGO,
    DEV_PHOTO: CONFIG.DEV_PHOTO,
    API_ENDPOINT: CONFIG.API_ENDPOINT,
    firebaseConfig: CONFIG.firebaseConfig
  });
}