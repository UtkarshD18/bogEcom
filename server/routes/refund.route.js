import express from "express";
import admin from "../middlewares/admin.js";
import auth from "../middlewares/auth.js";
import { evaluateRefund } from "../controllers/refund.controller.js";

const router = express.Router();

router.post("/evaluate", auth, admin, evaluateRefund);

export default router;
