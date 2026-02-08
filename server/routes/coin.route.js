import express from "express";
import admin from "../middlewares/admin.js";
import auth from "../middlewares/auth.js";
import {
  getAdminCoinSettings,
  getPublicCoinSettings,
  getUserCoinBalance,
  saveAdminCoinSettings,
} from "../controllers/coin.controller.js";

const router = express.Router();

router.get("/settings/public", getPublicCoinSettings);
router.get("/me", auth, getUserCoinBalance);
router.get("/admin/settings", auth, admin, getAdminCoinSettings);
router.put("/admin/settings", auth, admin, saveAdminCoinSettings);

export default router;
