import UserModel from "../models/user.model.js";
import {
  getCoinSettings,
  updateCoinSettings,
} from "../services/coin.service.js";

export const getPublicCoinSettings = async (req, res) => {
  try {
    const settings = await getCoinSettings();
    return res.json({
      error: false,
      success: true,
      data: {
        coinsPerRupee: settings.coinsPerRupee,
        redeemRate: settings.redeemRate,
        maxRedeemPercentage: settings.maxRedeemPercentage,
        expiryDays: settings.expiryDays,
      },
    });
  } catch (error) {
    return res.status(500).json({
      error: true,
      success: false,
      message: "Failed to fetch coin settings",
    });
  }
};

export const getUserCoinBalance = async (req, res) => {
  try {
    const userId = req.user;
    const user = await UserModel.findById(userId).select("_id coinBalance").lean();
    if (!user) {
      return res.status(404).json({
        error: true,
        success: false,
        message: "User not found",
      });
    }

    return res.json({
      error: false,
      success: true,
      data: {
        coinBalance: Number(user.coinBalance || 0),
      },
    });
  } catch (error) {
    return res.status(500).json({
      error: true,
      success: false,
      message: "Failed to fetch coin balance",
    });
  }
};

export const getAdminCoinSettings = async (req, res) => {
  try {
    const settings = await getCoinSettings();
    return res.json({
      error: false,
      success: true,
      data: settings,
    });
  } catch (error) {
    return res.status(500).json({
      error: true,
      success: false,
      message: "Failed to fetch coin settings",
    });
  }
};

export const saveAdminCoinSettings = async (req, res) => {
  try {
    const { coinsPerRupee, redeemRate, maxRedeemPercentage, expiryDays } =
      req.body || {};

    const numericValues = {
      coinsPerRupee: Number(coinsPerRupee),
      redeemRate: Number(redeemRate),
      maxRedeemPercentage: Number(maxRedeemPercentage),
      expiryDays: Number(expiryDays),
    };

    if (
      Object.values(numericValues).some((value) => !Number.isFinite(value)) ||
      numericValues.coinsPerRupee < 0 ||
      numericValues.redeemRate < 0 ||
      numericValues.maxRedeemPercentage < 0 ||
      numericValues.maxRedeemPercentage > 100 ||
      numericValues.expiryDays < 1
    ) {
      return res.status(400).json({
        error: true,
        success: false,
        message: "Invalid coin settings values",
      });
    }

    const updatedBy = req.user?._id || req.user?.id || req.user || null;
    const updated = await updateCoinSettings({
      data: numericValues,
      updatedBy,
    });

    return res.json({
      error: false,
      success: true,
      message: "Coin settings updated successfully",
      data: updated,
    });
  } catch (error) {
    return res.status(500).json({
      error: true,
      success: false,
      message: "Failed to save coin settings",
    });
  }
};

export default {
  getAdminCoinSettings,
  getPublicCoinSettings,
  getUserCoinBalance,
  saveAdminCoinSettings,
};
