const round2 = (value) =>
  Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

const NON_PREPAID_METHODS = new Set(["COD", "PENDING"]);

const computeProductCost = (order) => {
  const subtotalFromItems = round2(
    (order?.products || []).reduce(
      (sum, item) => sum + Number(item?.subTotal || 0),
      0,
    ),
  );

  const subtotal = round2(order?.subtotal || subtotalFromItems);
  const membershipDiscount = round2(order?.membershipDiscount || 0);
  const aggregateDiscount = round2(order?.discount || 0);
  // New orders persist membership inside `discount`; legacy orders may not.
  const couponAndInfluencerDiscount =
    aggregateDiscount >= membershipDiscount
      ? aggregateDiscount
      : round2(aggregateDiscount + membershipDiscount);
  const coinDiscount = round2(order?.coinRedemption?.amount || 0);
  const totalDiscount = round2(
    couponAndInfluencerDiscount + coinDiscount,
  );

  return Math.max(round2(subtotal - totalDiscount), 0);
};

export const evaluateRefundEligibility = (order) => {
  if (!order) {
    return {
      eligible: false,
      reason: "Order not found",
      refundableAmount: 0,
      requiresManualApproval: true,
    };
  }

  const normalizedMethod = String(order.paymentMethod || "").toUpperCase();
  const isPrepaid =
    order.payment_status === "paid" &&
    !NON_PREPAID_METHODS.has(normalizedMethod);

  if (!isPrepaid) {
    return {
      eligible: false,
      reason: "Refund allowed only for prepaid orders",
      refundableAmount: 0,
      requiresManualApproval: true,
    };
  }

  if (String(order.order_status || "").toLowerCase() === "cancelled") {
    return {
      eligible: false,
      reason: "Order is already cancelled",
      refundableAmount: 0,
      requiresManualApproval: true,
    };
  }

  const refundableAmount = computeProductCost(order);

  return {
    eligible: refundableAmount > 0,
    reason:
      refundableAmount > 0
        ? "Eligible for manual approval refund (product cost only)"
        : "No refundable product amount found",
    refundableAmount,
    includesShipping: false,
    requiresManualApproval: true,
    policy: {
      prepaidOnly: true,
      standardReturnsAllowed: false,
      manualApprovalOnly: true,
      shippingRefundable: false,
    },
  };
};

export const enforceRefundPolicy = (order) => {
  const evaluation = evaluateRefundEligibility(order);
  if (!evaluation.eligible) {
    const error = new Error(evaluation.reason);
    error.code = "REFUND_NOT_ALLOWED";
    error.details = evaluation;
    throw error;
  }
  return evaluation;
};

export default {
  enforceRefundPolicy,
  evaluateRefundEligibility,
};
