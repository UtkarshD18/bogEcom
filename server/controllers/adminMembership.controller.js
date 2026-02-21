import {
  convertUserToMember,
  extendMembershipUser,
  getMembershipAnalytics,
  getMembershipUserById,
  getMembershipUsers,
  toggleMembershipUserStatus,
  updateMembershipUserPoints,
} from "../services/membershipUser.service.js";
import { adjustCoinsByAdmin } from "../services/coin.service.js";

const toPositiveInt = (value, fallback = 0) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(Math.floor(num), 0);
};

const sendBadRequest = (res, message) =>
  res.status(400).json({
    error: true,
    success: false,
    message,
  });

const sendServerError = (res, message) =>
  res.status(500).json({
    error: true,
    success: false,
    message,
  });

export const getAdminMembershipUsers = async (req, res) => {
  try {
    const page = toPositiveInt(req.query?.page, 1) || 1;
    const limit = toPositiveInt(req.query?.limit, 10) || 10;
    const search = String(req.query?.search || "").trim();
    const filter = String(req.query?.filter || "all").trim();

    const data = await getMembershipUsers({ page, limit, search, filter });
    return res.status(200).json({
      error: false,
      success: true,
      data,
    });
  } catch (error) {
    console.error("Error fetching membership users:", error);
    return sendServerError(res, "Failed to fetch membership users");
  }
};

export const getAdminMembershipUserById = async (req, res) => {
  try {
    const membershipUserId = String(req.params?.id || "").trim();
    if (!membershipUserId) {
      return sendBadRequest(res, "membership user id is required");
    }

    const membershipUser = await getMembershipUserById(membershipUserId);
    if (!membershipUser) {
      return res.status(404).json({
        error: true,
        success: false,
        message: "Membership user not found",
      });
    }

    return res.status(200).json({
      error: false,
      success: true,
      data: membershipUser,
    });
  } catch (error) {
    console.error("Error fetching membership user by id:", error);
    return sendServerError(res, "Failed to fetch membership user");
  }
};

export const extendAdminMembershipUser = async (req, res) => {
  try {
    const membershipUserId = String(req.body?.membershipUserId || "").trim();
    const days = toPositiveInt(req.body?.days, 365) || 365;

    if (!membershipUserId) {
      return sendBadRequest(res, "membershipUserId is required");
    }

    const data = await extendMembershipUser({
      membershipUserId,
      days,
    });

    return res.status(200).json({
      error: false,
      success: true,
      message: `Membership extended by ${days} days`,
      data,
    });
  } catch (error) {
    console.error("Error extending membership user:", error);
    return sendBadRequest(res, error?.message || "Failed to extend membership");
  }
};

export const addPointsToAdminMembershipUser = async (req, res) => {
  try {
    const membershipUserId = String(req.body?.membershipUserId || "").trim();
    const points = Number(req.body?.points);
    const updatedBy = String(req.user?._id || req.user || "").trim() || null;

    if (!membershipUserId) {
      return sendBadRequest(res, "membershipUserId is required");
    }
    if (!Number.isFinite(points) || points === 0 || !Number.isInteger(points)) {
      return sendBadRequest(res, "points must be a non-zero whole number");
    }

    const membershipUser = await updateMembershipUserPoints({
      membershipUserId,
      pointsDelta: points,
    });
    const appliedDelta = Number(membershipUser?.appliedDelta || 0);
    const rawTargetUser = membershipUser?.user;
    const targetUserId =
      (rawTargetUser && rawTargetUser._id && String(rawTargetUser._id).trim()) ||
      (rawTargetUser && rawTargetUser.id && String(rawTargetUser.id).trim()) ||
      (rawTargetUser && String(rawTargetUser).trim()) ||
      null;
    let coinUpdate = null;

    if (appliedDelta !== 0 && targetUserId) {
      coinUpdate = await adjustCoinsByAdmin({
        userId: targetUserId,
        coinsDelta: appliedDelta,
        referenceId: `membership-points:${membershipUserId}:${Date.now()}`,
        meta: {
          membershipUserId,
          updatedBy,
          reason: "admin-membership-points-update",
        },
      });
    }

    return res.status(200).json({
      error: false,
      success: true,
      message:
        appliedDelta > 0 ? "Points added successfully" : "Points updated successfully",
      data: {
        ...membershipUser,
        coinUpdate,
      },
    });
  } catch (error) {
    console.error("Error updating membership points:", error);
    return sendBadRequest(
      res,
      error?.message || "Failed to update membership points",
    );
  }
};

export const toggleAdminMembershipUserStatus = async (req, res) => {
  try {
    const membershipUserId = String(req.body?.membershipUserId || "").trim();
    const action = String(req.body?.action || "").trim();

    if (!membershipUserId) {
      return sendBadRequest(res, "membershipUserId is required");
    }
    if (!action) {
      return sendBadRequest(res, "action is required");
    }

    const data = await toggleMembershipUserStatus({
      membershipUserId,
      action,
    });

    return res.status(200).json({
      error: false,
      success: true,
      message: action === "cancel" ? "Membership cancelled" : "Membership reactivated",
      data,
    });
  } catch (error) {
    console.error("Error toggling membership status:", error);
    return sendBadRequest(res, error?.message || "Failed to update membership status");
  }
};

export const getAdminMembershipAnalytics = async (req, res) => {
  try {
    const data = await getMembershipAnalytics();
    return res.status(200).json({
      error: false,
      success: true,
      data,
    });
  } catch (error) {
    console.error("Error fetching membership analytics:", error);
    return sendServerError(res, "Failed to fetch membership analytics");
  }
};

export const convertUserToMembershipAdmin = async (req, res) => {
  try {
    const userId = String(req.body?.userId || "").trim();
    const days = toPositiveInt(req.body?.days, 365) || 365;
    const adminId = req.userId || req.user?._id || null;

    if (!userId) {
      return sendBadRequest(res, "userId is required");
    }

    const data = await convertUserToMember({
      userId,
      days,
      activatedBy: adminId ? String(adminId) : null,
    });

    return res.status(200).json({
      error: false,
      success: true,
      message: data?.alreadyMember
        ? "User is already an active member"
        : "User converted to member successfully",
      data,
    });
  } catch (error) {
    console.error("Error converting user to member:", error);
    return sendBadRequest(res, error?.message || "Failed to convert user to member");
  }
};

export default {
  addPointsToAdminMembershipUser,
  convertUserToMembershipAdmin,
  extendAdminMembershipUser,
  getAdminMembershipAnalytics,
  getAdminMembershipUserById,
  getAdminMembershipUsers,
  toggleAdminMembershipUserStatus,
};
