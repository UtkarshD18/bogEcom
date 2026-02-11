import express from "express";
import auth from "../middlewares/auth.js";
import { isAdmin } from "../middlewares/admin.js";
import {
  getInventoryAudit,
  getInventoryAuditByProduct,
} from "../controllers/inventoryAudit.controller.js";

const router = express.Router();

router.get("/audit", auth, isAdmin, getInventoryAudit);
router.get("/audit/:productId", auth, isAdmin, getInventoryAuditByProduct);

export default router;
