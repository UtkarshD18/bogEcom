import MembershipPlanModel from "../models/membershipPlan.model.js";
import MembershipUserModel from "../models/membershipUser.model.js";
import UserModel from "../models/user.model.js";
import { createPaytmPayment, getPaytmStatus } from "../services/paytm.service.js";
import {
  createPhonePePayment,
  getPhonePeOrderStatus,
} from "../services/phonepe.service.js";
import { getUserCoinSummary, redeemCoins } from "../services/coin.service.js";
import { activateMembershipForUser } from "../services/membershipUser.service.js";

// ==================== PAYMENT PROVIDER CONFIGURATION ====================

/**
 * Membership payment provider constants
 */
const PAYMENT_PROVIDERS = Object.freeze({
  PAYTM: "PAYTM",
  PHONEPE: "PHONEPE",
});
const configuredPaymentProvider = String(
  process.env.PAYMENT_PROVIDER || PAYMENT_PROVIDERS.PAYTM,
)
  .trim()
  .toUpperCase();
const PAYTM_MERCHANT_ID = String(process.env.PAYTM_MERCHANT_ID || "").trim();
const PAYTM_MERCHANT_KEY = String(process.env.PAYTM_MERCHANT_KEY || "").trim();
const PHONEPE_CLIENT_ID = String(process.env.PHONEPE_CLIENT_ID || "").trim();
const PHONEPE_CLIENT_SECRET = String(process.env.PHONEPE_CLIENT_SECRET || "").trim();
const isValidPaytmMerchantKey = (value) =>
  [16, 24, 32].includes(String(value || "").trim().length);
const isTruthyEnv = (value) => {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();
  return (
    normalized === "true" ||
    normalized === "1" ||
    normalized === "yes" ||
    normalized === "on"
  );
};

/**
 * Membership payment provider readiness
 */
const PAYMENT_PROVIDER_ENV_ENABLED = Object.freeze({
  PAYTM: Boolean(
    isTruthyEnv(process.env.PAYTM_ENABLED) &&
      PAYTM_MERCHANT_ID &&
      isValidPaytmMerchantKey(PAYTM_MERCHANT_KEY),
  ),
  PHONEPE: Boolean(
    isTruthyEnv(process.env.PHONEPE_ENABLED) &&
      PHONEPE_CLIENT_ID &&
      PHONEPE_CLIENT_SECRET,
  ),
});
const getEnabledPaymentProviders = () =>
  Object.entries(PAYMENT_PROVIDER_ENV_ENABLED)
    .filter(([, enabled]) => Boolean(enabled))
    .map(([provider]) => provider);
const resolveDefaultPaymentProvider = () => {
  const requested = configuredPaymentProvider;
  const isSupported = Object.values(PAYMENT_PROVIDERS).includes(requested);
  if (isSupported && PAYMENT_PROVIDER_ENV_ENABLED[requested]) {
    return requested;
  }

  const fallbackOrder =
    requested === PAYMENT_PROVIDERS.PHONEPE
      ? [PAYMENT_PROVIDERS.PHONEPE, PAYMENT_PROVIDERS.PAYTM]
      : [PAYMENT_PROVIDERS.PAYTM, PAYMENT_PROVIDERS.PHONEPE];
  return (
    fallbackOrder.find((provider) => PAYMENT_PROVIDER_ENV_ENABLED[provider]) ||
    null
  );
};
const DEFAULT_MEMBERSHIP_PAYMENT_PROVIDER = resolveDefaultPaymentProvider();
const isPaymentEnabled = () =>
  Object.values(PAYMENT_PROVIDER_ENV_ENABLED).some(Boolean);
const resolveMembershipPaymentProvider = (requestedProvider) => {
  const normalized = String(requestedProvider || "")
    .trim()
    .toUpperCase();
  if (normalized) {
    if (!Object.values(PAYMENT_PROVIDERS).includes(normalized)) {
      return null;
    }
    if (!PAYMENT_PROVIDER_ENV_ENABLED[normalized]) {
      return null;
    }
    return normalized;
  }

  if (DEFAULT_MEMBERSHIP_PAYMENT_PROVIDER) {
    return DEFAULT_MEMBERSHIP_PAYMENT_PROVIDER;
  }

  return null;
};
const round2 = (value) =>
  Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
const floorInt = (value) => Math.max(Math.floor(Number(value || 0)), 0);

const decodePaytmEnvelope = (body = {}) => {
  if (!body) return {};

  if (typeof body === "string") {
    try {
      const parsed = JSON.parse(body);
      if (parsed && typeof parsed === "object") return parsed;
    } catch {
      return {};
    }
  }

  if (body.BODY && typeof body.BODY === "string") {
    try {
      const parsed = JSON.parse(body.BODY);
      if (parsed && typeof parsed === "object") return parsed;
    } catch {
      // fallback to raw payload
    }
  }

  if (body.body && typeof body.body === "string") {
    try {
      const parsed = JSON.parse(body.body);
      if (parsed && typeof parsed === "object") return parsed;
    } catch {
      // fallback to raw payload
    }
  }

  if (body.body && typeof body.body === "object") {
    return body.body;
  }

  return body;
};

const extractPaytmFields = (payload = {}) => {
  const resultInfo =
    payload?.resultInfo && typeof payload.resultInfo === "object"
      ? payload.resultInfo
      : payload?.RESULTINFO && typeof payload.RESULTINFO === "object"
        ? payload.RESULTINFO
        : {};

  return {
    merchantTransactionId:
      payload?.merchantTransactionId ||
      payload?.ORDERID ||
      payload?.orderId ||
      payload?.orderid ||
      payload?.order_id ||
      null,
    transactionId:
      payload?.transactionId ||
      payload?.TXNID ||
      payload?.txnId ||
      payload?.txn_id ||
      payload?.providerReferenceId ||
      payload?.BANKTXNID ||
      null,
    state:
      resultInfo?.resultStatus ||
      payload?.STATUS ||
      payload?.status ||
      payload?.state ||
      payload?.resultStatus ||
      null,
  };
};

const extractPhonePeState = (statusPayload = {}) =>
  String(statusPayload?.state || statusPayload?.status || "")
    .trim()
    .toUpperCase();

const computeMembershipExpiry = (plan) => {
  const expiry = new Date();
  if (plan.durationUnit === "months") {
    expiry.setMonth(expiry.getMonth() + Number(plan.duration || 0));
  } else if (plan.durationUnit === "years") {
    expiry.setFullYear(expiry.getFullYear() + Number(plan.duration || 0));
  } else {
    expiry.setDate(expiry.getDate() + Number(plan.duration || 0));
  }
  return expiry;
};

const activateMembership = async ({ user, plan, membershipPaymentId }) => {
  const startDate = new Date();
  const expiry = computeMembershipExpiry(plan);
  await activateMembershipForUser({
    userId: user._id,
    startDate,
    expiryDate: expiry,
    membershipPlan: plan?._id || null,
    membershipPaymentId: membershipPaymentId || null,
  });
  return expiry;
};

const getMembershipCoinPreview = async ({ userId, planPrice, requestedCoins }) => {
  const safePlanPrice = Math.max(round2(planPrice), 0);
  const safeRequestedCoins = floorInt(requestedCoins);

  const summary = await getUserCoinSummary({ userId });
  const settings = summary?.settings || {};
  const redeemRate = Number(settings.redeemRate || 0);
  const usableCoins = floorInt(summary?.usable_coins || 0);

  const maxRedeemRupees = safePlanPrice;
  const maxCoinsByLimit =
    redeemRate > 0 ? floorInt(maxRedeemRupees / redeemRate) : 0;
  const coinsUsed = Math.min(safeRequestedCoins, usableCoins, maxCoinsByLimit);
  const redeemAmount = round2(coinsUsed * redeemRate);
  const payableAmount = Math.max(round2(safePlanPrice - redeemAmount), 0);

  return {
    requestedCoins: safeRequestedCoins,
    usableCoins,
    coinsUsed,
    redeemAmount,
    maxRedeemRupees,
    maxCoinsByLimit,
    payableAmount,
    settings: {
      redeemRate,
    },
  };
};

/**
 * Membership Controller
 */

// ==================== PUBLIC ENDPOINTS ====================

/**
 * Get active membership plan (public)
 * @route GET /api/membership/active
 */
export const getActivePlan = async (req, res) => {
  try {
    const plan = await MembershipPlanModel.findOne({
      $or: [{ isActive: true }, { active: true }],
    });

    if (!plan) {
      return res.status(404).json({
        error: true,
        success: false,
        message: "No active membership plan available",
      });
    }

    res.status(200).json({
      error: false,
      success: true,
      data: plan,
    });
  } catch (error) {
    console.error("Error fetching active plan:", error);
    res.status(500).json({
      error: true,
      success: false,
      message: "Failed to fetch membership plan",
    });
  }
};

/**
 * Get user membership status
 * @route GET /api/membership/status
 */
export const getMembershipStatus = async (req, res) => {
  try {
    const userId = req.user;

    const [user, membershipUser] = await Promise.all([
      UserModel.findById(userId)
        .select(
          "isMember is_member membership_id membershipPlan membershipExpiry",
        )
        .populate(
          "membershipPlan",
          "name benefits discountPercent pointsMultiplier",
        ),
      MembershipUserModel.findOne({ user: userId })
        .select("status expiryDate")
        .lean(),
    ]);

    if (!user) {
      return res.status(404).json({
        error: true,
        success: false,
        message: "User not found",
      });
    }

    const now = new Date();
    const recordExpiry = membershipUser?.expiryDate
      ? new Date(membershipUser.expiryDate)
      : null;
    const userExpiry = user.membershipExpiry ? new Date(user.membershipExpiry) : null;
    const effectiveExpiry = recordExpiry || userExpiry || null;
    const isExpired = effectiveExpiry ? now > effectiveExpiry : false;
    const recordActive =
      membershipUser?.status === "active" &&
      recordExpiry &&
      recordExpiry > now;
    const legacyActive =
      (Boolean(user.isMember) || Boolean(user.is_member)) && !isExpired;
    const isMember = Boolean(recordActive || legacyActive);

    res.status(200).json({
      error: false,
      success: true,
      data: {
        isMember,
        membershipActive: isMember,
        membershipId: user.membership_id || null,
        membershipPlan: user.membershipPlan,
        membershipExpiry: effectiveExpiry || null,
        isExpired,
      },
    });
  } catch (error) {
    console.error("Error fetching membership status:", error);
    res.status(500).json({
      error: true,
      success: false,
      message: "Failed to fetch membership status",
    });
  }
};

// ==================== USER ENDPOINTS ====================

/**
 * Create membership order (Paytm)
 * @route POST /api/membership/create-order
 */
export const createMembershipOrder = async (req, res) => {
  try {
    const { planId } = req.body;
    if (!planId) {
      return res.status(400).json({
        error: true,
        success: false,
        message: "planId is required",
      });
    }

    const plan = await MembershipPlanModel.findById(planId);
    if (!plan) {
      return res.status(404).json({
        error: true,
        success: false,
        message: "Membership plan not found",
      });
    }

    const userId = req.user;
    const requestedCoins = floorInt(req.body?.coinRedeem?.coins || 0);
    const coinPreview = await getMembershipCoinPreview({
      userId,
      planPrice: Number(plan.price || 0),
      requestedCoins,
    });

    const merchantTransactionId = `MEM_${userId}_${Date.now()}`;

    if (coinPreview.payableAmount <= 0) {
      let redemptionResult = {
        coinsUsed: 0,
        redeemAmount: 0,
      };
      if (coinPreview.coinsUsed > 0) {
        redemptionResult = await redeemCoins({
          userId,
          requestedCoins: coinPreview.coinsUsed,
          orderTotal: Number(plan.price || 0),
          source: "membership",
          referenceId: merchantTransactionId,
          meta: {
            planId: String(plan._id),
            reason: "membership-full-redeem",
          },
        });
      }

      const user = await UserModel.findById(userId);
      if (!user) {
        return res.status(404).json({
          error: true,
          success: false,
          message: "User not found",
        });
      }

      const expiry = await activateMembership({
        user,
        plan,
        membershipPaymentId: merchantTransactionId,
      });

      return res.status(200).json({
        error: false,
        success: true,
        message: "Membership activated using coins",
        data: {
          membershipActivated: true,
          merchantTransactionId,
          paymentUrl: null,
          planId: plan._id,
          payableAmount: 0,
          coinRedemption: {
            coinsUsed: floorInt(redemptionResult?.coinsUsed || 0),
            redeemAmount: round2(redemptionResult?.redeemAmount || 0),
            maxRedeemRupees: coinPreview.maxRedeemRupees,
            maxCoinsByLimit: coinPreview.maxCoinsByLimit,
          },
          membershipPlan: plan._id,
          membershipExpiry: expiry,
        },
      });
    }

    const enabledProviders = getEnabledPaymentProviders();
    const selectedPaymentProvider = resolveMembershipPaymentProvider(
      req.body?.paymentProvider,
    );

    if (!isPaymentEnabled() || enabledProviders.length === 0) {
      return res.status(503).json({
        error: true,
        success: false,
        message:
          "Membership payments are temporarily unavailable. Payment gateway is not configured.",
        paymentProvider: null,
        data: {
          coinRedemption: coinPreview,
          payableAmount: coinPreview.payableAmount,
          enabledProviders,
          defaultProvider: DEFAULT_MEMBERSHIP_PAYMENT_PROVIDER,
        },
      });
    }

    if (!selectedPaymentProvider) {
      return res.status(422).json({
        error: true,
        success: false,
        message:
          "Selected payment provider is unavailable. Please choose another method.",
        data: {
          enabledProviders,
          defaultProvider: DEFAULT_MEMBERSHIP_PAYMENT_PROVIDER,
        },
      });
    }

    const primaryOrigin = String(process.env.CLIENT_URL || "")
      .split(",")[0]
      .trim()
      .replace(/\/+$/, "");
    const backendUrl = String(
      process.env.BACKEND_URL ||
        process.env.API_BASE_URL ||
        (process.env.GAE_DEFAULT_HOSTNAME
          ? `https://${process.env.GAE_DEFAULT_HOSTNAME}`
          : ""),
    )
      .trim()
      .replace(/\/+$/, "");

    const baseMembershipReturnPath = "/membership/checkout";

    if (selectedPaymentProvider === PAYMENT_PROVIDERS.PAYTM) {
      const callbackUrl =
        process.env.PAYTM_MEMBERSHIP_CALLBACK_URL ||
        `${primaryOrigin}${baseMembershipReturnPath}`;

      const paytmResponse = await createPaytmPayment({
        amount: Math.max(coinPreview.payableAmount, 1),
        orderId: merchantTransactionId,
        callbackUrl,
        customerId: String(userId),
        mobileNumber: String(req.body?.mobile || "").trim() || null,
        email: String(req.body?.email || "").trim().toLowerCase() || null,
      });
      const gatewayBase = (() => {
        try {
          return new URL(String(paytmResponse.gatewayUrl || "")).origin;
        } catch {
          return "";
        }
      })();

      const basePaymentUrl = `${primaryOrigin}/payment/paytm?mid=${encodeURIComponent(
        paytmResponse.mid,
      )}&orderId=${encodeURIComponent(
        paytmResponse.orderId,
      )}&txnToken=${encodeURIComponent(
        paytmResponse.txnToken,
      )}&amount=${encodeURIComponent(
        Number(coinPreview.payableAmount).toFixed(2),
      )}&flow=membership&returnPath=${encodeURIComponent(
        baseMembershipReturnPath,
      )}&planId=${encodeURIComponent(String(plan._id))}&paymentProvider=${encodeURIComponent(
        PAYMENT_PROVIDERS.PAYTM,
      )}&coins=${encodeURIComponent(String(coinPreview.coinsUsed || 0))}`;
      const paymentUrl = gatewayBase
        ? `${basePaymentUrl}&gatewayBase=${encodeURIComponent(gatewayBase)}`
        : basePaymentUrl;

      return res.status(200).json({
        error: false,
        success: true,
        message: "Membership order created",
        data: {
          membershipActivated: false,
          paymentProvider: PAYMENT_PROVIDERS.PAYTM,
          paymentUrl,
          merchantTransactionId,
          planId: plan._id,
          payableAmount: coinPreview.payableAmount,
          enabledProviders,
          defaultProvider: DEFAULT_MEMBERSHIP_PAYMENT_PROVIDER,
          coinRedemption: {
            coinsUsed: coinPreview.coinsUsed,
            redeemAmount: coinPreview.redeemAmount,
            maxRedeemRupees: coinPreview.maxRedeemRupees,
            maxCoinsByLimit: coinPreview.maxCoinsByLimit,
          },
        },
      });
    }

    if (selectedPaymentProvider === PAYMENT_PROVIDERS.PHONEPE) {
      const callbackUrl =
        process.env.PHONEPE_MEMBERSHIP_CALLBACK_URL ||
        `${backendUrl}/api/membership/webhook/phonepe?merchantOrderId=${encodeURIComponent(
          merchantTransactionId,
        )}`;
      const redirectUrl = (() => {
        const configured =
          process.env.PHONEPE_MEMBERSHIP_REDIRECT_URL ||
          process.env.PHONEPE_REDIRECT_URL ||
          `${primaryOrigin}/payment/phonepe`;
        try {
          const url = new URL(
            configured.startsWith("http")
              ? configured
              : `${primaryOrigin}${configured.startsWith("/") ? "" : "/"}${configured}`,
          );
           url.searchParams.set("merchantOrderId", merchantTransactionId);
           url.searchParams.set("flow", "membership");
           url.searchParams.set("returnPath", baseMembershipReturnPath);
           url.searchParams.set("planId", String(plan._id));
           url.searchParams.set("paymentProvider", PAYMENT_PROVIDERS.PHONEPE);
           url.searchParams.set(
             "coins",
             String(Math.max(floorInt(coinPreview.coinsUsed || 0), 0)),
           );
           return url.toString();
         } catch {
           return `${primaryOrigin}/payment/phonepe?merchantOrderId=${encodeURIComponent(
             merchantTransactionId,
           )}&flow=membership&returnPath=${encodeURIComponent(
             baseMembershipReturnPath,
           )}&planId=${encodeURIComponent(
             String(plan._id),
           )}&paymentProvider=${encodeURIComponent(
             PAYMENT_PROVIDERS.PHONEPE,
           )}&coins=${encodeURIComponent(
             String(Math.max(floorInt(coinPreview.coinsUsed || 0), 0)),
           )}`;
         }
       })();

      const phonepeResponse = await createPhonePePayment({
        amount: Math.max(coinPreview.payableAmount, 1),
        merchantOrderId: merchantTransactionId,
        redirectUrl,
        callbackUrl,
        customerId: String(userId),
      });

      return res.status(200).json({
        error: false,
        success: true,
        message: "Membership order created",
        data: {
          membershipActivated: false,
          paymentProvider: PAYMENT_PROVIDERS.PHONEPE,
          paymentUrl: phonepeResponse.redirectUrl,
          merchantTransactionId,
          planId: plan._id,
          payableAmount: coinPreview.payableAmount,
          enabledProviders,
          defaultProvider: DEFAULT_MEMBERSHIP_PAYMENT_PROVIDER,
          coinRedemption: {
            coinsUsed: coinPreview.coinsUsed,
            redeemAmount: coinPreview.redeemAmount,
            maxRedeemRupees: coinPreview.maxRedeemRupees,
            maxCoinsByLimit: coinPreview.maxCoinsByLimit,
          },
        },
      });
    }

    return res.status(422).json({
      error: true,
      success: false,
      message: "Unsupported payment provider selected",
      data: {
        enabledProviders,
        defaultProvider: DEFAULT_MEMBERSHIP_PAYMENT_PROVIDER,
      },
    });
  } catch (error) {
    console.error("Error creating membership order:", error);
    res.status(500).json({
      error: true,
      success: false,
      message: "Failed to create membership order",
    });
  }
};

/**
 * Public Paytm callback endpoint for membership flow
 * @route POST /api/membership/webhook/paytm
 */
export const handleMembershipPaytmCallback = async (req, res) => {
  try {
    const payload = decodePaytmEnvelope(req.body || {});
    const callbackData = extractPaytmFields(payload);
    const merchantTransactionId = callbackData.merchantTransactionId;

    if (!merchantTransactionId) {
      return res.status(200).json({
        error: false,
        success: true,
        message: "Callback acknowledged",
      });
    }

    let verifiedState = callbackData.state || null;
    let verifiedTransactionId = callbackData.transactionId || null;

    try {
      const statusPayload = await getPaytmStatus({ orderId: merchantTransactionId });
      const normalized = extractPaytmFields(statusPayload || {});
      verifiedState = normalized.state || verifiedState;
      verifiedTransactionId = normalized.transactionId || verifiedTransactionId;
    } catch (statusError) {
      console.warn(
        "Membership callback status verification failed:",
        statusError?.message || statusError,
      );
    }

    console.log("Membership callback received", {
      merchantTransactionId,
      state: verifiedState,
      transactionId: verifiedTransactionId,
    });

    // Membership activation still happens via authenticated /verify-payment.
    return res.status(200).json({
      error: false,
      success: true,
      message: "Callback acknowledged",
    });
  } catch (error) {
    console.error("Error processing membership callback:", error);
    return res.status(200).json({
      error: false,
      success: true,
      message: "Callback acknowledged",
    });
  }
};

/**
 * Public PhonePe callback endpoint for membership flow
 * @route POST /api/membership/webhook/phonepe
 */
export const handleMembershipPhonePeCallback = async (req, res) => {
  try {
    const merchantTransactionId = String(
      req.body?.merchantOrderId ||
        req.body?.merchant_order_id ||
        req.query?.merchantOrderId ||
        "",
    ).trim();

    if (!merchantTransactionId) {
      return res.status(200).json({
        error: false,
        success: true,
        message: "Callback acknowledged",
      });
    }

    let state = null;
    let phonepeOrderId = null;
    try {
      const statusPayload = await getPhonePeOrderStatus({
        merchantOrderId: merchantTransactionId,
      });
      state = extractPhonePeState(statusPayload);
      phonepeOrderId = statusPayload?.orderId || null;
    } catch (statusError) {
      console.warn(
        "Membership PhonePe callback status verification failed:",
        statusError?.message || statusError,
      );
    }

    console.log("Membership PhonePe callback received", {
      merchantTransactionId,
      state,
      phonepeOrderId,
    });

    // Membership activation still happens via authenticated /verify-payment.
    return res.status(200).json({
      error: false,
      success: true,
      message: "Callback acknowledged",
    });
  } catch (error) {
    console.error("Error processing membership PhonePe callback:", error);
    return res.status(200).json({
      error: false,
      success: true,
      message: "Callback acknowledged",
    });
  }
};

/**
 * Verify membership payment (Paytm / PhonePe)
 * @route POST /api/membership/verify-payment
 */
export const verifyMembershipPayment = async (req, res) => {
  try {
    const enabledProviders = getEnabledPaymentProviders();
    if (!isPaymentEnabled() || enabledProviders.length === 0) {
      return res.status(503).json({
        error: true,
        success: false,
        message:
          "Membership payment verification unavailable. Payment gateway is not configured.",
        paymentProvider: null,
        data: {
          enabledProviders,
          defaultProvider: DEFAULT_MEMBERSHIP_PAYMENT_PROVIDER,
        },
      });
    }

    const { merchantTransactionId, planId } = req.body || {};
    const selectedPaymentProvider = resolveMembershipPaymentProvider(
      req.body?.paymentProvider,
    );
    const requestedCoins = floorInt(req.body?.coinRedeem?.coins || 0);

    if (!merchantTransactionId || !planId) {
      return res.status(400).json({
        error: true,
        success: false,
        message: "merchantTransactionId and planId are required",
      });
    }

    if (!selectedPaymentProvider) {
      return res.status(422).json({
        error: true,
        success: false,
        message:
          "Selected payment provider is unavailable. Please choose another method.",
        data: {
          enabledProviders,
          defaultProvider: DEFAULT_MEMBERSHIP_PAYMENT_PROVIDER,
        },
      });
    }

    let paymentSuccessful = false;
    if (selectedPaymentProvider === PAYMENT_PROVIDERS.PAYTM) {
      const statusPayload = await getPaytmStatus({ orderId: merchantTransactionId });
      const statusFields = extractPaytmFields(statusPayload || {});
      const state = String(statusFields.state || "")
        .trim()
        .toLowerCase();
      paymentSuccessful = state.includes("success");
    } else if (selectedPaymentProvider === PAYMENT_PROVIDERS.PHONEPE) {
      const statusPayload = await getPhonePeOrderStatus({
        merchantOrderId: merchantTransactionId,
      });
      const state = extractPhonePeState(statusPayload);
      paymentSuccessful =
        state.includes("COMPLETED") || state.includes("SUCCESS");
    }

    if (!paymentSuccessful) {
      return res.status(400).json({
        error: true,
        success: false,
        message: "Payment not successful yet",
      });
    }

    const user = await UserModel.findById(req.user);
    if (!user) {
      return res.status(404).json({
        error: true,
        success: false,
        message: "User not found",
      });
    }

    const plan = await MembershipPlanModel.findById(planId);
    if (!plan) {
      return res.status(404).json({
        error: true,
        success: false,
        message: "Membership plan not found",
      });
    }

    let redemptionResult = {
      coinsUsed: 0,
      redeemAmount: 0,
      maxRedeemRupees: 0,
      maxCoinsByLimit: 0,
    };
    if (requestedCoins > 0) {
      redemptionResult = await redeemCoins({
        userId: req.user,
        requestedCoins,
        orderTotal: Number(plan.price || 0),
        source: "membership",
        referenceId: String(merchantTransactionId),
        meta: {
          planId: String(plan._id),
          reason: "membership-payment-verify",
        },
      });
    }

    const expiry = await activateMembership({
      user,
      plan,
      membershipPaymentId: merchantTransactionId,
    });

    return res.status(200).json({
      error: false,
      success: true,
      message: "Membership activated",
      data: {
        paymentProvider: selectedPaymentProvider,
        membershipPlan: plan._id,
        membershipExpiry: expiry,
        coinRedemption: {
          coinsUsed: floorInt(redemptionResult?.coinsUsed || 0),
          redeemAmount: round2(redemptionResult?.redeemAmount || 0),
          maxRedeemRupees: round2(redemptionResult?.maxRedeemRupees || 0),
          maxCoinsByLimit: floorInt(redemptionResult?.maxCoinsByLimit || 0),
          remainingBalance: floorInt(redemptionResult?.remainingBalance || 0),
        },
      },
    });
  } catch (error) {
    console.error("Error verifying membership payment:", error);
    res.status(500).json({
      error: true,
      success: false,
      message: "Failed to verify payment",
    });
  }
};

// ==================== ADMIN ENDPOINTS ====================

/**
 * Get all membership plans (Admin)
 * @route GET /api/membership/admin/plans
 */
export const getAllPlans = async (req, res) => {
  try {
    const plans = await MembershipPlanModel.find().sort({
      sortOrder: 1,
      createdAt: -1,
    });

    res.status(200).json({
      error: false,
      success: true,
      data: plans,
    });
  } catch (error) {
    console.error("Error fetching plans:", error);
    res.status(500).json({
      error: true,
      success: false,
      message: "Failed to fetch membership plans",
    });
  }
};

/**
 * Create membership plan (Admin)
 * @route POST /api/membership/admin/plans
 */
export const createPlan = async (req, res) => {
  try {
    const {
      name,
      description,
      price,
      durationDays,
      discountPercentage,
      active,
      originalPrice,
      duration,
      durationUnit,
      benefits,
      isActive,
    } = req.body;

    if (!name || price === undefined) {
      return res.status(400).json({
        error: true,
        success: false,
        message: "Name and price are required",
      });
    }

    const plan = new MembershipPlanModel({
      name,
      description,
      price,
      durationDays: Number(durationDays || duration || 365),
      discountPercentage: Number(
        discountPercentage ?? req.body.discountPercent ?? 0,
      ),
      active: Boolean(active ?? isActive ?? false),
      originalPrice,
      duration: Number(duration || durationDays || 365),
      durationUnit: durationUnit || "days",
      benefits: benefits || [],
      isActive: Boolean(isActive ?? active ?? false),
    });

    await plan.save();

    res.status(201).json({
      error: false,
      success: true,
      message: "Membership plan created",
      data: plan,
    });
  } catch (error) {
    console.error("Error creating plan:", error);
    res.status(500).json({
      error: true,
      success: false,
      message: "Failed to create membership plan",
    });
  }
};

/**
 * Update membership plan (Admin)
 * @route PUT /api/membership/admin/plans/:id
 */
export const updatePlan = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = { ...req.body };

    if (updates.durationDays !== undefined || updates.duration !== undefined) {
      updates.durationDays = Number(updates.durationDays || updates.duration);
      updates.duration = Number(updates.duration || updates.durationDays);
      updates.durationUnit = "days";
    }

    if (
      updates.discountPercentage !== undefined ||
      updates.discountPercent !== undefined
    ) {
      const value = Number(
        updates.discountPercentage ?? updates.discountPercent ?? 0,
      );
      updates.discountPercentage = value;
      updates.discountPercent = value;
    }

    if (updates.active !== undefined || updates.isActive !== undefined) {
      const activeValue = Boolean(updates.active ?? updates.isActive);
      updates.active = activeValue;
      updates.isActive = activeValue;
    }

    const plan = await MembershipPlanModel.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    });

    if (!plan) {
      return res.status(404).json({
        error: true,
        success: false,
        message: "Plan not found",
      });
    }

    res.status(200).json({
      error: false,
      success: true,
      message: "Plan updated",
      data: plan,
    });
  } catch (error) {
    console.error("Error updating plan:", error);
    res.status(500).json({
      error: true,
      success: false,
      message: "Failed to update plan",
    });
  }
};

/**
 * Delete membership plan (Admin)
 * @route DELETE /api/membership/admin/plans/:id
 */
export const deletePlan = async (req, res) => {
  try {
    const { id } = req.params;

    const plan = await MembershipPlanModel.findByIdAndDelete(id);

    if (!plan) {
      return res.status(404).json({
        error: true,
        success: false,
        message: "Plan not found",
      });
    }

    res.status(200).json({
      error: false,
      success: true,
      message: "Plan deleted",
    });
  } catch (error) {
    console.error("Error deleting plan:", error);
    res.status(500).json({
      error: true,
      success: false,
      message: "Failed to delete plan",
    });
  }
};

/**
 * Set plan as active (Admin)
 * @route PUT /api/membership/admin/plans/:id/activate
 */
export const activatePlan = async (req, res) => {
  try {
    const { id } = req.params;

    // Deactivate all plans
    await MembershipPlanModel.updateMany({}, { isActive: false, active: false });

    // Activate selected plan
    const plan = await MembershipPlanModel.findByIdAndUpdate(
      id,
      { isActive: true, active: true },
      { new: true },
    );

    if (!plan) {
      return res.status(404).json({
        error: true,
        success: false,
        message: "Plan not found",
      });
    }

    res.status(200).json({
      error: false,
      success: true,
      message: "Plan activated",
      data: plan,
    });
  } catch (error) {
    console.error("Error activating plan:", error);
    res.status(500).json({
      error: true,
      success: false,
      message: "Failed to activate plan",
    });
  }
};

/**
 * Get membership statistics (Admin)
 * @route GET /api/membership/admin/stats
 */
export const getMembershipStats = async (req, res) => {
  try {
    const now = new Date();
    const membershipUserCount = await MembershipUserModel.countDocuments({});

    let totalMembers = 0;
    let activeMembers = 0;
    let expiredMembers = 0;

    if (membershipUserCount > 0) {
      [totalMembers, activeMembers, expiredMembers] = await Promise.all([
        MembershipUserModel.countDocuments({}),
        MembershipUserModel.countDocuments({
          status: "active",
          expiryDate: { $gt: now },
        }),
        MembershipUserModel.countDocuments({
          $or: [
            { status: "expired" },
            { status: "active", expiryDate: { $lte: now } },
          ],
        }),
      ]);
    } else {
      [totalMembers, activeMembers, expiredMembers] = await Promise.all([
        UserModel.countDocuments({ isMember: true }),
        UserModel.countDocuments({
          isMember: true,
          membershipExpiry: { $gt: now },
        }),
        UserModel.countDocuments({
          isMember: true,
          membershipExpiry: { $lte: now },
        }),
      ]);
    }

    res.status(200).json({
      error: false,
      success: true,
      data: {
        totalMembers,
        activeMembers,
        expiredMembers,
      },
    });
  } catch (error) {
    console.error("Error fetching stats:", error);
    res.status(500).json({
      error: true,
      success: false,
      message: "Failed to fetch statistics",
    });
  }
};
