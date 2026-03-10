"use client";

import { useEffect, useState } from "react";
import { stashPendingCouponCode } from "@/utils/couponIntent";
import {
  MdClose,
  MdLocalOffer,
  MdLocalShipping,
  MdNorthEast,
  MdNotifications,
} from "react-icons/md";

/**
 * NotificationToast Component
 *
 * Displays foreground push notifications as a toast.
 *
 * @param {Object} props
 * @param {Object} props.message - The notification message object
 * @param {Function} props.onDismiss - Callback when toast is dismissed
 * @param {Number} props.duration - Auto-dismiss duration (ms), 0 to disable
 */
const NotificationToast = ({ message, onDismiss, duration = 7000 }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [couponCopied, setCouponCopied] = useState(false);

  useEffect(() => {
    if (message) {
      setIsVisible(true);

      if (duration > 0) {
        const timer = setTimeout(() => {
          handleDismiss();
        }, duration);

        return () => clearTimeout(timer);
      }
    }
  }, [message, duration]);

  const handleDismiss = () => {
    setIsVisible(false);
    setTimeout(() => onDismiss?.(), 300);
  };

  const normalizeTarget = (value, fallback = "") => {
    const raw = String(value || "").trim();
    if (!raw) return fallback;
    if (/^javascript:/i.test(raw)) return fallback;
    if (/^https?:\/\//i.test(raw)) return raw;
    return raw.startsWith("/") ? raw : `/${raw}`;
  };

  const resolveOpenTarget = () => {
    const explicitTarget = normalizeTarget(message?.data?.url, "");
    if (explicitTarget) {
      return { explicitTarget, resolvedTarget: explicitTarget };
    }

    const type = String(message?.data?.type || "").trim().toLowerCase();
    if (type === "order_update") {
      const orderId = String(message?.data?.orderId || "").trim();
      if (orderId) {
        return {
          explicitTarget: "",
          resolvedTarget: `/orders/${encodeURIComponent(orderId)}`,
        };
      }
    }

    if (type === "offer") {
      return { explicitTarget: "", resolvedTarget: "/products" };
    }

    return { explicitTarget: "", resolvedTarget: "/" };
  };

  const openTarget = (target) => {
    const normalized = normalizeTarget(target, "");
    if (!normalized) return false;

    if (typeof window !== "undefined") {
      window.location.assign(normalized);
      return true;
    }

    return false;
  };

  const copyText = async (text) => {
    const safeText = String(text || "").trim();
    if (!safeText) return false;

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(safeText);
        return true;
      }
    } catch {
      // Fall back to document.execCommand below.
    }

    try {
      const textArea = document.createElement("textarea");
      textArea.value = safeText;
      textArea.setAttribute("readonly", "");
      textArea.style.position = "absolute";
      textArea.style.left = "-9999px";
      document.body.appendChild(textArea);
      textArea.select();
      const copied = document.execCommand("copy");
      document.body.removeChild(textArea);
      return copied;
    } catch {
      return false;
    }
  };

  const handleClick = () => {
    const { explicitTarget } = resolveOpenTarget();
    if (explicitTarget) {
      openTarget(explicitTarget);
    }
    handleDismiss();
  };

  const handleCouponClick = async (event) => {
    event.preventDefault();
    event.stopPropagation();

    const couponCode = String(message?.data?.couponCode || "").trim();
    if (!couponCode) return;

    const copied = await copyText(couponCode);
    if (copied) {
      setCouponCopied(true);
      window.setTimeout(() => setCouponCopied(false), 1500);
    }

    stashPendingCouponCode(couponCode, {
      source: "notification_toast",
      notificationId: message?.data?.notificationId || "",
    });
  };

  const handleOpenClick = (event) => {
    event.preventDefault();
    event.stopPropagation();

    if (isOffer && message?.data?.couponCode) {
      stashPendingCouponCode(message.data.couponCode, {
        source: "notification_toast_open",
        notificationId: message?.data?.notificationId || "",
      });
    }

    const { resolvedTarget } = resolveOpenTarget();
    openTarget(resolvedTarget);
    handleDismiss();
  };

  if (!message || !isVisible) return null;

  const isOffer = message.data?.type === "offer";
  const isOrder = message.data?.type === "order_update";
  const { explicitTarget, resolvedTarget } = resolveOpenTarget();
  const hasTargetUrl = Boolean(explicitTarget);
  const hasOpenAction = Boolean(resolvedTarget);
  const hasCouponCode = Boolean(String(message?.data?.couponCode || "").trim());

  const Icon = isOffer
    ? MdLocalOffer
    : isOrder
      ? MdLocalShipping
      : MdNotifications;
  const theme = isOffer
    ? {
        accentText: "text-[#8a4b10]",
        iconBg: "bg-gradient-to-br from-[#ffedd5] to-[#fed7aa]",
        iconColor: "text-[#a84f14]",
        titleTone: "text-[#3f220b]",
        bodyTone: "text-[#6c4b2d]",
        card:
          "border-[#f3d4b2] bg-gradient-to-br from-[#fff7ec]/95 via-[#fffdf8]/92 to-[#fff6e8]/95",
        glow: "from-[#ffd8aa]/55 to-[#ffedd5]/30",
        progressTrack: "bg-[#f4d3ab]/55",
        progressFill: "bg-gradient-to-r from-[#f59e0b] to-[#ea580c]",
        chip: "bg-[#fff4e2] text-[#96561c] border-[#f0d3ac]",
      }
    : isOrder
      ? {
          accentText: "text-[#1d4ed8]/80",
          iconBg: "bg-gradient-to-br from-[#dbeafe] to-[#bfdbfe]",
          iconColor: "text-[#1d4ed8]",
          titleTone: "text-[#0f275f]",
          bodyTone: "text-[#334a7d]",
          card:
            "border-[#c8ddff] bg-gradient-to-br from-[#f1f7ff]/95 via-[#f9fbff]/92 to-[#eef5ff]/95",
          glow: "from-[#bfdbfe]/55 to-[#dbeafe]/28",
          progressTrack: "bg-[#bad5ff]/55",
          progressFill: "bg-gradient-to-r from-[#3b82f6] to-[#2563eb]",
          chip: "bg-[#eaf2ff] text-[#2a4f9d] border-[#c7ddff]",
        }
      : {
          accentText: "text-[#334155]/80",
          iconBg: "bg-gradient-to-br from-[#e2e8f0] to-[#cbd5e1]",
          iconColor: "text-[#334155]",
          titleTone: "text-[#1e293b]",
          bodyTone: "text-[#475569]",
          card:
            "border-[#dbe2ea] bg-gradient-to-br from-[#f8fafc]/95 via-[#ffffff]/92 to-[#f1f5f9]/95",
          glow: "from-[#dbe2ea]/55 to-[#f1f5f9]/30",
          progressTrack: "bg-[#dbe2ea]/60",
          progressFill: "bg-gradient-to-r from-[#64748b] to-[#475569]",
          chip: "bg-[#f1f5f9] text-[#334155] border-[#dbe2ea]",
        };
  const categoryLabel = isOffer
    ? "Special Offer"
    : isOrder
      ? "Order Update"
      : "Notification";

  return (
    <div
      className={`fixed right-3 top-3 sm:right-4 sm:top-4 z-[10000] w-[calc(100vw-1.5rem)] max-w-[380px] transition-all duration-300 ${
        isVisible
          ? "translate-x-0 opacity-100 scale-100"
          : "translate-x-6 opacity-0 scale-[0.98]"
      }`}
    >
      <div
        onClick={handleClick}
        role={hasTargetUrl ? "button" : "status"}
        tabIndex={hasTargetUrl ? 0 : -1}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            handleClick();
          }
        }}
        className={`group relative overflow-hidden rounded-2xl border backdrop-blur-xl shadow-[0_20px_40px_-24px_rgba(17,24,39,0.55)] transition-all duration-200 ${
          hasTargetUrl ? "cursor-pointer" : "cursor-default"
        } ${theme.card}`}
      >
        <div
          className={`pointer-events-none absolute -right-10 -top-12 h-32 w-32 rounded-full bg-gradient-to-br blur-2xl ${theme.glow}`}
        />
        <div className="relative p-4">
          <div className="flex items-start gap-3.5">
            <div
              className={`w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 border border-white/60 shadow-sm ${theme.iconBg}`}
            >
              <Icon size={22} className={theme.iconColor} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p
                    className={`text-[10px] font-semibold uppercase tracking-[0.16em] ${theme.accentText}`}
                  >
                    {categoryLabel}
                  </p>
                  <h4 className={`font-extrabold text-sm leading-5 truncate ${theme.titleTone}`}>
                    {message.title}
                  </h4>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDismiss();
                  }}
                  className="text-[#8b98ad] hover:text-[#4b5563] transition-colors flex-shrink-0 rounded-full p-0.5"
                  aria-label="Dismiss notification"
                >
                  <MdClose size={18} />
                </button>
              </div>
              <p className={`text-xs mt-1.5 leading-relaxed line-clamp-2 ${theme.bodyTone}`}>
                {message.body}
              </p>
              <div className="mt-3 flex items-center gap-2 flex-wrap">
                {isOffer && hasCouponCode && (
                  <button
                    type="button"
                    onClick={handleCouponClick}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${theme.chip}`}
                  >
                    {couponCopied
                      ? "Copied"
                      : `Coupon: ${String(message.data.couponCode).trim().toUpperCase()}`}
                  </button>
                )}
                {hasOpenAction && (
                  <button
                    type="button"
                    onClick={handleOpenClick}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${theme.chip}`}
                  >
                    Open
                    <MdNorthEast size={14} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
        {duration > 0 && (
          <div className={`h-1 ${theme.progressTrack}`}>
            <div
              className={`h-full ${theme.progressFill} animate-shrink`}
              style={{
                animationDuration: `${duration}ms`,
              }}
            />
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes shrink {
          from {
            width: 100%;
          }
          to {
            width: 0%;
          }
        }
        .animate-shrink {
          animation: shrink linear forwards;
        }
      `}</style>
    </div>
  );
};

export default NotificationToast;
