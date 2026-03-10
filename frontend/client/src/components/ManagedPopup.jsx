"use client";

import { API_BASE_URL } from "@/utils/api";
import { stashPendingCouponCode } from "@/utils/couponIntent";
import { getImageUrl } from "@/utils/imageUtils";
import { useCallback, useEffect, useMemo, useState } from "react";
import { MdClose, MdLocalOffer, MdNorthEast } from "react-icons/md";
import styles from "./OfferPopup.module.css";

const API_ROOT = API_BASE_URL.endsWith("/api")
  ? API_BASE_URL
  : `${API_BASE_URL}/api`;
const ACTIVE_POPUP_ENDPOINT = `${API_ROOT}/popup/active`;

const getSessionSeenKey = (popupId) =>
  `hog_managed_popup_seen_${String(popupId || "default").trim()}`;

const getPopupSessionFingerprint = (popup) =>
  [
    popup?.id || "default",
    popup?.title || "",
    popup?.description || "",
    popup?.imageUrl || "",
    popup?.redirectType || "",
    popup?.redirectValue || "",
    popup?.buttonText || "",
    popup?.couponCode || "",
    popup?.startDate || "",
    popup?.expiryDate || "",
  ]
    .map((value) => String(value || "").trim())
    .join("|");

const getSessionSeenValue = (popup) =>
  popup ? getPopupSessionFingerprint(popup) : "";

const normalizeTarget = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^javascript:/i.test(raw)) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  return raw.startsWith("/") ? raw : `/${raw}`;
};

const resolvePopupTarget = (popup) => {
  const redirectType = String(popup?.redirectType || "").trim().toLowerCase();
  const redirectValue = String(popup?.redirectValue || "").trim();

  if (redirectType === "product" && redirectValue) {
    return `/product/${encodeURIComponent(redirectValue)}`;
  }

  if (redirectType === "category" && redirectValue) {
    return `/category/${encodeURIComponent(redirectValue)}`;
  }

  if (redirectType === "custom") {
    return normalizeTarget(redirectValue);
  }

  return "";
};

const normalizeCouponCode = (value) =>
  String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");

const ManagedPopup = () => {
  const [popup, setPopup] = useState(null);
  const [visible, setVisible] = useState(false);

  const targetUrl = useMemo(() => resolvePopupTarget(popup), [popup]);
  const popupCouponCode = useMemo(
    () => normalizeCouponCode(popup?.couponCode),
    [popup?.couponCode],
  );
  const isClickable = Boolean(targetUrl);

  const markSeen = useCallback((nextPopup) => {
    if (typeof window === "undefined") return;
    if (!nextPopup?.showOncePerSession) return;
    sessionStorage.setItem(
      getSessionSeenKey(nextPopup.id),
      getSessionSeenValue(nextPopup),
    );
  }, []);

  const handleDismiss = useCallback(() => {
    if (popup) {
      markSeen(popup);
    }
    setVisible(false);
    setPopup(null);
  }, [markSeen, popup]);

  const handleCta = useCallback(() => {
    if (popupCouponCode) {
      stashPendingCouponCode(popupCouponCode, {
        source: "managed_popup",
        notificationId: popup?.id || "",
      });
    }

    if (!isClickable) {
      handleDismiss();
      return;
    }

    handleDismiss();
    if (typeof window !== "undefined") {
      window.location.assign(targetUrl);
    }
  }, [handleDismiss, isClickable, popup?.id, popupCouponCode, targetUrl]);

  useEffect(() => {
    let disposed = false;
    let showTimer = null;

    const loadActivePopup = async () => {
      try {
        const response = await fetch(ACTIVE_POPUP_ENDPOINT, {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        });
        if (!response.ok) return;

        const payload = await response.json();
        const nextPopup =
          payload?.data && typeof payload.data === "object" ? payload.data : null;
        if (!nextPopup || disposed) return;

        const seenKey = getSessionSeenKey(nextPopup.id);
        const seenValue = getSessionSeenValue(nextPopup);
        const alreadySeen =
          nextPopup.showOncePerSession &&
          typeof window !== "undefined" &&
          sessionStorage.getItem(seenKey) === seenValue;
        if (alreadySeen) return;

        setPopup(nextPopup);
        showTimer = window.setTimeout(() => {
          if (!disposed) {
            setVisible(true);
          }
        }, 1200);
      } catch {
        // Popup is optional; ignore fetch failures.
      }
    };

    void loadActivePopup();

    return () => {
      disposed = true;
      if (showTimer) {
        window.clearTimeout(showTimer);
      }
    };
  }, [markSeen]);

  if (!popup || !visible) return null;

  return (
    <>
      <div
        className={`${styles.backdrop} ${styles.visible}`}
        onClick={handleDismiss}
      />
      <div className={`${styles.wrapper} ${styles.visible}`}>
        <div
          className={`${styles.card} ${isClickable ? styles.cardClickable : ""}`}
          style={{ backgroundColor: popup.backgroundColor || "#f7f1ef" }}
          role={isClickable ? "button" : "dialog"}
          tabIndex={isClickable ? 0 : -1}
          onClick={isClickable ? handleCta : undefined}
          onKeyDown={(event) => {
            if (!isClickable) return;
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              handleCta();
            }
          }}
          aria-label="Promotional popup"
        >
          <button
            type="button"
            className={styles.closeButton}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              handleDismiss();
            }}
            aria-label="Close popup"
          >
            <MdClose size={18} />
          </button>

          <div className={styles.media}>
            {popup.imageUrl ? (
              <img src={getImageUrl(popup.imageUrl, popup.imageUrl)} alt={popup.title} />
            ) : (
              <div className={styles.mediaFallback} />
            )}
            <span className={styles.heroBadge}>
              <MdLocalOffer size={14} />
              Limited Offer
            </span>
            {isClickable && <span className={styles.heroHint}>Tap to open</span>}
          </div>

          <div className={styles.content}>
            <h3 className={styles.title}>{popup.title || "Limited Time Offer"}</h3>
            <p className={styles.description}>
              {popup.description || "Discover our latest products and exclusive offers."}
            </p>
            <div className={styles.metaRow}>
              <span className={styles.metaPill}>Live Campaign</span>
              <span className={styles.metaAction}>
                {isClickable ? "Click to continue" : "Dismiss anytime"}
              </span>
            </div>
            {popupCouponCode ? (
              <p className="mt-2 text-xs font-semibold tracking-wide text-amber-700">
                Coupon: {popupCouponCode}
              </p>
            ) : null}
            <button
              type="button"
              className={styles.ctaButton}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                handleCta();
              }}
            >
              {popup.buttonText || "Shop Now"}
              {isClickable && <MdNorthEast size={16} />}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default ManagedPopup;
