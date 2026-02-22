import mongoose from "mongoose";
import CoinSettingsModel from "../models/coinSettings.model.js";
import CoinTransactionModel from "../models/coinTransaction.model.js";
import MembershipUserModel from "../models/membershipUser.model.js";
import UserModel from "../models/user.model.js";

const round2 = (value) =>
  Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
const floorInt = (value) => Math.max(Math.floor(Number(value || 0)), 0);
const toObjectId = (value) => {
  if (!value) return null;
  const str = String(value).trim();
  if (!str) return null;
  return mongoose.Types.ObjectId.isValid(str) ? str : null;
};
const toMongoObjectId = (value) => {
  const safe = toObjectId(value);
  return safe ? new mongoose.Types.ObjectId(safe) : null;
};

const DEFAULT_COIN_SETTINGS = {
  coinsPerRupee: 0.05,
  redeemRate: 0.1,
  maxRedeemPercentage: 20,
  expiryDays: 365,
};

const MEMBERSHIP_BONUS_MULTIPLIER = 1.2;
const COIN_EXPIRING_SOON_DAYS = 30;

const getCoinExpiryDate = (days) => {
  const safeDays = floorInt(days);
  if (safeDays <= 0) return null;
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + safeDays);
  return expiry;
};

const isMembershipActive = (user) => {
  if (!user?.isMember) return false;
  if (!user?.membershipExpiry) return true;
  return new Date(user.membershipExpiry) > new Date();
};

const getNetLedgerBalance = async (userId) => {
  const safeUserId = toObjectId(userId);
  if (!safeUserId) return 0;
  const userObjectId = toMongoObjectId(safeUserId);
  if (!userObjectId) return 0;

  const [row] = await CoinTransactionModel.aggregate([
    {
      $match: {
        user: userObjectId,
      },
    },
    {
      $group: {
        _id: null,
        credit: {
          $sum: {
            $cond: [{ $in: ["$type", ["earn", "bonus"]] }, "$coins", 0],
          },
        },
        debit: {
          $sum: {
            $cond: [{ $in: ["$type", ["redeem", "expire"]] }, "$coins", 0],
          },
        },
      },
    },
  ]);

  return floorInt(Number(row?.credit || 0) - Number(row?.debit || 0));
};

const syncLegacyBalanceToLedger = async (userId) => {
  const safeUserId = toObjectId(userId);
  if (!safeUserId) return { syncedDiff: 0 };

  const user = await UserModel.findById(safeUserId).select("_id coinBalance").lean();
  if (!user) return { syncedDiff: 0 };

  const userBalance = floorInt(user.coinBalance);
  const ledgerBalance = await getNetLedgerBalance(safeUserId);
  const diff = userBalance - ledgerBalance;

  if (diff > 0) {
    await CoinTransactionModel.create({
      user: safeUserId,
      coins: diff,
      remainingCoins: diff,
      type: "bonus",
      source: "admin",
      referenceId: `legacy-sync:${Date.now()}`,
      expiryDate: null,
      meta: {
        note: "Legacy coin balance sync",
      },
    });
  }

  return {
    syncedDiff: Math.max(diff, 0),
    userBalance,
    ledgerBalance: ledgerBalance + Math.max(diff, 0),
  };
};

const bootstrapMembershipPointsToLedger = async (userId) => {
  const safeUserId = toObjectId(userId);
  if (!safeUserId) return { syncedDiff: 0 };

  const membershipUser = await MembershipUserModel.findOne({ user: safeUserId })
    .sort({ updatedAt: -1, createdAt: -1 })
    .select("_id pointsBalance")
    .lean();
  const pointsBalance = floorInt(membershipUser?.pointsBalance);
  if (pointsBalance <= 0) {
    return { syncedDiff: 0 };
  }

  const now = new Date();
  const [usableRow] = await CoinTransactionModel.aggregate([
    {
      $match: {
        user: toMongoObjectId(safeUserId),
        type: { $in: ["earn", "bonus"] },
        remainingCoins: { $gt: 0 },
        $or: [{ expiryDate: null }, { expiryDate: { $gt: now } }],
      },
    },
    {
      $group: {
        _id: null,
        usableCoins: { $sum: "$remainingCoins" },
      },
    },
  ]);

  const usableFromLedger = floorInt(usableRow?.usableCoins || 0);
  const syncDiff = Math.max(pointsBalance - usableFromLedger, 0);
  if (syncDiff <= 0) {
    return { syncedDiff: 0 };
  }

  await CoinTransactionModel.create({
    user: safeUserId,
    coins: syncDiff,
    remainingCoins: syncDiff,
    type: "bonus",
    source: "membership",
    referenceId: `membership-points-sync:${
      membershipUser?._id || safeUserId
    }:${pointsBalance}`,
    expiryDate: null,
    meta: {
      note: "Membership points bootstrap sync",
      membershipUserId: membershipUser?._id || null,
      pointsBalance,
      usableFromLedger,
    },
  });

  return { syncedDiff: syncDiff };
};

const expireCoinsForUser = async (userId, now = new Date()) => {
  const safeUserId = toObjectId(userId);
  if (!safeUserId) return 0;

  const expirable = await CoinTransactionModel.find({
    user: safeUserId,
    type: { $in: ["earn", "bonus"] },
    remainingCoins: { $gt: 0 },
    expiryDate: { $ne: null, $lte: now },
  })
    .sort({ createdAt: 1, _id: 1 })
    .lean();

  if (!expirable.length) return 0;

  const ops = [];
  let expiredCoins = 0;

  for (const tx of expirable) {
    const remaining = floorInt(tx.remainingCoins);
    if (remaining <= 0) continue;

    expiredCoins += remaining;
    ops.push({
      updateOne: {
        filter: { _id: tx._id, remainingCoins: { $gt: 0 } },
        update: { $set: { remainingCoins: 0 } },
      },
    });
    ops.push({
      insertOne: {
        document: {
          user: safeUserId,
          coins: remaining,
          remainingCoins: 0,
          type: "expire",
          source: "system",
          referenceId: tx.referenceId ? `expire:${tx.referenceId}` : null,
          expiryDate: now,
          meta: {
            fromTransactionId: tx._id,
          },
        },
      },
    });
  }

  if (ops.length) {
    await CoinTransactionModel.bulkWrite(ops, { ordered: false });
  }

  return expiredCoins;
};

const getUsableCoinBalanceFromLedger = async (userId, now = new Date()) => {
  const safeUserId = toObjectId(userId);
  if (!safeUserId) return 0;
  const userObjectId = toMongoObjectId(safeUserId);
  if (!userObjectId) return 0;

  const [row] = await CoinTransactionModel.aggregate([
    {
      $match: {
        user: userObjectId,
        type: { $in: ["earn", "bonus"] },
        remainingCoins: { $gt: 0 },
        $or: [{ expiryDate: null }, { expiryDate: { $gt: now } }],
      },
    },
    {
      $group: {
        _id: null,
        usableCoins: { $sum: "$remainingCoins" },
      },
    },
  ]);

  return floorInt(row?.usableCoins || 0);
};

const getExpiringSoonCoinsFromLedger = async (
  userId,
  days = COIN_EXPIRING_SOON_DAYS,
) => {
  const safeUserId = toObjectId(userId);
  if (!safeUserId) return 0;
  const userObjectId = toMongoObjectId(safeUserId);
  if (!userObjectId) return 0;

  const now = new Date();
  const limitDate = new Date(now);
  limitDate.setDate(limitDate.getDate() + Math.max(floorInt(days), 1));

  const [row] = await CoinTransactionModel.aggregate([
    {
      $match: {
        user: userObjectId,
        type: { $in: ["earn", "bonus"] },
        remainingCoins: { $gt: 0 },
        expiryDate: { $gt: now, $lte: limitDate },
      },
    },
    {
      $group: {
        _id: null,
        expiringSoon: { $sum: "$remainingCoins" },
      },
    },
  ]);

  return floorInt(row?.expiringSoon || 0);
};

const syncUserCoinBalanceFromLedger = async (userId) => {
  const safeUserId = toObjectId(userId);
  if (!safeUserId) return 0;

  const usable = await getUsableCoinBalanceFromLedger(safeUserId, new Date());
  await UserModel.findByIdAndUpdate(safeUserId, { $set: { coinBalance: usable } });
  return usable;
};

const ensureCoinLedgerState = async (userId) => {
  const safeUserId = toObjectId(userId);
  if (!safeUserId) return { usableCoins: 0 };

  await syncLegacyBalanceToLedger(safeUserId);
  await bootstrapMembershipPointsToLedger(safeUserId);
  await expireCoinsForUser(safeUserId, new Date());
  const usableCoins = await syncUserCoinBalanceFromLedger(safeUserId);
  return { usableCoins };
};

const consumeCoinsFIFO = async ({
  userId,
  coinsRequired,
  source = "order",
  referenceId = null,
  meta = {},
  allowPartial = false,
}) => {
  const safeUserId = toObjectId(userId);
  const safeCoinsRequired = floorInt(coinsRequired);
  const safeReferenceId = referenceId ? String(referenceId) : null;

  if (!safeUserId || safeCoinsRequired <= 0) {
    return {
      coinsUsed: 0,
      allocations: [],
      user: null,
      idempotent: false,
      transaction: null,
    };
  }

  if (safeReferenceId) {
    const existingRedeem = await CoinTransactionModel.findOne({
      user: safeUserId,
      type: "redeem",
      source,
      referenceId: safeReferenceId,
    }).lean();

    if (existingRedeem) {
      const user = await UserModel.findById(safeUserId)
        .select("_id coinBalance")
        .lean();
      return {
        coinsUsed: floorInt(existingRedeem.coins),
        allocations: Array.isArray(existingRedeem?.meta?.allocations)
          ? existingRedeem.meta.allocations
          : [],
        user,
        idempotent: true,
        transaction: existingRedeem,
      };
    }
  }

  await ensureCoinLedgerState(safeUserId);

  const now = new Date();
  const buckets = await CoinTransactionModel.find({
    user: safeUserId,
    type: { $in: ["earn", "bonus"] },
    remainingCoins: { $gt: 0 },
    $or: [{ expiryDate: null }, { expiryDate: { $gt: now } }],
  })
    .sort({ createdAt: 1, _id: 1 })
    .select("_id remainingCoins createdAt expiryDate")
    .lean();

  let remaining = safeCoinsRequired;
  const allocations = [];
  const updateOps = [];

  for (const bucket of buckets) {
    if (remaining <= 0) break;
    const available = floorInt(bucket.remainingCoins);
    if (available <= 0) continue;

    const used = Math.min(available, remaining);
    remaining -= used;

    allocations.push({
      transactionId: bucket._id,
      coins: used,
      createdAt: bucket.createdAt,
      expiryDate: bucket.expiryDate,
    });

    updateOps.push({
      updateOne: {
        filter: { _id: bucket._id },
        update: { $set: { remainingCoins: available - used } },
      },
    });
  }

  const coinsUsed = safeCoinsRequired - remaining;
  if ((!allowPartial && coinsUsed < safeCoinsRequired) || coinsUsed <= 0) {
    return {
      coinsUsed: 0,
      allocations: [],
      user: await UserModel.findById(safeUserId).select("_id coinBalance").lean(),
      idempotent: false,
      transaction: null,
    };
  }

  if (updateOps.length) {
    await CoinTransactionModel.bulkWrite(updateOps, { ordered: true });
  }

  const redeemTx = await CoinTransactionModel.create({
    user: safeUserId,
    coins: coinsUsed,
    remainingCoins: 0,
    type: "redeem",
    source,
    referenceId: safeReferenceId,
    expiryDate: null,
    meta: {
      ...meta,
      allocations,
    },
  });

  const usable = await syncUserCoinBalanceFromLedger(safeUserId);

  return {
    coinsUsed,
    allocations,
    user: { _id: safeUserId, coinBalance: usable },
    idempotent: false,
    transaction: redeemTx,
  };
};

export const getCoinSettings = async () => {
  const existing = await CoinSettingsModel.findOne({ isDefault: true }).lean();
  if (existing) return existing;

  const created = await CoinSettingsModel.create({
    ...DEFAULT_COIN_SETTINGS,
    isDefault: true,
  });
  return created.toObject();
};

export const calculateRedemption = async ({
  subtotal,
  requestedCoins = 0,
  coinBalance = 0,
}) => {
  const settings = await getCoinSettings();
  const safeSubtotal = Math.max(round2(subtotal), 0);
  const requested = floorInt(requestedCoins);
  const balance = floorInt(coinBalance);

  const maxRedeemValue = round2(
    (safeSubtotal * Number(settings.maxRedeemPercentage || 0)) / 100,
  );
  const maxCoinsByLimit = floorInt(
    maxRedeemValue / Number(settings.redeemRate || 1),
  );
  const coinsUsed = Math.min(requested, balance, maxCoinsByLimit);
  const redeemAmount = round2(coinsUsed * Number(settings.redeemRate || 0));

  return {
    settings,
    coinsUsed,
    redeemAmount,
    maxRedeemValue,
  };
};

export const applyRedemptionToUser = async ({
  userId,
  coinsUsed,
  source = "order",
  referenceId = null,
  meta = {},
}) => {
  const safeCoins = floorInt(coinsUsed);
  if (!userId || safeCoins <= 0) return null;

  const result = await consumeCoinsFIFO({
    userId,
    coinsRequired: safeCoins,
    source,
    referenceId,
    meta,
    allowPartial: false,
  });

  if (!result?.user) return null;
  return result.user;
};

export const awardCoinsToUser = async ({
  userId,
  orderAmount,
  source = "order",
  referenceId = null,
}) => {
  if (!userId) {
    return {
      coinsAwarded: 0,
      baseCoins: 0,
      bonusCoins: 0,
      user: null,
      membershipBonusMultiplier: MEMBERSHIP_BONUS_MULTIPLIER,
    };
  }

  const safeUserId = toObjectId(userId);
  const safeReferenceId = referenceId ? String(referenceId) : null;

  if (safeReferenceId && source === "order") {
    const existing = await CoinTransactionModel.findOne({
      user: safeUserId,
      type: "earn",
      source: "order",
      referenceId: safeReferenceId,
    }).lean();
    if (existing) {
      const user = await UserModel.findById(safeUserId)
        .select("_id coinBalance")
        .lean();
      return {
        coinsAwarded: 0,
        baseCoins: 0,
        bonusCoins: 0,
        user,
        idempotent: true,
        membershipBonusMultiplier: MEMBERSHIP_BONUS_MULTIPLIER,
      };
    }
  }

  const settings = await getCoinSettings();
  const baseCoins = floorInt(
    Number(orderAmount || 0) * Number(settings.coinsPerRupee || 0),
  );
  if (baseCoins <= 0) {
    return {
      coinsAwarded: 0,
      baseCoins: 0,
      bonusCoins: 0,
      user: null,
      membershipBonusMultiplier: MEMBERSHIP_BONUS_MULTIPLIER,
    };
  }

  await ensureCoinLedgerState(safeUserId);

  const user = await UserModel.findById(safeUserId)
    .select("_id coinBalance isMember membershipExpiry")
    .lean();
  if (!user) {
    return {
      coinsAwarded: 0,
      baseCoins: 0,
      bonusCoins: 0,
      user: null,
      membershipBonusMultiplier: MEMBERSHIP_BONUS_MULTIPLIER,
    };
  }

  const hasMembershipBonus = isMembershipActive(user);
  const bonusCoins = hasMembershipBonus
    ? floorInt(baseCoins * (MEMBERSHIP_BONUS_MULTIPLIER - 1))
    : 0;
  const totalCoins = baseCoins + bonusCoins;

  if (totalCoins <= 0) {
    return {
      coinsAwarded: 0,
      baseCoins: 0,
      bonusCoins: 0,
      user: null,
      membershipBonusMultiplier: MEMBERSHIP_BONUS_MULTIPLIER,
    };
  }

  const expiryDate = getCoinExpiryDate(settings.expiryDays);
  const earnReference = safeReferenceId || null;

  const txDocs = [
    {
      user: safeUserId,
      coins: baseCoins,
      remainingCoins: baseCoins,
      type: "earn",
      source,
      referenceId: earnReference,
      expiryDate,
      meta: {
        orderAmount: round2(orderAmount),
        coinsPerRupee: Number(settings.coinsPerRupee || 0),
      },
    },
  ];

  if (bonusCoins > 0) {
    txDocs.push({
      user: safeUserId,
      coins: bonusCoins,
      remainingCoins: bonusCoins,
      type: "bonus",
      source: "membership",
      referenceId: earnReference ? `bonus:${earnReference}` : null,
      expiryDate,
      meta: {
        multiplier: MEMBERSHIP_BONUS_MULTIPLIER,
      },
    });
  }

  await CoinTransactionModel.insertMany(txDocs);

  const updatedUser = await UserModel.findByIdAndUpdate(
    safeUserId,
    { $inc: { coinBalance: totalCoins } },
    { new: true, runValidators: true },
  ).select("_id coinBalance");

  return {
    coinsAwarded: totalCoins,
    baseCoins,
    bonusCoins,
    user: updatedUser,
    hasMembershipBonus,
    membershipBonusMultiplier: MEMBERSHIP_BONUS_MULTIPLIER,
  };
};

export const adjustCoinsByAdmin = async ({
  userId,
  coinsDelta = 0,
  referenceId = null,
  meta = {},
}) => {
  const safeUserId = toObjectId(userId);
  const rawDelta = Number(coinsDelta);
  const normalizedDelta =
    rawDelta > 0
      ? floorInt(rawDelta)
      : rawDelta < 0
        ? -floorInt(Math.abs(rawDelta))
        : 0;

  if (!safeUserId || normalizedDelta === 0) {
    return {
      coinsChanged: 0,
      direction: "none",
      remainingBalance: 0,
    };
  }

  await ensureCoinLedgerState(safeUserId);
  const noteMeta = {
    ...meta,
    reason: meta?.reason || "admin-manual-coin-adjustment",
  };

  if (normalizedDelta > 0) {
    const settings = await getCoinSettings();
    const safeReferenceId =
      String(referenceId || "").trim() || `admin-credit:${safeUserId}:${Date.now()}`;
    const existingCredit = await CoinTransactionModel.findOne({
      user: safeUserId,
      type: "bonus",
      source: "admin",
      referenceId: safeReferenceId,
    }).lean();

    if (!existingCredit) {
      await CoinTransactionModel.create({
        user: safeUserId,
        coins: normalizedDelta,
        remainingCoins: normalizedDelta,
        type: "bonus",
        source: "admin",
        referenceId: safeReferenceId,
        expiryDate: getCoinExpiryDate(settings.expiryDays),
        meta: noteMeta,
      });
    }

    const remainingBalance = await syncUserCoinBalanceFromLedger(safeUserId);
    return {
      coinsChanged: normalizedDelta,
      direction: "credit",
      remainingBalance: floorInt(remainingBalance),
    };
  }

  const coinsToConsume = Math.abs(normalizedDelta);
  const safeReferenceId =
    String(referenceId || "").trim() || `admin-debit:${safeUserId}:${Date.now()}`;
  const consumeResult = await consumeCoinsFIFO({
    userId: safeUserId,
    coinsRequired: coinsToConsume,
    source: "admin",
    referenceId: safeReferenceId,
    meta: noteMeta,
    allowPartial: true,
  });

  return {
    coinsChanged: -floorInt(consumeResult?.coinsUsed || 0),
    direction: "debit",
    remainingBalance: floorInt(consumeResult?.user?.coinBalance || 0),
  };
};

export const redeemCoins = async ({
  userId,
  requestedCoins = 0,
  orderTotal = 0,
  source = "order",
  referenceId = null,
  meta = {},
}) => {
  const safeUserId = toObjectId(userId);
  const safeRequestedCoins = floorInt(requestedCoins);
  const safeOrderTotal = Math.max(round2(orderTotal), 0);
  const settings = await getCoinSettings();

  if (!safeUserId || safeRequestedCoins <= 0) {
    return {
      settings,
      requestedCoins: safeRequestedCoins,
      coinsUsed: 0,
      redeemAmount: 0,
      maxRedeemRupees: 0,
      maxCoinsByLimit: 0,
      remainingBalance: floorInt(0),
    };
  }

  await ensureCoinLedgerState(safeUserId);
  const usableCoins = await getUsableCoinBalanceFromLedger(safeUserId, new Date());

  const applyPercentageCap = source !== "membership";
  const maxRedeemRupees = applyPercentageCap
    ? round2((safeOrderTotal * Number(settings.maxRedeemPercentage || 0)) / 100)
    : safeOrderTotal;
  const maxCoinsByLimit = floorInt(
    maxRedeemRupees / Number(settings.redeemRate || 1),
  );
  const cappedCoins = Math.min(safeRequestedCoins, usableCoins, maxCoinsByLimit);

  if (cappedCoins <= 0) {
    return {
      settings,
      requestedCoins: safeRequestedCoins,
      coinsUsed: 0,
      redeemAmount: 0,
      maxRedeemRupees,
      maxCoinsByLimit,
      remainingBalance: usableCoins,
    };
  }

  const consumeResult = await consumeCoinsFIFO({
    userId: safeUserId,
    coinsRequired: cappedCoins,
    source,
    referenceId,
    meta: {
      ...meta,
      orderTotal: safeOrderTotal,
      maxRedeemRupees,
      redeemRate: Number(settings.redeemRate || 0),
    },
    allowPartial: false,
  });

  const coinsUsed = floorInt(consumeResult?.coinsUsed || 0);
  const redeemAmount = round2(coinsUsed * Number(settings.redeemRate || 0));
  const remainingBalance = floorInt(consumeResult?.user?.coinBalance || 0);

  return {
    settings,
    requestedCoins: safeRequestedCoins,
    coinsUsed,
    redeemAmount,
    maxRedeemRupees,
    maxCoinsByLimit,
    remainingBalance,
    allocations: consumeResult?.allocations || [],
  };
};

export const getUserCoinSummary = async ({ userId }) => {
  const settings = await getCoinSettings();
  const safeUserId = toObjectId(userId);

  if (!safeUserId) {
    return {
      total_coins: 0,
      usable_coins: 0,
      rupee_value: 0,
      expiring_soon: 0,
      membership_bonus_multiplier: MEMBERSHIP_BONUS_MULTIPLIER,
      settings: {
        coinsPerRupee: Number(settings.coinsPerRupee || 0),
        redeemRate: Number(settings.redeemRate || 0),
        maxRedeemPercentage: Number(settings.maxRedeemPercentage || 0),
        expiryDays: Number(settings.expiryDays || 0),
      },
    };
  }

  await ensureCoinLedgerState(safeUserId);

  const usableCoins = await getUsableCoinBalanceFromLedger(safeUserId, new Date());
  const expiringSoon = await getExpiringSoonCoinsFromLedger(
    safeUserId,
    Math.min(COIN_EXPIRING_SOON_DAYS, Number(settings.expiryDays || 365)),
  );
  const rupeeValue = round2(usableCoins * Number(settings.redeemRate || 0));

  return {
    total_coins: usableCoins,
    usable_coins: usableCoins,
    rupee_value: rupeeValue,
    expiring_soon: expiringSoon,
    membership_bonus_multiplier: MEMBERSHIP_BONUS_MULTIPLIER,
    settings: {
      coinsPerRupee: Number(settings.coinsPerRupee || 0),
      redeemRate: Number(settings.redeemRate || 0),
      maxRedeemPercentage: Number(settings.maxRedeemPercentage || 0),
      expiryDays: Number(settings.expiryDays || 0),
    },
  };
};

export const getUserCoinTransactions = async ({
  userId,
  page = 1,
  limit = 20,
}) => {
  const safeUserId = toObjectId(userId);
  const safePage = Math.max(floorInt(page), 1);
  const safeLimit = Math.min(Math.max(floorInt(limit), 1), 100);
  const skip = (safePage - 1) * safeLimit;

  if (!safeUserId) {
    return {
      transactions: [],
      pagination: {
        total: 0,
        page: safePage,
        limit: safeLimit,
        totalPages: 0,
      },
    };
  }

  await ensureCoinLedgerState(safeUserId);

  const [transactions, total] = await Promise.all([
    CoinTransactionModel.find({ user: safeUserId })
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(safeLimit)
      .lean(),
    CoinTransactionModel.countDocuments({ user: safeUserId }),
  ]);

  return {
    transactions,
    pagination: {
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit),
    },
  };
};

export const updateCoinSettings = async ({ data, updatedBy }) => {
  const payload = {
    coinsPerRupee: Number(data.coinsPerRupee),
    redeemRate: Number(data.redeemRate),
    maxRedeemPercentage: Number(data.maxRedeemPercentage),
    expiryDays: Number(data.expiryDays),
    updatedBy: updatedBy || null,
    isDefault: true,
  };

  return CoinSettingsModel.findOneAndUpdate({ isDefault: true }, payload, {
    upsert: true,
    new: true,
    runValidators: true,
  });
};

export default {
  adjustCoinsByAdmin,
  applyRedemptionToUser,
  awardCoinsToUser,
  calculateRedemption,
  getCoinSettings,
  getUserCoinSummary,
  getUserCoinTransactions,
  redeemCoins,
  updateCoinSettings,
};
