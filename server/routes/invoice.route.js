import express from "express";
import auth from "../middlewares/auth.js";
import {
  downloadInvoiceByOrder,
  getInvoiceByOrder,
} from "../controllers/invoice.controller.js";

const router = express.Router();

router.get("/order/:orderId", auth, getInvoiceByOrder);
router.get("/order/:orderId/download", auth, downloadInvoiceByOrder);

export default router;
