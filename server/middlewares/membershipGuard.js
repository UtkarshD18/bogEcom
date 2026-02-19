import MembershipUserModel from "../models/membershipUser.model.js";
import UserModel from "../models/user.model.js";

const toUserId = (value) => {
  if (!value) return "";
  if (typeof value === "object") {
    return String(value?._id || value?.id || "").trim();
  }
  return String(value || "").trim();
};

const isFutureDate = (value, now = new Date()) => {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return date > now;
};

const isMembershipRecordActive = (record, now = new Date()) => {
  if (!record) return false;
  if (record.status !== "active") return false;
  return isFutureDate(record.expiryDate, now);
};

export const getMembershipAccess = async (userId) => {
  const normalizedUserId = toUserId(userId);
  if (!normalizedUserId) {
    return { isActiveMember: false, isAdmin: false };
  }

  const now = new Date();
  const user = await UserModel.findById(normalizedUserId)
    .select("role isMember is_member membershipExpiry membership_id")
    .lean();

  if (!user) {
    return { isActiveMember: false, isAdmin: false };
  }

  const isAdmin = user.role === "Admin";
  let isActiveMember = false;

  if (user.membership_id) {
    const membershipRecord = await MembershipUserModel.findById(user.membership_id)
      .select("status expiryDate")
      .lean();
    isActiveMember = isMembershipRecordActive(membershipRecord, now);
  }

  if (!isActiveMember) {
    const hasLegacyFlag = Boolean(user.isMember) || Boolean(user.is_member);
    const notExpired =
      !user.membershipExpiry || isFutureDate(user.membershipExpiry, now);
    isActiveMember = hasLegacyFlag && notExpired;
  }

  return { isActiveMember, isAdmin };
};

export const checkMembership = async (userId) => {
  const access = await getMembershipAccess(userId);
  return access.isActiveMember;
};

export const checkExclusiveAccess = async (userId) => {
  const access = await getMembershipAccess(userId);
  return access.isActiveMember || access.isAdmin;
};

export const attachMembershipStatus = async (req, res, next) => {
  try {
    const access = await getMembershipAccess(req.user);
    req.membershipActive = access.isActiveMember;
    req.userIsAdmin = access.isAdmin;
    return next();
  } catch (error) {
    return res.status(500).json({
      error: true,
      success: false,
      message: "Failed to validate membership access",
    });
  }
};

export const requireActiveMembership = async (req, res, next) => {
  try {
    // Backend gate for members-only APIs. Frontend locks are visual only.
    if (!req.user) {
      return res.status(401).json({
        error: true,
        success: false,
        message: "Authentication required",
      });
    }

    const isMember = await checkMembership(req.user);
    if (!isMember) {
      return res.status(403).json({
        error: true,
        success: false,
        message: "Active membership required",
      });
    }

    req.membershipActive = true;
    return next();
  } catch (error) {
    return res.status(500).json({
      error: true,
      success: false,
      message: "Failed to validate membership access",
    });
  }
};

export default requireActiveMembership;
