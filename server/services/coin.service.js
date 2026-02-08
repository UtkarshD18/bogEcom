import CoinSettingsModel from "../models/coinSettings.model.js";
import UserModel from "../models/user.model.js";

const round2 = (value) =>
  Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

const floorInt = (value) => Math.max(Math.floor(Number(value || 0)), 0);

const DEFAULT_COIN_SETTINGS = {
  coinsPerRupee: 0.05,
  redeemRate: 0.1,
  maxRedeemPercentage: 20,
  expiryDays: 365,
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

export const applyRedemptionToUser = async ({ userId, coinsUsed }) => {
  const safeCoins = floorInt(coinsUsed);
  if (!userId || safeCoins <= 0) return null;

  return UserModel.findByIdAndUpdate(
    userId,
    { $inc: { coinBalance: -safeCoins } },
    { new: true, runValidators: true },
  ).select("_id coinBalance");
};

export const awardCoinsToUser = async ({ userId, orderAmount }) => {
  if (!userId) return { coinsAwarded: 0, user: null };

  const settings = await getCoinSettings();
  const coinsAwarded = floorInt(
    Number(orderAmount || 0) * Number(settings.coinsPerRupee || 0),
  );

  if (coinsAwarded <= 0) {
    return { coinsAwarded: 0, user: null };
  }

  const user = await UserModel.findByIdAndUpdate(
    userId,
    { $inc: { coinBalance: coinsAwarded } },
    { new: true, runValidators: true },
  ).select("_id coinBalance");

  return { coinsAwarded, user };
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

  return CoinSettingsModel.findOneAndUpdate(
    { isDefault: true },
    payload,
    { upsert: true, new: true, runValidators: true },
  );
};

export default {
  applyRedemptionToUser,
  awardCoinsToUser,
  calculateRedemption,
  getCoinSettings,
  updateCoinSettings,
};
