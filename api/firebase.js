// backend/routes/firebase.js
import express from "express";
import { secretFirebaseConfig } from "../secretConfig.js";
const router = express.Router();

router.get("/firebase-config", (req, res) => {
  // optional: cek auth token user
  res.json(secretFirebaseConfig);
});

export default router;