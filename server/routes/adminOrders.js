import express from "express";
import auth from "../middlewares/auth.js";
import admin from "../middlewares/admin.js";
import { zodValidate } from "../middlewares/zodValidate.js";
import {
  orderIdParamSchema,
  updateOrderStatusSchema,
} from "../validation/orderSchemas.js";
import { updateOrderStatus, retryOrderShipment } from "../controllers/order.controller.js";
import {
  exportOrdersReport,
  getOrdersReport,
} from "../controllers/reportController.js";

const router = express.Router();

router.get("/report", auth, admin, getOrdersReport);
router.get("/export", auth, admin, exportOrdersReport);

router.patch(
  "/:id/status",
  auth,
  admin,
  zodValidate(orderIdParamSchema, "params"),
  zodValidate(updateOrderStatusSchema, "body"),
  (req, res, next) => {
    req.validatedData = {
      ...(req.validatedParams || {}),
      ...(req.validatedBody || {}),
    };
    next();
  },
  updateOrderStatus,
);

router.post(
  "/:id/retry-shipment",
  auth,
  admin,
  zodValidate(orderIdParamSchema, "params"),
  (req, res, next) => {
    req.validatedData = { ...(req.validatedParams || {}) };
    next();
  },
  retryOrderShipment,
);

export default router;
