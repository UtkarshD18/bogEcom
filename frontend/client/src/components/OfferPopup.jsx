"use client";

import { useSettings } from "@/context/SettingsContext";
import { useNotifications } from "@/hooks/useNotifications";
import { useCallback, useEffect, useRef, useState } from "react";
import { MdClose, MdLocalOffer, MdNotifications } from "react-icons/md";

// Stable key for localStorage - change version to reset for all users
const POPUP_SHOWN_KEY = "welcome_coupon_shown_v2"; // Updated version to reset
const POPUP_DISMISSED_KEY = "offer_popup_dismissed_v2"; // Updated version to reset

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

  // Ref to ensure we only initialize once
  const hasInitialized = useRef(false);
  const timeoutRef = useRef(null);

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
    // Wait for settings to load
    if (settingsLoading) {
      console.log("[OfferPopup] Settings still loading...");
      return;
    }

    // Prevent multiple initializations (handles strict mode double-mount)
    if (hasInitialized.current) {
      console.log("[OfferPopup] Already initialized, skipping...");
      return;
    }
    hasInitialized.current = true;

    console.log("[OfferPopup] Checking offer settings:", {
      showOfferPopup,
      offerCouponCode,
      offerTitle,
    });

    const checkAndShowOffer = () => {
      // Check if popup was already shown in this session
      const alreadyShown = sessionStorage.getItem(POPUP_SHOWN_KEY);
      if (alreadyShown === "true") {
        console.log("[OfferPopup] Already shown in this session");
        return;
      }

      // Check if popup was dismissed recently (24-hour cooldown)
      const lastDismissed = localStorage.getItem(POPUP_DISMISSED_KEY);
      if (lastDismissed) {
        const dismissedTime = parseInt(lastDismissed, 10);
        const hoursSinceDismissed =
          (Date.now() - dismissedTime) / (1000 * 60 * 60);
        // Don't show again for 24 hours
        if (hoursSinceDismissed < 24) {
          console.log(
            "[OfferPopup] Dismissed recently, hours since:",
            hoursSinceDismissed,
          );
          return;
        }
      }

      // Check if offer popup is enabled (from context)
      if (showOfferPopup && offerCouponCode) {
        console.log(
          "[OfferPopup] Showing offer popup with code:",
          offerCouponCode,
        );
        setOffer({
          couponCode: offerCouponCode,
          title: offerTitle || "Special Offer!",
          description:
            offerDescription ||
            "Use this code to get a discount on your order!",
          discountText: offerDiscountText || "Get Discount",
        });

        // Show popup after delay (3-5 seconds for better UX)
        timeoutRef.current = setTimeout(() => {
          setIsVisible(true);
          // Mark as shown for this session
          sessionStorage.setItem(POPUP_SHOWN_KEY, "true");
        }, 3000);
      } else {
        console.log("[OfferPopup] Popup not enabled or no coupon code:", {
          showOfferPopup,
          offerCouponCode,
        });
      }
    };

    checkAndShowOffer();

    // Cleanup timeout on unmount
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
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
    // Store dismissal time for 24-hour cooldown
    localStorage.setItem(POPUP_DISMISSED_KEY, Date.now().toString());
    // Also mark as shown in session to prevent re-showing
    sessionStorage.setItem(POPUP_SHOWN_KEY, "true");
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
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-[9998] transition-opacity"
        onClick={handleDismiss}
      />

      {/* Popup */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[9999] w-[90%] max-w-md">
        <div className="bg-[var(--flavor-card-bg)] rounded-2xl shadow-2xl overflow-hidden border border-primary/20">
          {/* Header */}
          <div className="bg-linear-to-r from-[var(--flavor-light)] to-white px-6 py-4 relative border-b border-primary/20">
            <button
              onClick={handleDismiss}
              className="absolute top-3 right-3 text-primary/70 hover:text-primary transition-colors"
              aria-label="Close"
            >
              <MdClose size={24} />
            </button>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center">
                <MdLocalOffer size={28} className="text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-primary">
                  {offer.title}
                </h2>
                <p className="text-primary/80 text-sm">
                  {offer.discountText}
                </p>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="p-6 bg-linear-to-b from-[var(--flavor-light)] to-white">
            <p className="text-primary/70 mb-4">{offer.description}</p>

            {/* Coupon Code */}
            <div className="bg-white border-2 border-dashed border-primary/40 rounded-lg p-4 mb-4 shadow-sm">
              <p className="text-xs text-primary/80 mb-1">Your coupon code:</p>
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold text-primary tracking-wider">
                  {offer.couponCode}
                </span>
                <button
                  onClick={handleOfferAccept}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${copied
                    ? "bg-primary text-white"
                    : "bg-primary text-white hover:brightness-110 shadow-md"
                    }`}
                >
                  {copied ? "Copied!" : "Copy Code"}
                </button>
              </div>
            </div>

            {/* Notification Prompt */}
            {showNotificationPrompt && !isRegistered && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <div className="flex items-start gap-3">
                  <MdNotifications size={24} className="text-blue-600 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-800 mb-2">
                      Never miss a deal!
                    </p>
                    <p className="text-xs text-gray-600 mb-3">
                      Get notified about exclusive offers and discounts.
                    </p>
                    <button
                      onClick={handleNotifyClick}
                      disabled={isRegistering}
                      className="w-full px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
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

            {/* Already registered message */}
            {isRegistered && (
              <div className="flex items-center gap-2 text-primary text-sm">
                <MdNotifications size={18} />
                <span>You&apos;ll be notified about new offers!</span>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 pb-6 bg-green-50">
            <button
              onClick={handleDismiss}
              className="w-full py-3 text-primary hover:text-primary/80 text-sm transition-colors font-medium"
            >
              Maybe later
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default OfferPopup;
