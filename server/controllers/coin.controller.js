import {
  getUserCoinSummary,
  getUserCoinTransactions,
  getCoinSettings,
  redeemCoins,
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
    const summary = await getUserCoinSummary({ userId });

    return res.json({
      error: false,
      success: true,
      data: {
        coinBalance: Number(summary?.usable_coins || 0),
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

export const getUserCoinsSummary = async (req, res) => {
  try {
    const userId = req.user;
    const summary = await getUserCoinSummary({ userId });

    return res.json({
      error: false,
      success: true,
      data: summary,
    });
  } catch (error) {
    return res.status(500).json({
      error: true,
      success: false,
      message: "Failed to fetch coin summary",
    });
  }
};

export const getUserCoinsTransactions = async (req, res) => {
  try {
    const userId = req.user;
    const page = Number(req.query?.page || 1);
    const limit = Number(req.query?.limit || 20);

    const result = await getUserCoinTransactions({
      userId,
      page,
      limit,
    });

    return res.json({
      error: false,
      success: true,
      data: result,
    });
  } catch (error) {
    return res.status(500).json({
      error: true,
      success: false,
      message: "Failed to fetch coin transactions",
    });
  }
};

export const redeemUserCoinsController = async (req, res) => {
  try {
    const userId = req.user;
    const requestedCoins = Number(req.body?.requestedCoins ?? req.body?.coins ?? 0);
    const orderTotal = Number(req.body?.orderTotal ?? req.body?.amount ?? 0);
    const source = String(req.body?.source || "order");
    const referenceId = req.body?.referenceId ? String(req.body.referenceId) : null;
    const allowedSources = new Set(["order", "membership", "admin", "system"]);

    if (!Number.isFinite(requestedCoins) || requestedCoins <= 0) {
      return res.status(400).json({
        error: true,
        success: false,
        message: "requestedCoins must be a positive number",
      });
    }

    if (!Number.isFinite(orderTotal) || orderTotal < 0) {
      return res.status(400).json({
        error: true,
        success: false,
        message: "orderTotal must be a non-negative number",
      });
    }

    if (!allowedSources.has(source)) {
      return res.status(400).json({
        error: true,
        success: false,
        message: "Invalid source value",
      });
    }

    const result = await redeemCoins({
      userId,
      requestedCoins,
      orderTotal,
      source,
      referenceId,
      meta: {
        fromApi: true,
      },
    });

    return res.json({
      error: false,
      success: true,
      data: result,
    });
  } catch (error) {
    return res.status(500).json({
      error: true,
      success: false,
      message: "Failed to redeem coins",
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
  getUserCoinsSummary,
  getUserCoinsTransactions,
  redeemUserCoinsController,
  saveAdminCoinSettings,
};
