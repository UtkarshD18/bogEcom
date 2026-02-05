"use client";

import { useEffect, useState } from "react";
import {
  MdClose,
  MdLocalOffer,
  MdLocalShipping,
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
const NotificationToast = ({ message, onDismiss, duration = 5000 }) => {
  const [isVisible, setIsVisible] = useState(false);

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

  const handleClick = () => {
    if (message?.data?.url) {
      window.location.href = message.data.url;
    }
    handleDismiss();
  };

  if (!message || !isVisible) return null;

  const isOffer = message.data?.type === "offer";
  const isOrder = message.data?.type === "order_update";

  const Icon = isOffer
    ? MdLocalOffer
    : isOrder
      ? MdLocalShipping
      : MdNotifications;
  const bgColor = isOffer
    ? "from-orange-500 to-orange-600"
    : isOrder
      ? "from-blue-500 to-blue-600"
      : "from-gray-600 to-gray-700";

  return (
    <div
      className={`fixed top-4 right-4 z-[10000] max-w-sm w-full transition-all duration-300 ${
        isVisible ? "translate-x-0 opacity-100" : "translate-x-full opacity-0"
      }`}
    >
      <div
        onClick={handleClick}
        className={`bg-gradient-to-r ${bgColor} rounded-lg shadow-lg cursor-pointer overflow-hidden`}
      >
        <div className="p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
              <Icon size={24} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <h4 className="text-white font-semibold text-sm truncate">
                  {message.title}
                </h4>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDismiss();
                  }}
                  className="text-white/60 hover:text-white transition-colors flex-shrink-0"
                >
                  <MdClose size={18} />
                </button>
              </div>
              <p className="text-white/80 text-xs mt-1 line-clamp-2">
                {message.body}
              </p>
              {isOffer && message.data?.couponCode && (
                <div className="mt-2 px-2 py-1 bg-white/20 rounded text-white text-xs font-mono inline-block">
                  {message.data.couponCode}
                </div>
              )}
            </div>
          </div>
        </div>
        {/* Progress bar for auto-dismiss */}
        {duration > 0 && (
          <div className="h-1 bg-white/20">
            <div
              className="h-full bg-white/50 animate-shrink"
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
