import { Router } from "express";
import admin from "../middlewares/admin.js";
import auth from "../middlewares/auth.js";
import authOptional from "../middlewares/authOptional.js";
import { authLimiter } from "../middlewares/rateLimiter.js";
import { handleUploadError, uploadSingle } from "../middlewares/upload.js";

import {
  authWithGoogle,
  changePasswordController,
  deleteUser,
  forgotPasswordController,
  getAllUsers,
  getUserDetails,
  getUserSettings,
  loginUserController,
  logoutController,
  refreshTokenController,
  registerUserController,
  resendOTPController,
  setBackupPassword,
  updateUserProfile,
  updateUserRole,
  updateUserSettings,
  updateUserStatus,
  removeUserPhoto,
  uploadUserPhoto,
  updateUserGstNumber,
  verifyEmailController,
  verifyForgotPasswordOTPController,
} from "../controllers/user.controller.js";
import {
  getUserCoinsSummary,
  getUserCoinsTransactions,
} from "../controllers/coin.controller.js";

const userRouter = Router();

userRouter.post("/register", authLimiter, registerUserController);
userRouter.post("/verifyEmail", authLimiter, verifyEmailController);
userRouter.post("/login", authLimiter, loginUserController);
userRouter.post("/refresh-token", authLimiter, refreshTokenController);
userRouter.get("/logout", authOptional, logoutController);
userRouter.post("/forgot-Password", authLimiter, forgotPasswordController);
userRouter.post(
  "/verify-Forgot-Password-OTP",
  authLimiter,
  verifyForgotPasswordOTPController,
);
userRouter.post(
  "/forgot-Password/change-Password",
  authLimiter,
  changePasswordController,
);
userRouter.post("/resend-otp", authLimiter, resendOTPController);
userRouter.post("/authWithGoogle", authLimiter, authWithGoogle);
userRouter.post("/google-login", authLimiter, authWithGoogle); // Alias for compatibility
userRouter.post("/google-register", authLimiter, authWithGoogle); // Alias for registration
userRouter.post("/set-backup-password", auth, setBackupPassword); // Protected route for Google users

// User settings routes
userRouter.get("/settings", auth, getUserSettings);
userRouter.put("/settings", auth, updateUserSettings);
userRouter.put("/profile", auth, updateUserProfile);
userRouter.post(
  "/upload-photo",
  auth,
  uploadSingle("image"),
  handleUploadError,
  uploadUserPhoto,
);
userRouter.post("/remove-photo", auth, removeUserPhoto);
userRouter.delete("/remove-photo", auth, removeUserPhoto);
userRouter.put("/gst", auth, updateUserGstNumber);

// Get current user details (for session verification)
userRouter.get("/user-details", auth, async (req, res) => {
  try {
    const { default: UserModel } = await import("../models/user.model.js");
    const user = await UserModel.findById(req.user).select("-password");
    if (!user) {
      return res
        .status(404)
        .json({ error: true, success: false, message: "User not found" });
    }
    res.json({ error: false, success: true, data: user });
  } catch (error) {
    res.status(500).json({
      error: true,
      success: false,
      message: "Failed to get user details",
    });
  }
});

// User coins
userRouter.get("/coins-summary", auth, getUserCoinsSummary);
userRouter.get("/coin-transactions", auth, getUserCoinsTransactions);

// Admin routes for user management
userRouter.get("/admin/users", auth, admin, getAllUsers);
userRouter.get("/admin/users/:userId", auth, admin, getUserDetails);
userRouter.put("/admin/users/:userId/role", auth, admin, updateUserRole);
userRouter.put("/admin/users/:userId/status", auth, admin, updateUserStatus);
userRouter.delete("/admin/users/:userId", auth, admin, deleteUser);

export default userRouter;
