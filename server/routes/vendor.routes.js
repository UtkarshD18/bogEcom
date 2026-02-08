import express from "express";
import {
  createVendor,
  deleteVendor,
  getVendors,
  updateVendor,
} from "../controllers/vendor.controller.js";
import admin from "../middlewares/admin.js";
import auth from "../middlewares/auth.js";

const vendorRoutes = express.Router();

// All vendor routes require admin authentication
vendorRoutes.get("/", auth, admin, getVendors);
vendorRoutes.post("/", auth, admin, createVendor);
vendorRoutes.put("/:id", auth, admin, updateVendor);
vendorRoutes.delete("/:id", auth, admin, deleteVendor);

export default vendorRoutes;
