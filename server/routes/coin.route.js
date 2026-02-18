import express from "express";
import admin from "../middlewares/admin.js";
import auth from "../middlewares/auth.js";
import {
  getAdminCoinSettings,
  getPublicCoinSettings,
  getUserCoinBalance,
  getUserCoinsSummary,
  getUserCoinsTransactions,
  redeemUserCoinsController,
  saveAdminCoinSettings,
} from "../controllers/coin.controller.js";

const router = express.Router();

router.get("/settings/public", getPublicCoinSettings);
router.get("/me", auth, getUserCoinBalance);
router.get("/summary", auth, getUserCoinsSummary);
router.get("/transactions", auth, getUserCoinsTransactions);
router.post("/redeem", auth, redeemUserCoinsController);
router.get("/admin/settings", auth, admin, getAdminCoinSettings);
router.put("/admin/settings", auth, admin, saveAdminCoinSettings);

export default router;
