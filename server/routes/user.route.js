import { Router } from "express";
import admin from "../middlewares/admin.js";
import auth from "../middlewares/auth.js";

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
  updateUserRole,
  updateUserSettings,
  updateUserStatus,
  updateUserGstNumber,
  verifyEmailController,
  verifyForgotPasswordOTPController,
} from "../controllers/user.controller.js";

const userRouter = Router();

userRouter.post("/register", registerUserController);
userRouter.post("/verifyEmail", verifyEmailController);
userRouter.post("/login", loginUserController);
userRouter.post("/refresh-token", refreshTokenController);
userRouter.get("/logout", logoutController);
userRouter.post("/forgot-Password", forgotPasswordController);
userRouter.post(
  "/verify-Forgot-Password-OTP",
  verifyForgotPasswordOTPController,
);
userRouter.post("/forgot-Password/change-Password", changePasswordController);
userRouter.post("/resend-otp", resendOTPController);
userRouter.post("/authWithGoogle", authWithGoogle);
userRouter.post("/google-login", authWithGoogle); // Alias for compatibility
userRouter.post("/google-register", authWithGoogle); // Alias for registration
userRouter.post("/set-backup-password", auth, setBackupPassword); // Protected route for Google users

// User settings routes
userRouter.get("/settings", auth, getUserSettings);
userRouter.put("/settings", auth, updateUserSettings);
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

// Admin routes for user management
userRouter.get("/admin/users", auth, admin, getAllUsers);
userRouter.get("/admin/users/:userId", auth, admin, getUserDetails);
userRouter.put("/admin/users/:userId/role", auth, admin, updateUserRole);
userRouter.put("/admin/users/:userId/status", auth, admin, updateUserStatus);
userRouter.delete("/admin/users/:userId", auth, admin, deleteUser);

export default userRouter;
