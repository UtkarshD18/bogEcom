import express from "express";
import optionalAuth from "../middlewares/optionalAuth.js";
import admin from "../middlewares/admin.js";
import auth from "../middlewares/auth.js";
import {
  convertPurchaseOrderToOrder,
  createPurchaseOrder,
  downloadPurchaseOrderPdf,
  getAllPurchaseOrdersAdmin,
  getPurchaseOrderById,
  updatePurchaseOrderStatus,
} from "../controllers/purchaseOrder.controller.js";

const router = express.Router();

router.get("/admin/all", auth, admin, getAllPurchaseOrdersAdmin);
router.patch("/admin/:id/status", auth, admin, updatePurchaseOrderStatus);
router.post("/", optionalAuth, createPurchaseOrder);
router.get("/:id", optionalAuth, getPurchaseOrderById);
router.get("/:id/pdf", optionalAuth, downloadPurchaseOrderPdf);
router.post("/:id/convert", optionalAuth, convertPurchaseOrderToOrder);

export default router;
