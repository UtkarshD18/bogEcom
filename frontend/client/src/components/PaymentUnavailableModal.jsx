"use client";

import { Button } from "@mui/material";
import { MdBugReport, MdClose, MdPayment, MdSave } from "react-icons/md";

/**
 * Payment Unavailable Modal
 *
 * Displays when user clicks "Pay Now" during PhonePe onboarding phase.
 * Provides option to save order for later payment.
 */
const PaymentUnavailableModal = ({
  isOpen,
  onClose,
  onSaveOrder,
  onCreateDemoOrder,
  isSaving = false,
  isCreatingDemoOrder = false,
  showDemoOrderAction = false,
  orderTotal = 0,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in duration-300">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-500 to-orange-600 p-6 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/20 transition-colors"
            aria-label="Close"
          >
            <MdClose size={24} />
          </button>

          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/20 rounded-full">
              <MdPayment size={32} />
            </div>
            <div>
              <h2 className="text-xl font-bold">Payment Unavailable</h2>
              <p className="text-orange-100 text-sm">Temporary maintenance</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-gray-700 text-base leading-relaxed">
              Payments are temporarily unavailable due to high traffic. We are
              currently onboarding <strong>PhonePe</strong> as our payment
              partner.
            </p>
            <p className="text-gray-600 text-sm mt-2">
              Please try again later.
            </p>
          </div>

          {/* Order Summary */}
          {orderTotal > 0 && (
            <div className="bg-gray-50 rounded-xl p-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Order Total</span>
                <span className="text-xl font-bold text-gray-900">
                  ₹{orderTotal.toFixed(2)}
                </span>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="space-y-3 pt-2">
            <Button
              onClick={onSaveOrder}
              disabled={isSaving}
              fullWidth
              sx={{
                backgroundColor: "var(--primary)",
                color: "white",
                padding: "14px 24px",
                borderRadius: "12px",
                fontWeight: 600,
                fontSize: "16px",
                textTransform: "none",
                "&:hover": {
                  backgroundColor: "#047857",
                },
                "&:disabled": {
                  backgroundColor: "#ccc",
                  color: "#666",
                },
              }}
            >
              {isSaving ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin">⏳</span>
                  Saving Order...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <MdSave size={20} />
                  Save Order for Later
                </span>
              )}
            </Button>

            {showDemoOrderAction && typeof onCreateDemoOrder === "function" && (
              <Button
                onClick={onCreateDemoOrder}
                disabled={isCreatingDemoOrder}
                fullWidth
                variant="outlined"
                sx={{
                  borderColor: "#f59e0b",
                  color: "#b45309",
                  padding: "14px 24px",
                  borderRadius: "12px",
                  fontWeight: 600,
                  fontSize: "15px",
                  textTransform: "none",
                  "&:hover": {
                    borderColor: "#d97706",
                    backgroundColor: "#fff7ed",
                  },
                  "&:disabled": {
                    borderColor: "#fde68a",
                    color: "#92400e",
                  },
                }}
              >
                {isCreatingDemoOrder ? (
                  <span className="flex items-center gap-2">
                    <span className="animate-spin">⏳</span>
                    Creating Demo Influencer Order...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <MdBugReport size={20} />
                    Demo Influencer Order (No Shipping)
                  </span>
                )}
              </Button>
            )}

            <Button
              onClick={onClose}
              fullWidth
              variant="outlined"
              sx={{
                borderColor: "#e5e7eb",
                color: "#6b7280",
                padding: "14px 24px",
                borderRadius: "12px",
                fontWeight: 500,
                fontSize: "16px",
                textTransform: "none",
                "&:hover": {
                  borderColor: "#d1d5db",
                  backgroundColor: "#f9fafb",
                },
              }}
            >
              Close
            </Button>
          </div>

          {/* Info Text */}
          <p className="text-xs text-gray-500 text-center pt-2">
            Your order will be saved but not confirmed. Complete payment once
            payments are enabled.
          </p>
        </div>
      </div>
    </div>
  );
};

export default PaymentUnavailableModal;
