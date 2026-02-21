const round2 = (value) =>
  Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

const toSafeNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const clampNonNegative = (value) => Math.max(round2(toSafeNumber(value, 0)), 0);

const extractOrderId = (orderOrId) => {
  if (!orderOrId) return "";

  if (typeof orderOrId === "string") return orderOrId;

  if (typeof orderOrId === "object") {
    if (orderOrId._id) return String(orderOrId._id);
    if (orderOrId.id) return String(orderOrId.id);
    if (
      typeof orderOrId.toString === "function" &&
      orderOrId.toString !== Object.prototype.toString
    ) {
      return String(orderOrId.toString());
    }
  }

  return "";
};

const deriveSubtotalFromProducts = (order) => {
  const products = Array.isArray(order?.products) ? order.products : [];
  const subtotal = products.reduce((sum, item) => {
    const quantity = Math.max(toSafeNumber(item?.quantity, 1), 1);
    const lineSubtotal = toSafeNumber(item?.subTotal, NaN);
    if (Number.isFinite(lineSubtotal) && lineSubtotal > 0) {
      return sum + lineSubtotal;
    }

    const price = Math.max(toSafeNumber(item?.price, 0), 0);
    return sum + price * quantity;
  }, 0);

  return round2(subtotal);
};

export const getOrderDisplayId = (orderOrId) => {
  const orderId = extractOrderId(orderOrId);
  if (!orderId) return "";
  return String(orderId).slice(0, 8).toUpperCase();
};

export const resolveOrderDisplayTotal = (order = {}) => {
  const finalAmount = clampNonNegative(order?.finalAmount);
  const totalAmount = clampNonNegative(order?.totalAmt);
  const hasFinalAmount = finalAmount > 0;
  const hasTotalAmount = totalAmount > 0;
  const persistedLow =
    hasFinalAmount && hasTotalAmount
      ? Math.min(finalAmount, totalAmount)
      : hasFinalAmount
        ? finalAmount
        : totalAmount;
  const persistedHigh =
    hasFinalAmount && hasTotalAmount
      ? Math.max(finalAmount, totalAmount)
      : persistedLow;

  const subtotalField = toSafeNumber(order?.subtotal, 0);
  const subtotal =
    subtotalField > 0 ? clampNonNegative(subtotalField) : deriveSubtotalFromProducts(order);

  const discount = clampNonNegative(order?.discount);
  const tax = clampNonNegative(order?.tax);
  const coinRedemptionAmount = clampNonNegative(order?.coinRedemption?.amount);
  const storedShipping = clampNonNegative(order?.shipping);

  const computedWithoutShipping = round2(
    Math.max(subtotal - discount + tax - coinRedemptionAmount, 0),
  );

  const dualPersistedAmountsMismatch =
    hasFinalAmount &&
    hasTotalAmount &&
    persistedHigh - persistedLow > 1 &&
    computedWithoutShipping > 0;

  if (dualPersistedAmountsMismatch) {
    const lowMatchesComputed = Math.abs(computedWithoutShipping - persistedLow) <= 1;
    const highLooksShippingInflated =
      storedShipping > 0 &&
      Math.abs(round2(computedWithoutShipping + storedShipping) - persistedHigh) <=
        Math.max(1, storedShipping * 0.35);

    if (lowMatchesComputed || highLooksShippingInflated) {
      return round2(persistedLow);
    }
  }

  const shippingInflatedLegacyTotal =
    computedWithoutShipping > 0 &&
    storedShipping > 0 &&
    persistedHigh > 0 &&
    Math.abs(round2(computedWithoutShipping + storedShipping) - round2(persistedHigh)) <=
      1;

  if (shippingInflatedLegacyTotal) {
    return computedWithoutShipping;
  }

  if (persistedLow > 0) {
    return round2(persistedLow);
  }

  return computedWithoutShipping;
};

const toPlainObject = (order) => {
  if (!order || typeof order !== "object") return order;
  if (typeof order.toObject === "function") {
    return order.toObject();
  }
  return order;
};

export const withOrderPresentation = (order) => {
  const plainOrder = toPlainObject(order);
  if (!plainOrder || typeof plainOrder !== "object") return plainOrder;

  return {
    ...plainOrder,
    displayOrderId: plainOrder.displayOrderId || getOrderDisplayId(plainOrder),
    displayTotal: resolveOrderDisplayTotal(plainOrder),
  };
};
