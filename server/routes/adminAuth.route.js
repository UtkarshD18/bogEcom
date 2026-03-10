import { Router } from "express";
import {
  adminGoogleLoginController,
  adminLoginController,
} from "../controllers/adminAuth.controller.js";

const adminAuthRouter = Router();

adminAuthRouter.post("/login", adminLoginController);
adminAuthRouter.post("/google-login", adminGoogleLoginController);

export default adminAuthRouter;
