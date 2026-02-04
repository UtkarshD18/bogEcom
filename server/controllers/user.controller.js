import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import UserModel from "../models/user.model.js";

import sendEmailFun from "../config/sendEmail.js";
import generateAccessToken from "../utils/generateAccessToken.js";
import generateRefreshToken from "../utils/generateRefreshToken.js";
import VerificationEmail from "../utils/verifyEmailTemplate.js";

/**
 * Validate password strength
 * @param {string} password
 * @returns {{ isValid: boolean, message: string }}
 */
function validatePassword(password) {
  const minLength = 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);

  if (password.length < minLength) {
    return {
      isValid: false,
      message: `Password must be at least ${minLength} characters`,
    };
  }
  if (!hasUpperCase || !hasLowerCase) {
    return {
      isValid: false,
      message: "Password must contain both uppercase and lowercase letters",
    };
  }
  if (!hasNumbers) {
    return {
      isValid: false,
      message: "Password must contain at least one number",
    };
  }
  return { isValid: true, message: "" };
}

/**
 * Validate email format
 * @param {string} email
 * @returns {boolean}
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export async function registerUserController(req, res) {
  try {
    let user;
    const { name, email, password } = req.body;

    // Input validation
    if (!name || !email || !password) {
      return res.status(400).json({
        message: "All fields are required",
        error: true,
        success: false,
      });
    }

    // Validate email format
    if (!isValidEmail(email)) {
      return res.status(400).json({
        message: "Please provide a valid email address",
        error: true,
        success: false,
      });
    }

    // Validate password strength
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      return res.status(400).json({
        message: passwordValidation.message,
        error: true,
        success: false,
      });
    }

    // Sanitize name (remove potential XSS)
    const sanitizedName = name.trim().replace(/<[^>]*>/g, "");

    user = await UserModel.findOne({ email: email.toLowerCase().trim() });
    if (user) {
      return res.status(400).json({
        message: "User already exists",
        error: true,
        success: false,
      });
    }
    const verifyCode = Math.floor(100000 + Math.random() * 900000).toString();
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    user = new UserModel({
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      name: sanitizedName,
      otp: verifyCode,

      otpExpires: Date.now() + 600000,
    });
    await user.save();
    const emailSent = await sendEmailFun({
      sendTo: email,
      subject: "Verify email from BuyOneGram",
      text: "",
      html: VerificationEmail(name, verifyCode),
    });

    const token = jwt.sign(
      { email: user?.email, id: user?._id },
      process.env.JSON_WEB_TOKEN_SECRET_KEY,
    );

    if (!emailSent) {
      console.error("Verification email failed to send for:", email);
      return res.status(500).json({
        success: false,
        error: true,
        message: "User registered but failed to send verification email.",
        token: token,
      });
    }

    return res.status(200).json({
      success: true,
      error: false,
      message: "User registered successfully. Please verify your email.",
      token: token,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: true,
      message: error.message || error,
    });
  }
}

export async function verifyEmailController(req, res) {
  try {
    const { email, otp } = req.body;
    const user = await UserModel.findOne({ email: email });
    if (!user) {
      return res.status(400).json({
        success: false,
        error: true,
        message: "User not found",
      });
    }

    const isCodeValid = user.otp === otp;
    const isNotExpires = user.otpExpires > Date.now();
    if (isCodeValid && isNotExpires) {
      user.verify_Email = true;
      user.otp = null;
      user.otpExpires = null;
      await user.save();
      return res.status(200).json({
        success: true,
        error: false,
        message: "Email verified",
      });
    } else if (!isCodeValid) {
      return res.status(400).json({
        message: "Invalid OTP",
        error: true,
        success: false,
      });
    } else {
      return res.status(400).json({
        message: "OTP has expired",
        error: true,
        success: false,
      });
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: true,
      message: error.message || error,
    });
  }
}

export async function loginUserController(req, res) {
  try {
    const { email, password } = req.body;
    const user = await UserModel.findOne({ email: email });
    if (!user) {
      return res.status(400).json({
        success: false,
        error: true,
        message: "User not found",
      });
    }

    if (user.status !== "active") {
      return res.status(400).json({
        success: false,
        error: true,
        message: `Please contact support.`,
      });
    }

    if (user?.verifyEmail !== true) {
      return res.status(400).json({
        success: false,
        error: true,
        message: "Please verify your email before logging in.",
      });
    }

    const checkPassword = await bcrypt.compare(password, user.password);

    if (!checkPassword) {
      return res.status(400).json({
        success: false,
        error: true,
        message: "check your password",
      });
    }

    const accessToken = await generateAccessToken(user._id);
    const refreshToken = await generateRefreshToken(user._id);

    const updateUser = await UserModel.findByIdAndUpdate(user?._id, {
      last_login_date: new Date(),
    });

    const cookiesOption = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "None" : "Lax",
    };

    res.cookie("accessToken", accessToken, cookiesOption);
    res.cookie("refreshToken", refreshToken, cookiesOption);

    return res.json({
      message: "Login successful",
      success: true,
      error: false,
      data: {
        accessToken,
        refreshToken,
        userEmail: user?.email,
        userName: user?.name,
        role: user?.role,
        userId: user?._id,
        avatar: user?.avatar,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: true,
      message: error.message || error,
    });
  }
}

export async function logoutController(req, res) {
  try {
    const userId = req?.userId;
    const cookiesOption = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "None" : "Lax",
    };

    res.clearCookie("accessToken", cookiesOption);
    res.clearCookie("refreshToken", cookiesOption);

    const removeRefreshToken = await UserModel.findByIdAndUpdate(userId, {
      refreshToken: "",
    });

    return res.json({
      message: "Logout successful",
      success: true,
      error: false,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: true,
      message: error.message || error,
    });
  }
}

export async function forgotPasswordController(req, res) {
  try {
    const { email } = req.body;
    const user = await UserModel.findOne({ email: email });
    if (!user) {
      return res.status(400).json({
        success: false,
        error: true,
        message: "User not found",
      });
    } else {
      const verifyCode = Math.floor(100000 + Math.random() * 900000).toString();

      user.otp = verifyCode;
      user.otpExpires = Date.now() + 600000;
      await user.save();
      await sendEmailFun({
        sendTo: email,
        subject: "verify OTP for password reset",
        text: "",
        html: VerificationEmail(user.name, verifyCode),
      });
      return res.json({
        success: true,
        error: false,
        message: "OTP sent to your email",
      });
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: true,
      message: error.message || error,
    });
  }
}

export async function verifyForgotPasswordOTPController(req, res) {
  try {
    const { email, otp, newPassword } = req.body;
    const user = await UserModel.findOne({ email: email });
    if (!user) {
      return res.status(400).json({
        success: false,
        error: true,
        message: "User not found",
      });
    }
    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        error: true,
        message: "Email and OTP are required",
      });
    }
    if (user.otp !== otp) {
      return res.status(400).json({
        success: false,
        error: true,
        message: "Invalid OTP",
      });
    }

    const currentTime = new Date().toString();
    if (user.otpExpires < currentTime) {
      return res.status(400).json({
        success: false,
        error: true,
        message: "OTP has expired",
      });
    }
    user.otp = "";
    user.otpExpires = "";

    await user.save();

    return res.status(200).json({
      success: true,
      error: false,
      message: "OTP verified. You can now reset your password.",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: true,
      message: error.message || error,
    });
  }
}

export async function changePasswordController(req, res) {
  try {
    const { email, newPassword, confirmPassword } = req.body;
    const user = await UserModel.findOne({ email: email });
    if (!user) {
      return res.status(400).json({
        success: false,
        error: true,
        message: "User not found",
      });
    }
    if (!email || !newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        error: true,
        message: "provide all fields",
      });
    }
    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        error: true,
        message: "passwords do not match",
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    user.password = hashedPassword;
    user.signUpWithGoogle = false;
    await user.save();

    return res.status(200).json({
      success: true,
      error: false,
      message: "Password changed successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: true,
      message: error.message || error,
    });
  }
}

//resend OTP
export async function resendOTPController(req, res) {
  try {
    const { email } = req.body;
    const user = await UserModel.findOne({ email: email });
    if (!user) {
      return res.status(400).json({
        success: false,
        error: true,
        message: "User not found",
      });
    }
    const verifyCode = Math.floor(100000 + Math.random() * 900000).toString();
    user.otp = verifyCode;
    user.otpExpires = Date.now() + 600000;

    await user.save();
    const emailSent = await sendEmailFun({
      sendTo: email,
      subject: "Verify email from HealthyOneGram",
      text: "",
      html: VerificationEmail(user?.name, verifyCode),
    });
    if (!emailSent) {
      console.error("Verification email failed to send for:", email);
      return res.status(500).json({
        success: false,
        error: true,
        message: "Failed to resend verification email.",
      });
    }
    return res.status(200).json({
      success: true,
      error: false,
      message: "Verification email resent successfully.",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: true,
      message: error.message || error,
    });
  }
}

export async function authWithGoogle(req, res) {
  try {
    const { email, name, password, avatar, mobile, role, googleId } = req.body;
    let user = await UserModel.findOne({ email: email });

    if (!user) {
      // Create new user with Google auth
      user = new UserModel({
        email: email,
        name: name,
        verifyEmail: true, // Fixed field name
        signUpWithGoogle: true,
        role: role === "Admin" ? "Admin" : "User",
        avatar: avatar || "",
        mobile: mobile || "",
        googleId: googleId || null,
        provider: "google",
        // No password needed for Google users due to conditional validation
      });
      await user.save();
    } else {
      // Update existing user with Google data if needed
      if (avatar && !user.avatar) {
        user.avatar = avatar;
      }
      if (googleId && !user.googleId) {
        user.googleId = googleId;
      }
      if (user.provider === "local") {
        user.provider = "google";
        user.signUpWithGoogle = true;
      }
      await user.save();
    }

    // Generate tokens for both new and existing users
    const accessToken = await generateAccessToken(user._id);
    const refreshToken = await generateRefreshToken(user._id);
    await UserModel.findByIdAndUpdate(user._id, {
      last_login_date: new Date(),
    });

    const cookiesOption = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "None" : "Lax",
    };

    res.cookie("accessToken", accessToken, cookiesOption);
    res.cookie("refreshToken", refreshToken, cookiesOption);

    return res.json({
      message: "Google login successful",
      success: true,
      error: false,
      data: {
        accessToken,
        refreshToken,
        userEmail: user?.email,
        userName: user?.name,
        userPhoto: user?.avatar,
      },
    });
  } catch (error) {
    console.error("Google auth error:", error);
    return res.status(500).json({
      success: false,
      error: true,
      message: error.message || error,
    });
  }
}

// Set backup password for Google users
export async function setBackupPassword(req, res) {
  try {
    const { password } = req.body;
    const userId = req.user?._id; // Assuming auth middleware provides user

    if (!password) {
      return res.status(400).json({
        success: false,
        error: true,
        message: "Password is required",
      });
    }

    const user = await UserModel.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: true,
        message: "User not found",
      });
    }

    if (user.provider !== "google") {
      return res.status(400).json({
        success: false,
        error: true,
        message: "Backup passwords are only for Google users",
      });
    }

    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Update user
    await UserModel.findByIdAndUpdate(userId, {
      password: hashedPassword,
      hasBackupPassword: true,
      provider: "mixed", // Now supports both Google and password login
    });

    return res.json({
      success: true,
      error: false,
      message:
        "Backup password set successfully. You can now login with email/password too!",
    });
  } catch (error) {
    console.error("Set backup password error:", error);
    return res.status(500).json({
      success: false,
      error: true,
      message: error.message || error,
    });
  }
}

// Get all users (Admin only)
export async function getAllUsers(req, res) {
  try {
    const { page = 1, limit = 10, search = "", role = "" } = req.query;

    const query = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    if (role && ["User", "Admin"].includes(role)) {
      query.role = role;
    }

    const users = await UserModel.find(query)
      .select("-password -otp -otpExpires -refreshToken")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await UserModel.countDocuments(query);

    return res.json({
      success: true,
      error: false,
      data: users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get all users error:", error);
    return res.status(500).json({
      success: false,
      error: true,
      message: error.message || error,
    });
  }
}

// Update user role (Admin only)
export async function updateUserRole(req, res) {
  try {
    const { userId } = req.params;
    const { role } = req.body;

    if (!["User", "Admin"].includes(role)) {
      return res.status(400).json({
        success: false,
        error: true,
        message: "Invalid role. Must be 'User' or 'Admin'",
      });
    }

    // Prevent admin from demoting themselves
    if (req.user._id.toString() === userId && role === "User") {
      return res.status(400).json({
        success: false,
        error: true,
        message: "You cannot demote yourself",
      });
    }

    const user = await UserModel.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: true,
        message: "User not found",
      });
    }

    user.role = role;
    await user.save();

    return res.json({
      success: true,
      error: false,
      message: `User role updated to ${role}`,
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Update user role error:", error);
    return res.status(500).json({
      success: false,
      error: true,
      message: error.message || error,
    });
  }
}

// Update user status (Admin only)
export async function updateUserStatus(req, res) {
  try {
    const { userId } = req.params;
    const { status } = req.body;

    if (!["active", "inactive", "Suspended"].includes(status)) {
      return res.status(400).json({
        success: false,
        error: true,
        message: "Invalid status. Must be 'active', 'inactive', or 'Suspended'",
      });
    }

    // Prevent admin from suspending themselves
    if (req.user._id.toString() === userId && status !== "active") {
      return res.status(400).json({
        success: false,
        error: true,
        message: "You cannot suspend yourself",
      });
    }

    const user = await UserModel.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: true,
        message: "User not found",
      });
    }

    user.status = status;
    await user.save();

    return res.json({
      success: true,
      error: false,
      message: `User status updated to ${status}`,
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        status: user.status,
      },
    });
  } catch (error) {
    console.error("Update user status error:", error);
    return res.status(500).json({
      success: false,
      error: true,
      message: error.message || error,
    });
  }
}

// Get user details (Admin only)
export async function getUserDetails(req, res) {
  try {
    const { userId } = req.params;

    const user = await UserModel.findById(userId).select(
      "-password -otp -otpExpires -refreshToken",
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        error: true,
        message: "User not found",
      });
    }

    return res.json({
      success: true,
      error: false,
      data: user,
    });
  } catch (error) {
    console.error("Get user details error:", error);
    return res.status(500).json({
      success: false,
      error: true,
      message: error.message || error,
    });
  }
}

// Delete user (Admin only)
export async function deleteUser(req, res) {
  try {
    const { userId } = req.params;

    // Prevent admin from deleting themselves
    if (req.user._id.toString() === userId) {
      return res.status(400).json({
        success: false,
        error: true,
        message: "You cannot delete yourself",
      });
    }

    const user = await UserModel.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: true,
        message: "User not found",
      });
    }

    await UserModel.findByIdAndDelete(userId);

    return res.json({
      success: true,
      error: false,
      message: "User deleted successfully",
    });
  } catch (error) {
    console.error("Delete user error:", error);
    return res.status(500).json({
      success: false,
      error: true,
      message: error.message || error,
    });
  }
}

// Get user settings
export async function getUserSettings(req, res) {
  try {
    const userId = req.user._id;

    const user = await UserModel.findById(userId).select(
      "notificationSettings preferences",
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        error: true,
        message: "User not found",
      });
    }

    // Return settings with defaults if not set
    const settings = {
      notificationSettings: user.notificationSettings || {
        emailNotifications: true,
        pushNotifications: false,
        orderUpdates: true,
        promotionalEmails: false,
      },
      preferences: user.preferences || {
        darkMode: false,
        language: "en",
      },
    };

    return res.json({
      success: true,
      error: false,
      data: settings,
    });
  } catch (error) {
    console.error("Get user settings error:", error);
    return res.status(500).json({
      success: false,
      error: true,
      message: error.message || error,
    });
  }
}

// Update user settings
export async function updateUserSettings(req, res) {
  try {
    const userId = req.user._id;
    const { notificationSettings, preferences } = req.body;

    const updateData = {};

    if (notificationSettings) {
      updateData.notificationSettings = {
        emailNotifications: notificationSettings.emailNotifications ?? true,
        pushNotifications: notificationSettings.pushNotifications ?? false,
        orderUpdates: notificationSettings.orderUpdates ?? true,
        promotionalEmails: notificationSettings.promotionalEmails ?? false,
      };
    }

    if (preferences) {
      updateData.preferences = {
        darkMode: preferences.darkMode ?? false,
        language: preferences.language ?? "en",
      };
    }

    const user = await UserModel.findByIdAndUpdate(
      userId,
      { $set: updateData },
      { new: true },
    ).select("notificationSettings preferences");

    if (!user) {
      return res.status(404).json({
        success: false,
        error: true,
        message: "User not found",
      });
    }

    return res.json({
      success: true,
      error: false,
      message: "Settings updated successfully",
      data: {
        notificationSettings: user.notificationSettings,
        preferences: user.preferences,
      },
    });
  } catch (error) {
    console.error("Update user settings error:", error);
    return res.status(500).json({
      success: false,
      error: true,
      message: error.message || error,
    });
  }
}
