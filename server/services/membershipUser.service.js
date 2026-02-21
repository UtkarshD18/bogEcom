import MembershipUserModel from "../models/membershipUser.model.js";
import UserModel from "../models/user.model.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_MEMBERSHIP_DAYS = 365;
const EXPIRING_SOON_DAYS = 7;

let hasBackfilledLegacyRecords = false;

const toObjectId = (value) => {
  if (!value) return null;
  return String(value).trim() || null;
};

const toPositiveInt = (value, fallback = 0) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(Math.floor(num), 0);
};

const addDays = (baseDate, days) => {
  const safeDate = new Date(baseDate || new Date());
  safeDate.setDate(safeDate.getDate() + toPositiveInt(days, 0));
  return safeDate;
};

export const getDaysRemaining = (expiryDate, now = new Date()) => {
  if (!expiryDate) return 0;
  const diff = new Date(expiryDate).getTime() - now.getTime();
  if (diff <= 0) return 0;
  return Math.ceil(diff / DAY_MS);
};

const isActiveMembership = (membershipUser, now = new Date()) => {
  if (!membershipUser) return false;
  if (membershipUser.status !== "active") return false;
  return new Date(membershipUser.expiryDate) > now;
};

const toPublicMembershipUser = (membershipUser, now = new Date()) => {
  if (!membershipUser) return null;
  const daysRemaining = getDaysRemaining(membershipUser.expiryDate, now);
  const isExpiringSoon =
    membershipUser.status === "active" &&
    daysRemaining > 0 &&
    daysRemaining <= EXPIRING_SOON_DAYS;

  return {
    _id: membershipUser._id,
    user: membershipUser.user,
    status: membershipUser.status,
    startDate: membershipUser.startDate,
    expiryDate: membershipUser.expiryDate,
    pointsBalance: Number(membershipUser.pointsBalance || 0),
    isManuallyExtended: Boolean(membershipUser.isManuallyExtended),
    createdAt: membershipUser.createdAt,
    updatedAt: membershipUser.updatedAt,
    daysRemaining,
    isExpiringSoon,
  };
};

const syncUserMembershipFlags = async ({
  userId,
  membershipUser = null,
  membershipPlan,
  membershipPaymentId,
}) => {
  const safeUserId = toObjectId(userId);
  if (!safeUserId) return null;

  const now = new Date();
  const isActive = isActiveMembership(membershipUser, now);

  const update = {
    isMember: isActive,
    is_member: isActive,
    membership_id: membershipUser?._id || null,
    membershipExpiry: membershipUser?.expiryDate || null,
  };

  if (membershipPlan !== undefined) {
    update.membershipPlan = membershipPlan;
  }
  if (membershipPaymentId !== undefined) {
    update.membershipPaymentId = membershipPaymentId;
  }

  return UserModel.findByIdAndUpdate(safeUserId, { $set: update }, { new: true })
    .select(
      "_id name email avatar isMember is_member membershipPlan membership_id membershipExpiry",
    )
    .lean();
};

const getMembershipStatsSnapshot = async (now = new Date()) => {
  const expiringCutoff = addDays(now, EXPIRING_SOON_DAYS);

  const [totalMembers, activeMembers, expiringSoon, expiredMembers] =
    await Promise.all([
      MembershipUserModel.countDocuments({}),
      MembershipUserModel.countDocuments({
        status: "active",
        expiryDate: { $gt: now },
      }),
      MembershipUserModel.countDocuments({
        status: "active",
        expiryDate: { $gt: now, $lte: expiringCutoff },
      }),
      MembershipUserModel.countDocuments({ status: "expired" }),
    ]);

  return {
    totalMembers,
    activeMembers,
    expiringSoon,
    expiredMembers,
  };
};

export const expireMembershipUsers = async ({ now = new Date() } = {}) => {
  const staleMemberships = await MembershipUserModel.find({
    status: "active",
    expiryDate: { $lte: now },
  })
    .select("_id user")
    .lean();

  if (!staleMemberships.length) {
    return { expiredCount: 0 };
  }

  const membershipIds = staleMemberships.map((m) => m._id);
  const userIds = staleMemberships.map((m) => m.user);

  await MembershipUserModel.updateMany(
    { _id: { $in: membershipIds } },
    { $set: { status: "expired" } },
  );

  if (userIds.length) {
    await UserModel.updateMany(
      { _id: { $in: userIds } },
      { $set: { isMember: false, is_member: false } },
    );
  }

  return { expiredCount: staleMemberships.length };
};

export const backfillLegacyMembershipUsers = async ({ batchSize = 200 } = {}) => {
  const safeBatchSize = Math.min(Math.max(toPositiveInt(batchSize, 200), 1), 1000);
  const now = new Date();

  const users = await UserModel.find({
    $or: [{ isMember: true }, { is_member: true }],
    membership_id: null,
  })
    .select("_id isMember is_member membershipExpiry membershipPlan createdAt")
    .limit(safeBatchSize)
    .lean();

  if (!users.length) {
    return { created: 0 };
  }

  let created = 0;

  for (const user of users) {
    const expiryDate =
      user?.membershipExpiry && !Number.isNaN(new Date(user.membershipExpiry).getTime())
        ? new Date(user.membershipExpiry)
        : addDays(now, DEFAULT_MEMBERSHIP_DAYS);
    const startDate =
      user?.createdAt && !Number.isNaN(new Date(user.createdAt).getTime())
        ? new Date(user.createdAt)
        : now;
    const status = expiryDate > now ? "active" : "expired";

    const membershipUser = await MembershipUserModel.findOneAndUpdate(
      { user: user._id },
      {
        $setOnInsert: {
          user: user._id,
          startDate,
          expiryDate,
          status,
          pointsBalance: 0,
          isManuallyExtended: false,
        },
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      },
    );

    if (membershipUser) {
      created += 1;
      await syncUserMembershipFlags({
        userId: user._id,
        membershipUser,
        membershipPlan: user.membershipPlan,
      });
    }
  }

  return { created };
};

export const ensureMembershipDataHealth = async () => {
  if (!hasBackfilledLegacyRecords) {
    await backfillLegacyMembershipUsers();
    hasBackfilledLegacyRecords = true;
  }
  await expireMembershipUsers();
};

export const activateMembershipForUser = async ({
  userId,
  expiryDate,
  startDate = new Date(),
  membershipPlan,
  membershipPaymentId,
}) => {
  const safeUserId = toObjectId(userId);
  if (!safeUserId || !expiryDate) {
    throw new Error("userId and expiryDate are required");
  }

  const payload = {
    status: "active",
    startDate: new Date(startDate || new Date()),
    expiryDate: new Date(expiryDate),
    isManuallyExtended: false,
  };

  const membershipUser = await MembershipUserModel.findOneAndUpdate(
    { user: safeUserId },
    { $set: payload, $setOnInsert: { pointsBalance: 0 } },
    { upsert: true, new: true, runValidators: true },
  );

  const user = await syncUserMembershipFlags({
    userId: safeUserId,
    membershipUser,
    membershipPlan,
    membershipPaymentId,
  });

  return {
    membershipUser: toPublicMembershipUser(membershipUser),
    user,
  };
};

export const convertUserToMember = async ({
  userId,
  days = DEFAULT_MEMBERSHIP_DAYS,
  activatedBy = null,
}) => {
  const safeUserId = toObjectId(userId);
  if (!safeUserId) {
    throw new Error("Valid userId is required");
  }

  const user = await UserModel.findById(safeUserId).select(
    "_id membershipPlan membershipPaymentId",
  );
  if (!user) {
    throw new Error("User not found");
  }

  const now = new Date();
  const existingMembership = await MembershipUserModel.findOne({ user: safeUserId });
  if (
    existingMembership &&
    existingMembership.status === "active" &&
    existingMembership.expiryDate > now
  ) {
    const syncedUser = await syncUserMembershipFlags({
      userId: safeUserId,
      membershipUser: existingMembership,
      membershipPlan: user.membershipPlan ?? null,
      membershipPaymentId: user.membershipPaymentId ?? null,
    });

    return {
      membershipUser: toPublicMembershipUser(existingMembership),
      user: syncedUser,
      alreadyMember: true,
    };
  }

  const expiryDate = addDays(now, toPositiveInt(days, DEFAULT_MEMBERSHIP_DAYS));

  const membershipUser = await MembershipUserModel.findOneAndUpdate(
    { user: safeUserId },
    {
      $set: {
        status: "active",
        startDate: now,
        expiryDate,
      },
      $setOnInsert: {
        pointsBalance: 0,
        isManuallyExtended: true,
      },
    },
    { upsert: true, new: true, runValidators: true },
  );

  if (!membershipUser.isManuallyExtended) {
    membershipUser.isManuallyExtended = true;
    await membershipUser.save();
  }

  const syncedUser = await syncUserMembershipFlags({
    userId: safeUserId,
    membershipUser,
    membershipPlan: user.membershipPlan ?? null,
    membershipPaymentId:
      user.membershipPaymentId ?? (activatedBy ? `admin:${activatedBy}` : null),
  });

  return {
    membershipUser: toPublicMembershipUser(membershipUser),
    user: syncedUser,
  };
};

export const getMembershipUsers = async ({
  page = 1,
  limit = 10,
  search = "",
  filter = "all",
}) => {
  await ensureMembershipDataHealth();

  const safePage = Math.max(toPositiveInt(page, 1), 1);
  const safeLimit = Math.min(Math.max(toPositiveInt(limit, 10), 1), 100);
  const skip = (safePage - 1) * safeLimit;
  const now = new Date();
  const expiringCutoff = addDays(now, EXPIRING_SOON_DAYS);

  const query = {};
  if (filter === "active") {
    query.status = "active";
    query.expiryDate = { $gt: now };
  } else if (filter === "expiringSoon") {
    query.status = "active";
    query.expiryDate = { $gt: now, $lte: expiringCutoff };
  } else if (filter === "expired") {
    query.status = "expired";
  }

  const searchText = String(search || "").trim();
  if (searchText) {
    const regex = new RegExp(searchText, "i");
    const users = await UserModel.find({
      $or: [{ name: regex }, { email: regex }],
    })
      .select("_id")
      .lean();

    const userIds = users.map((u) => u._id);
    query.user = userIds.length ? { $in: userIds } : null;
  }

  if (query.user === null) {
    return {
      members: [],
      pagination: {
        page: safePage,
        limit: safeLimit,
        total: 0,
        totalPages: 0,
      },
      stats: await getMembershipStatsSnapshot(now),
    };
  }

  const [rows, total, stats] = await Promise.all([
    MembershipUserModel.find(query)
      .populate("user", "name email avatar createdAt")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(safeLimit)
      .lean(),
    MembershipUserModel.countDocuments(query),
    getMembershipStatsSnapshot(now),
  ]);

  const members = rows.map((row) => toPublicMembershipUser(row, now));
  return {
    members,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.ceil(total / safeLimit),
    },
    stats,
  };
};

export const getMembershipUserById = async (membershipUserId) => {
  await ensureMembershipDataHealth();
  const safeId = toObjectId(membershipUserId);
  if (!safeId) return null;

  const record = await MembershipUserModel.findById(safeId)
    .populate("user", "name email avatar createdAt")
    .lean();

  if (!record) return null;
  return toPublicMembershipUser(record);
};

export const extendMembershipUser = async ({
  membershipUserId,
  days = DEFAULT_MEMBERSHIP_DAYS,
}) => {
  const safeId = toObjectId(membershipUserId);
  if (!safeId) {
    throw new Error("Valid membershipUserId is required");
  }

  const membershipUser = await MembershipUserModel.findById(safeId);
  if (!membershipUser) {
    throw new Error("Membership user not found");
  }

  const now = new Date();
  const baseDate = membershipUser.expiryDate > now ? membershipUser.expiryDate : now;
  const nextExpiry = addDays(baseDate, toPositiveInt(days, DEFAULT_MEMBERSHIP_DAYS));

  membershipUser.expiryDate = nextExpiry;
  membershipUser.status = "active";
  membershipUser.isManuallyExtended = true;
  await membershipUser.save();

  const user = await syncUserMembershipFlags({
    userId: membershipUser.user,
    membershipUser,
  });

  return {
    membershipUser: toPublicMembershipUser(membershipUser),
    user,
  };
};

export const updateMembershipUserPoints = async ({
  membershipUserId,
  pointsDelta = 0,
}) => {
  const safeId = toObjectId(membershipUserId);
  if (!safeId) {
    throw new Error("Valid membershipUserId is required");
  }

  const delta = Number(pointsDelta);
  if (!Number.isFinite(delta) || delta === 0) {
    throw new Error("pointsDelta must be a non-zero number");
  }

  const membershipUser = await MembershipUserModel.findById(safeId);
  if (!membershipUser) {
    throw new Error("Membership user not found");
  }

  const nextBalance = Math.max(Number(membershipUser.pointsBalance || 0) + delta, 0);
  membershipUser.pointsBalance = nextBalance;
  await membershipUser.save();

  return toPublicMembershipUser(membershipUser);
};

export const toggleMembershipUserStatus = async ({
  membershipUserId,
  action,
}) => {
  const safeId = toObjectId(membershipUserId);
  const safeAction = String(action || "").trim();

  if (!safeId) {
    throw new Error("Valid membershipUserId is required");
  }
  if (!["cancel", "reactivate"].includes(safeAction)) {
    throw new Error("action must be cancel or reactivate");
  }

  const membershipUser = await MembershipUserModel.findById(safeId);
  if (!membershipUser) {
    throw new Error("Membership user not found");
  }

  if (safeAction === "cancel") {
    membershipUser.status = "cancelled";
  } else {
    const now = new Date();
    if (membershipUser.expiryDate <= now) {
      membershipUser.expiryDate = addDays(now, DEFAULT_MEMBERSHIP_DAYS);
      membershipUser.isManuallyExtended = true;
    }
    membershipUser.status = "active";
  }

  await membershipUser.save();

  const user = await syncUserMembershipFlags({
    userId: membershipUser.user,
    membershipUser,
  });

  return {
    membershipUser: toPublicMembershipUser(membershipUser),
    user,
  };
};

export const getMembershipAnalytics = async () => {
  await ensureMembershipDataHealth();

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [summaryStats, newMembersThisMonth, totalPointsDistributed] =
    await Promise.all([
      getMembershipStatsSnapshot(now),
      MembershipUserModel.countDocuments({ createdAt: { $gte: monthStart } }),
      MembershipUserModel.aggregate([
        {
          $group: {
            _id: null,
            total: { $sum: "$pointsBalance" },
          },
        },
      ]),
    ]);

  const firstMonth = new Date(now.getFullYear(), now.getMonth() - 11, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const [monthlyRows, beforeRangeCount] = await Promise.all([
    MembershipUserModel.aggregate([
      {
        $match: {
          createdAt: { $gte: firstMonth, $lte: lastMonthEnd },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]),
    MembershipUserModel.countDocuments({ createdAt: { $lt: firstMonth } }),
  ]);

  const monthMap = new Map();
  for (const row of monthlyRows) {
    const key = `${row._id.year}-${String(row._id.month).padStart(2, "0")}`;
    monthMap.set(key, Number(row.count || 0));
  }

  const growth = [];
  let cumulative = beforeRangeCount;
  for (let i = 11; i >= 0; i -= 1) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${monthDate.getFullYear()}-${String(
      monthDate.getMonth() + 1,
    ).padStart(2, "0")}`;
    const count = monthMap.get(key) || 0;
    cumulative += count;

    growth.push({
      month: monthDate.toLocaleString("en-IN", {
        month: "short",
        year: "numeric",
      }),
      newMembers: count,
      totalMembers: cumulative,
    });
  }

  return {
    summary: {
      newMembersThisMonth,
      activeMembers: summaryStats.activeMembers,
      expiredMembers: summaryStats.expiredMembers,
      totalMembers: summaryStats.totalMembers,
      totalPointsDistributed: Number(totalPointsDistributed?.[0]?.total || 0),
    },
    growth,
  };
};

export default {
  activateMembershipForUser,
  backfillLegacyMembershipUsers,
  convertUserToMember,
  ensureMembershipDataHealth,
  expireMembershipUsers,
  extendMembershipUser,
  getMembershipAnalytics,
  getMembershipUserById,
  getMembershipUsers,
  toggleMembershipUserStatus,
  updateMembershipUserPoints,
};
