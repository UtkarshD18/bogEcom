import { Router } from "express";
import {
  createAddress,
  deleteAddress,
  getAddressById,
  getUserAddresses,
  setDefaultAddress,
  updateAddress,
} from "../controllers/address.controller.js";
import auth from "../middlewares/auth.js";

const addressRouter = Router();

// All address routes require authentication
addressRouter.get("/", auth, getUserAddresses);
addressRouter.get("/:addressId", auth, getAddressById);
addressRouter.post("/", auth, createAddress);
addressRouter.put("/:addressId", auth, updateAddress);
addressRouter.delete("/:addressId", auth, deleteAddress);
addressRouter.put("/:addressId/default", auth, setDefaultAddress);

export default addressRouter;
