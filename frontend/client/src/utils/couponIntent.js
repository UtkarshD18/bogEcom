export const PENDING_COUPON_STORAGE_KEY = "bog_pending_coupon_code";

const normalizeCouponCode = (value) =>
  String(value || "")
    .trim()
    .toUpperCase();

export const stashPendingCouponCode = (couponCode, meta = {}) => {
  if (typeof window === "undefined") return false;

  const code = normalizeCouponCode(couponCode);
  if (!code) return false;

  const payload = {
    code,
    savedAt: Date.now(),
    source: String(meta.source || "notification"),
    notificationId: String(meta.notificationId || ""),
  };

  try {
    window.localStorage.setItem(
      PENDING_COUPON_STORAGE_KEY,
      JSON.stringify(payload),
    );
    return true;
  } catch {
    return false;
  }
};

export const readPendingCouponCode = () => {
  if (typeof window === "undefined") return "";

  try {
    const raw = window.localStorage.getItem(PENDING_COUPON_STORAGE_KEY);
    if (!raw) return "";

    // Backward compatible parsing in case raw text code was stored.
    if (!raw.startsWith("{")) {
      return normalizeCouponCode(raw);
    }

    const parsed = JSON.parse(raw);
    return normalizeCouponCode(parsed?.code || "");
  } catch {
    return "";
  }
};

export const clearPendingCouponCode = () => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(PENDING_COUPON_STORAGE_KEY);
  } catch {
    // Ignore storage failures.
  }
};

