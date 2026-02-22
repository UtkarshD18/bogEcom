const round2 = (value) =>
  Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

const toSafeNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const resolveOrderDisplayId = (order = {}) => {
  const explicitId =
    order?.displayOrderId ||
    order?.orderNumber ||
    order?.order_id ||
    order?.orderId ||
    "";
  if (String(explicitId || "").trim()) {
    return String(explicitId).trim().toUpperCase();
  }

  const mongoId = String(order?._id || "").trim();
  if (!mongoId) return "N/A";
  return `BOG-${mongoId.slice(-8).toUpperCase()}`;
};

const toCanonicalShipmentStatus = (order = {}) => {
  const explicit = String(order?.shipmentStatus || "").trim().toLowerCase();
  if (explicit) return explicit;

  const legacy = String(order?.shipment_status || "").trim().toLowerCase();
  if (!legacy) return "pending";

  if (legacy === "booked") return "shipment_created";
  if (legacy === "shipped") return "in_transit";
  if (legacy === "delivered") return "delivered";
  if (legacy === "cancelled") return "cancelled";
  if (legacy.startsWith("rto")) return "rto";
  if (legacy === "failed") return "failed";
  return legacy;
};

const calcItemsGross = (order = {}) => {
  const products = Array.isArray(order?.products) ? order.products : [];
  return round2(
    products.reduce((sum, item) => {
      const quantity = Math.max(toSafeNumber(item?.quantity), 0);
      const lineFromSubtotal = toSafeNumber(item?.subTotal);
      const lineFromUnit = toSafeNumber(item?.price) * quantity;
      return sum + (lineFromSubtotal > 0 ? lineFromSubtotal : lineFromUnit);
    }, 0),
  );
};

/**
 * Canonical pricing view for order responses and invoice reconciliation.
 * Keeps backend as the single source of truth for totals.
 */
export const calculateOrderTotal = (order = {}) => {
  const itemsGross = calcItemsGross(order);
  const shipping = Math.max(round2(toSafeNumber(order?.shipping)), 0);
  const tax = Math.max(round2(toSafeNumber(order?.tax)), 0);
  const discount = Math.max(round2(toSafeNumber(order?.discount)), 0);
  const couponDiscount = Math.max(round2(toSafeNumber(order?.discountAmount)), 0);
  const membershipDiscount = Math.max(
    round2(toSafeNumber(order?.membershipDiscount)),
    0,
  );
  const influencerDiscount = Math.max(
    round2(toSafeNumber(order?.influencerDiscount)),
    0,
  );
  const coinRedemptionAmount = Math.max(
    round2(toSafeNumber(order?.coinRedemption?.amount)),
    0,
  );

  const subtotalStored = Math.max(round2(toSafeNumber(order?.subtotal)), 0);
  const totalAmtStored = Math.max(round2(toSafeNumber(order?.totalAmt)), 0);
  const finalAmountStored = Math.max(round2(toSafeNumber(order?.finalAmount)), 0);

  // Prefer explicit final amount, then totalAmt; fallback to computed pieces.
  const total =
    finalAmountStored > 0
      ? finalAmountStored
      : totalAmtStored > 0
        ? totalAmtStored
        : round2(Math.max(itemsGross - discount + shipping, 0));

  // Derive taxable subtotal in a way that always reconciles with total.
  const subtotal =
    subtotalStored > 0
      ? subtotalStored
      : round2(Math.max(total - shipping - tax + coinRedemptionAmount, 0));

  const totalDiscount =
    discount > 0
      ? discount
      : round2(membershipDiscount + influencerDiscount + couponDiscount);

  return {
    itemsGross,
    subtotal,
    taxableAmount: subtotal,
    tax,
    gstAmount: tax,
    shipping,
    total,
    finalAmount: total,
    totalDiscount,
    couponDiscount,
    membershipDiscount,
    influencerDiscount,
    coinRedemptionAmount,
    couponCode: order?.couponCode || null,
    influencerCode: order?.influencerCode || null,
    source: finalAmountStored > 0 ? "finalAmount" : totalAmtStored > 0 ? "totalAmt" : "derived",
  };
};

export const normalizeOrderForResponse = (order) => {
  if (!order) return order;
  const base =
    typeof order.toObject === "function" ? order.toObject() : { ...order };
  const pricing = calculateOrderTotal(base);
  const awbNumber = base.awbNumber || base.awb_number || null;
  const shipmentStatus = toCanonicalShipmentStatus(base);
  const courierName =
    String(base.courierName || "").trim() ||
    (String(base.shipping_provider || "").trim().toUpperCase() === "XPRESSBEES"
      ? "Xpressbees"
      : "");
  const trackingUrl = base.trackingUrl || null;
  const manifestId = base.manifestId || base.shipping_manifest || null;
  const invoiceUrl = base.invoiceUrl || base.invoicePath || null;
  const isInvoiceGenerated = Boolean(base.isInvoiceGenerated || invoiceUrl);
  const deliveryDate = base.deliveryDate || null;

  return {
    ...base,
    pricing,
    displayOrderId: resolveOrderDisplayId(base),
    // Keep legacy consumers stable while normalizing values.
    subtotal: pricing.subtotal,
    tax: pricing.tax,
    shipping: pricing.shipping,
    discount: pricing.totalDiscount,
    finalAmount: pricing.total,
    totalAmt: pricing.total,
    awb_number: awbNumber,
    awbNumber,
    courierName,
    shipment_status: base.shipment_status || "pending",
    shipmentStatus,
    trackingUrl,
    manifestId,
    isInvoiceGenerated,
    invoiceUrl,
    deliveryDate,
  };
};

export default calculateOrderTotal;
