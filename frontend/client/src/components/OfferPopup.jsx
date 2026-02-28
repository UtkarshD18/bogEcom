"use client";

import { useSettings } from "@/context/SettingsContext";
import { useNotifications } from "@/hooks/useNotifications";
import { useCallback, useEffect, useRef, useState } from "react";
import { MdClose, MdLocalOffer, MdNotifications } from "react-icons/md";

const POPUP_STORAGE_VERSION = "v3";
const POPUP_COOLDOWN_HOURS = 24;

const normalizeCouponCode = (value) => {
  const normalized = String(value || "").trim().toUpperCase();
  return normalized || "GENERIC";
};

const getPopupShownKey = (couponCode) =>
  `welcome_coupon_shown_${POPUP_STORAGE_VERSION}_${normalizeCouponCode(couponCode)}`;
const getPopupDismissedKey = (couponCode) =>
  `offer_popup_dismissed_${POPUP_STORAGE_VERSION}_${normalizeCouponCode(couponCode)}`;

/**
 * OfferPopup Component
 *
 * Shows a promotional popup for guests/users with optional notification opt-in.
 *
 * STABILITY FEATURES:
 * - Uses ref to track initialization (prevents re-triggering on re-render)
 * - Checks localStorage before fetching
 * - Only shows once per session/24-hour period
 *
 * FLOW:
 * 1. Check if popup should show (first visit or new offer)
 * 2. Display offer popup with coupon code
 * 3. Ask for notification permission after user interaction
 * 4. Never auto-request permission on page load
 *
 * @param {Object} props
 * @param {String} props.userId - User ID (null for guests)
 * @param {Boolean} props.isLoggedIn - Whether user is logged in
 */
const OfferPopup = ({ userId = null, isLoggedIn = false }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [offer, setOffer] = useState(null);
  const [showNotificationPrompt, setShowNotificationPrompt] = useState(false);
  const [copied, setCopied] = useState(false);

  const timeoutRef = useRef(null);
  const storageKeysRef = useRef({
    shownKey: getPopupShownKey(""),
    dismissedKey: getPopupDismissedKey(""),
  });

  // Get settings from context
  const {
    showOfferPopup,
    offerCouponCode,
    offerTitle,
    offerDescription,
    offerDiscountText,
    loading: settingsLoading,
  } = useSettings();

  const {
    isSupported,
    isRegistered,
    isRegistering,
    permission,
    requestPermission,
    error: notificationError,
  } = useNotifications({
    userId,
    userType: isLoggedIn ? "user" : "guest",
  });

  // Check and show offer from settings context
  useEffect(() => {
    if (settingsLoading) {
      console.log("[OfferPopup] Settings still loading...");
      return;
    }

    console.log("[OfferPopup] Checking offer settings:", {
      showOfferPopup,
      offerCouponCode,
      offerTitle,
    });

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    if (!(showOfferPopup && offerCouponCode)) {
      console.log("[OfferPopup] Popup not enabled or no coupon code:", {
        showOfferPopup,
        offerCouponCode,
      });
      return;
    }

    const shownKey = getPopupShownKey(offerCouponCode);
    const dismissedKey = getPopupDismissedKey(offerCouponCode);
    storageKeysRef.current = { shownKey, dismissedKey };

    const alreadyShown = sessionStorage.getItem(shownKey);
    if (alreadyShown === "true") {
      console.log("[OfferPopup] Already shown in this session");
      return;
    }

    const dismissedRaw = localStorage.getItem(dismissedKey);
    if (dismissedRaw) {
      const dismissedTime = Number.parseInt(dismissedRaw, 10);
      const hoursSinceDismissed = (Date.now() - dismissedTime) / (1000 * 60 * 60);
      if (
        Number.isFinite(hoursSinceDismissed) &&
        hoursSinceDismissed < POPUP_COOLDOWN_HOURS
      ) {
        console.log(
          "[OfferPopup] Dismissed recently, hours since:",
          hoursSinceDismissed,
        );
        return;
      }
    }

    console.log("[OfferPopup] Showing offer popup with code:", offerCouponCode);
    setOffer({
      couponCode: offerCouponCode,
      title: offerTitle || "Special Offer!",
      description:
        offerDescription || "Use this code to get a discount on your order!",
      discountText: offerDiscountText || "Get Discount",
    });

    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
      sessionStorage.setItem(shownKey, "true");
    }, 3000);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [
    settingsLoading,
    showOfferPopup,
    offerCouponCode,
    offerTitle,
    offerDescription,
    offerDiscountText,
  ]);

  // Copy coupon code to clipboard
  const handleCopyCode = useCallback(() => {
    if (offer?.couponCode) {
      navigator.clipboard.writeText(offer.couponCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [offer]);

  // Handle dismiss
  const handleDismiss = useCallback(() => {
    setIsVisible(false);
    const { shownKey, dismissedKey } = storageKeysRef.current;
    localStorage.setItem(dismissedKey, Date.now().toString());
    sessionStorage.setItem(shownKey, "true");
  }, []);

  // Handle "Get Notified" click
  const handleNotifyClick = useCallback(async () => {
    if (!isSupported) {
      alert("Notifications are not supported in your browser");
      return;
    }

    if (permission === "denied") {
      alert(
        "Notifications are blocked. Please enable them in browser settings.",
      );
      return;
    }

    const success = await requestPermission();
    if (success) {
      setShowNotificationPrompt(false);
      // Show success toast or message
    }
  }, [isSupported, permission, requestPermission]);

  // Show notification prompt after user interacts
  const handleOfferAccept = useCallback(() => {
    handleCopyCode();
    // After copying, ask about notifications
    if (isSupported && !isRegistered && permission !== "denied") {
      setTimeout(() => setShowNotificationPrompt(true), 500);
    }
  }, [handleCopyCode, isSupported, isRegistered, permission]);

  if (!isVisible || !offer) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-[9998] bg-[#130f0a]/65 backdrop-blur-[3px] transition-opacity"
        onClick={handleDismiss}
      />

      <div className="fixed left-1/2 top-1/2 z-[9999] w-[92%] max-w-[460px] -translate-x-1/2 -translate-y-1/2 animate-[offerPopupIn_300ms_cubic-bezier(0.16,1,0.3,1)]">
        <div className="relative overflow-hidden rounded-[28px] border border-[#ead7bd] bg-gradient-to-b from-[#fff9ed] via-[#fffdf8] to-[#fffefb] shadow-[0_35px_80px_-32px_rgba(57,32,10,0.65)]">
          <div className="relative overflow-hidden px-6 pb-5 pt-6 text-white bg-gradient-to-br from-[#3c220e] via-[#6e3f14] to-[#9d6220]">
            <div className="absolute -left-8 -top-10 h-24 w-24 rounded-full bg-white/18 blur-xl" />
            <div className="absolute -right-6 bottom-0 h-20 w-20 rounded-full bg-amber-100/20 blur-lg" />
            <button
              onClick={handleDismiss}
              className="absolute right-4 top-4 rounded-full border border-white/25 bg-white/10 p-1.5 text-white/90 transition hover:bg-white/20"
              aria-label="Close"
            >
              <MdClose size={18} />
            </button>
            <div className="flex items-start gap-3 pr-8">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/18 ring-1 ring-white/30">
                <MdLocalOffer size={24} className="text-white" />
              </div>
              <div className="min-w-0">
                <p className="mb-2 inline-flex rounded-full border border-white/30 bg-white/15 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/90">
                  Limited Time
                </p>
                <h2 className="text-[1.3rem] font-extrabold leading-tight drop-shadow-sm">
                  {offer.title}
                </h2>
                <p className="mt-1 text-sm font-medium text-amber-50/95">
                  {offer.discountText}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4 px-6 pb-4 pt-5">
            <p className="text-[15px] leading-relaxed text-[#5b4636]">
              {offer.description}
            </p>

            <div className="rounded-2xl border border-[#f0ddc3] bg-white p-4 shadow-[0_16px_32px_-24px_rgba(90,52,22,0.75)]">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#a07443]">
                Your Coupon Code
              </p>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <span className="truncate text-[1.85rem] font-black tracking-[0.15em] text-[#603512]">
                  {offer.couponCode}
                </span>
                <button
                  onClick={handleOfferAccept}
                  className={`relative inline-flex h-11 min-w-[130px] items-center justify-center overflow-hidden rounded-xl px-4 text-sm font-bold transition-all duration-200 ${copied
                    ? "border border-[#b7f0cd] bg-gradient-to-br from-[#56bd7c]/75 via-[#3ea969]/72 to-[#2e9258]/78 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_12px_24px_-16px_rgba(27,90,52,0.85)]"
                    : "border border-white/65 bg-gradient-to-br from-white/70 via-[#fff4dd]/55 to-white/45 text-[#4d2e15] backdrop-blur-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.8),inset_0_-1px_0_rgba(255,255,255,0.3),0_12px_24px_-16px_rgba(120,74,10,0.8)] hover:from-white/78 hover:via-[#fff7e8]/62 hover:to-white/55"
                    }`}
                >
                  {copied ? "Copied" : "Copy Code"}
                </button>
              </div>
            </div>

            {showNotificationPrompt && !isRegistered && (
              <div className="rounded-2xl border border-[#c9d9fb] bg-gradient-to-br from-[#eef4ff] to-[#f7faff] p-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg bg-[#d9e7ff]">
                    <MdNotifications size={18} className="text-[#2555b0]" />
                  </div>
                  <div className="flex-1">
                    <p className="mb-1 text-sm font-semibold text-[#223255]">
                      Never miss a deal!
                    </p>
                    <p className="mb-3 text-xs leading-relaxed text-[#435274]">
                      Get notified about exclusive offers and discounts.
                    </p>
                    <button
                      onClick={handleNotifyClick}
                      disabled={isRegistering}
                      className="h-10 w-full rounded-xl bg-[#2e62c9] px-4 text-sm font-semibold text-white transition hover:bg-[#234d9f] disabled:opacity-50"
                    >
                      {isRegistering ? "Enabling..." : "Enable Notifications"}
                    </button>
                    {notificationError && (
                      <p className="text-xs text-red-500 mt-2">
                        {notificationError}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {isRegistered && (
              <div className="flex items-center gap-2 rounded-xl border border-[#c7e8d5] bg-[#ecfbf1] px-3 py-2 text-sm font-medium text-[#1f7a4a]">
                <MdNotifications size={16} />
                <span>You&apos;ll be notified about new offers!</span>
              </div>
            )}
          </div>

          <div className="bg-[#f7f0e1] px-6 pb-5 pt-3">
            <button
              onClick={handleDismiss}
              className="relative h-11 w-full overflow-hidden rounded-xl border border-white/70 bg-gradient-to-br from-white/62 via-[#fff8ef]/45 to-white/32 text-sm font-semibold text-[#5f4328] backdrop-blur-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.85),inset_0_-1px_0_rgba(255,255,255,0.35),0_10px_20px_-16px_rgba(97,63,28,0.75)] transition-all duration-200 hover:from-white/72 hover:via-[#fffaf3]/55 hover:to-white/4"
            >
              Maybe later
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes offerPopupIn {
          from {
            opacity: 0;
            transform: translate(-50%, -46%) scale(0.96);
          }
          to {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1);
          }
        }
      `}</style>
    </>
  );
};

export default OfferPopup;
