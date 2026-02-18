import express from "express";
import {
  addPointsToAdminMembershipUser,
  convertUserToMembershipAdmin,
  extendAdminMembershipUser,
  getAdminMembershipAnalytics,
  getAdminMembershipUserById,
  getAdminMembershipUsers,
  toggleAdminMembershipUserStatus,
} from "../controllers/adminMembership.controller.js";
import admin from "../middlewares/admin.js";
import auth from "../middlewares/auth.js";

const router = express.Router();

router.get("/membership-users", auth, admin, getAdminMembershipUsers);
router.get("/membership-users/:id", auth, admin, getAdminMembershipUserById);
router.post("/membership-users/extend", auth, admin, extendAdminMembershipUser);
router.post(
  "/membership-users/add-points",
  auth,
  admin,
  addPointsToAdminMembershipUser,
);
router.post(
  "/membership-users/toggle-status",
  auth,
  admin,
  toggleAdminMembershipUserStatus,
);
router.post("/membership-users/convert", auth, admin, convertUserToMembershipAdmin);
router.get("/membership-analytics", auth, admin, getAdminMembershipAnalytics);

export default router;
