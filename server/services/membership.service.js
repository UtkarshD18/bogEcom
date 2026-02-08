import MembershipPlanModel from "../models/membershipPlan.model.js";
import UserModel from "../models/user.model.js";

const round2 = (value) =>
  Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

export const getUserMembership = async (userId) => {
  if (!userId) return null;

  const user = await UserModel.findById(userId)
    .select("isMember membershipPlan membershipExpiry")
    .populate("membershipPlan", "name discountPercent discountPercentage isActive active")
    .lean();

  if (!user?.isMember || !user?.membershipPlan) return null;

  const expiry = user.membershipExpiry ? new Date(user.membershipExpiry) : null;
  if (expiry && expiry < new Date()) return null;

  const isPlanActive = Boolean(
    user.membershipPlan.isActive ?? user.membershipPlan.active,
  );
  if (!isPlanActive) return null;

  const discountPercentage = Number(
    user.membershipPlan.discountPercentage ??
      user.membershipPlan.discountPercent ??
      0,
  );

  return {
    planId: user.membershipPlan._id,
    planName: user.membershipPlan.name,
    discountPercentage: Math.max(discountPercentage, 0),
  };
};

export const applyMembershipDiscount = async (subtotal, userId) => {
  const amount = Math.max(round2(subtotal), 0);
  const membership = await getUserMembership(userId);

  if (!membership || membership.discountPercentage <= 0) {
    return {
      membership: null,
      discount: 0,
      netSubtotal: amount,
    };
  }

  const discount = round2((amount * membership.discountPercentage) / 100);
  const netSubtotal = Math.max(round2(amount - discount), 0);

  return {
    membership,
    discount,
    netSubtotal,
  };
};

export const getActiveMembershipPlan = async () => {
  return MembershipPlanModel.findOne({
    $or: [{ isActive: true }, { active: true }],
  })
    .sort({ updatedAt: -1 })
    .lean();
};

export default {
  applyMembershipDiscount,
  getActiveMembershipPlan,
  getUserMembership,
};
