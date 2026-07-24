import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import mongoose from "mongoose";
import connectDb from "../config/connectDB.js";
import UserModel from "../models/user.model.js";
import { normalizeManagerPermissions } from "../utils/adminPermissions.js";

dotenv.config();

const normalizeEmail = (email) =>
  String(email || "")
    .trim()
    .toLowerCase();

const ADMIN_EMAIL = normalizeEmail(
  process.env.ADMIN_PRIMARY_EMAIL || "admin@buyonegram.com",
);
const MANAGER_EMAIL = normalizeEmail(
  process.env.MANAGER_PRIMARY_EMAIL || "manager@buyonegram.com",
);
const ADMIN_PASSWORD = String(process.env.ADMIN_PRIMARY_PASSWORD || "").trim();
const MANAGER_PASSWORD = String(
  process.env.MANAGER_PRIMARY_PASSWORD || "",
).trim();
const isProduction = process.env.NODE_ENV === "production";
const DEFAULT_ADMIN_PASSWORD = "admin123";

const RAW_MANAGER_DEFAULT_PERMISSIONS = String(
  process.env.MANAGER_DEFAULT_PERMISSIONS || "",
).trim();
const HAS_MANAGER_DEFAULT_PERMISSIONS =
  RAW_MANAGER_DEFAULT_PERMISSIONS.length > 0;
const MANAGER_DEFAULT_PERMISSIONS = normalizeManagerPermissions(
  RAW_MANAGER_DEFAULT_PERMISSIONS.split(",")
    .map((permission) => permission.trim())
    .filter(Boolean),
);

const upsertPrivilegedUser = async ({
  name,
  email,
  password,
  role,
  managerPermissions = null,
}) => {
  if (!email) {
    throw new Error(`Missing email for role ${role}`);
  }
  if (!password) {
    throw new Error(`Missing password for role ${role}`);
  }

  const existing = await UserModel.findOne({ email });
  const hashedPassword = await bcrypt.hash(password, 10);

  if (!existing) {
    const created = await UserModel.create({
      name,
      email,
      password: hashedPassword,
      role,
      verifyEmail: true,
      status: "active",
      managerPermissions:
        role === "Manager"
          ? normalizeManagerPermissions(
              Array.isArray(managerPermissions) ? managerPermissions : [],
            )
          : [],
    });

    return {
      role,
      email: created.email,
      action: "created",
    };
  }

  let updated = false;
  if (existing.role !== role) {
    existing.role = role;
    updated = true;
  }
  if (existing.verifyEmail !== true) {
    existing.verifyEmail = true;
    updated = true;
  }
  if (existing.status !== "active") {
    existing.status = "active";
    updated = true;
  }
  if (role === "Manager" && Array.isArray(managerPermissions)) {
    const normalized = normalizeManagerPermissions(managerPermissions);
    if (
      JSON.stringify(existing.managerPermissions || []) !==
      JSON.stringify(normalized)
    ) {
      existing.managerPermissions = normalized;
      updated = true;
    }
  } else if (
    Array.isArray(existing.managerPermissions) &&
    existing.managerPermissions.length > 0
  ) {
    existing.managerPermissions = [];
    updated = true;
  }
  if (!existing.password) {
    existing.password = hashedPassword;
    updated = true;
  }

  if (updated) {
    await existing.save();
  }

  return {
    role,
    email: existing.email,
    action: updated ? "updated" : "exists",
  };
};

const main = async () => {
  try {
    const resolvedAdminPassword = ADMIN_PASSWORD || (!isProduction ? DEFAULT_ADMIN_PASSWORD : "");
    if (!resolvedAdminPassword) {
      throw new Error(
        "Missing ADMIN_PRIMARY_PASSWORD. Set it in environment before running this script.",
      );
    }

    await connectDb();

    const adminResult = await upsertPrivilegedUser({
      name: "Admin",
      email: ADMIN_EMAIL,
      password: resolvedAdminPassword,
      role: "Admin",
      managerPermissions: null,
    });

    const managerResult = MANAGER_PASSWORD
      ? await upsertPrivilegedUser({
          name: "Manager",
          email: MANAGER_EMAIL,
          password: MANAGER_PASSWORD,
          role: "Manager",
          managerPermissions: HAS_MANAGER_DEFAULT_PERMISSIONS
            ? MANAGER_DEFAULT_PERMISSIONS
            : null,
        })
      : { role: "Manager", email: MANAGER_EMAIL, action: "skipped" };

    console.log("\nPrivileged users ready:\n");
    [adminResult, managerResult].forEach((result) => {
      console.log(`${result.role}: ${result.action}`);
      console.log(`  Email: ${result.email}`);
    });

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error(
      "Failed to ensure privileged users:",
      error?.message || error,
    );
    try {
      await mongoose.connection.close();
    } catch {
      // Ignore close errors.
    }
    process.exit(1);
  }
};

main();
