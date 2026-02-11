import express from "express";
import auth from "../middlewares/auth.js";
import admin from "../middlewares/admin.js";
import { updateOrderStatus } from "../controllers/order.controller.js";
import { zodValidate } from "../middlewares/zodValidate.js";
import {
  orderIdParamSchema,
  updateOrderStatusSchema,
} from "../validation/orderSchemas.js";

const router = express.Router();

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

export default router;
