"use client";

import { MyContext } from "@/context/ThemeContext";
import { postData } from "@/utils/api";
import {
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
} from "@mui/material";
import { useContext, useEffect, useMemo, useState } from "react";
import { FiBell } from "react-icons/fi";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const StockNotificationButton = ({
  productId,
  productName,
  variantId = null,
  variantName = "",
  initialRequested = false,
  className = "",
  compact = false,
  preventNavigation = false,
  disabled = false,
}) => {
  const context = useContext(MyContext);
  const isLoggedIn = Boolean(context?.isLogin);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [requested, setRequested] = useState(Boolean(initialRequested));

  useEffect(() => {
    setRequested(Boolean(initialRequested));
  }, [initialRequested]);

  const helperLabel = useMemo(() => {
    const normalizedVariant = String(variantName || "").trim();
    if (!normalizedVariant) return productName;
    return `${productName} • ${normalizedVariant}`;
  }, [productName, variantName]);

  const stopNavigation = (event) => {
    if (!preventNavigation) return;
    event.stopPropagation();
  };

  const submitRequest = async (emailValue = "") => {
    if (!productId || submitting || disabled) return;

    setSubmitting(true);
    try {
      const response = await postData("/api/notifications/stock", {
        productId,
        variantId,
        ...(emailValue ? { email: emailValue } : {}),
      });

      if (response?.success) {
        setRequested(Boolean(response?.data?.requested));
        setDialogOpen(false);
        setEmail("");
        setEmailError("");
        context?.alertBox(
          "success",
          response?.message || "We’ll notify you when this is back in stock.",
        );
        return;
      }

      context?.alertBox(
        "error",
        response?.message || "Unable to save your notification right now.",
      );
    } catch (error) {
      context?.alertBox(
        "error",
        error?.message || "Unable to save your notification right now.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleButtonClick = async (event) => {
    stopNavigation(event);
    if (requested || disabled || submitting) return;

    if (isLoggedIn) {
      await submitRequest();
      return;
    }

    setDialogOpen(true);
  };

  const handleGuestSubmit = async () => {
    const normalizedEmail = String(email || "")
      .trim()
      .toLowerCase();

    if (!normalizedEmail) {
      setEmailError("Please enter your email address.");
      return;
    }

    if (!EMAIL_REGEX.test(normalizedEmail)) {
      setEmailError("Please enter a valid email address.");
      return;
    }

    await submitRequest(normalizedEmail);
  };

  const buttonCopy = requested
    ? "You’ll be notified"
    : "Notify me when back in stock";

  const classes = compact
    ? "inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition"
    : "inline-flex min-h-[56px] w-full items-center justify-center gap-2 rounded-[18px] px-5 py-4 text-base font-semibold transition";

  const paletteClasses = requested
    ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
    : "border border-[#dbc6b7] bg-white text-[#2c160f] shadow-[0_18px_35px_-26px_rgba(44,22,15,0.45)] hover:-translate-y-0.5 hover:border-[#c9ae9b]";

  return (
    <>
      <button
        type="button"
        onClick={handleButtonClick}
        disabled={disabled || submitting}
        aria-label={buttonCopy}
        className={`${classes} ${paletteClasses} disabled:cursor-not-allowed disabled:opacity-70 ${className}`.trim()}
      >
        {submitting ? (
          <CircularProgress size={18} sx={{ color: "currentColor" }} />
        ) : (
          <FiBell className="text-base" />
        )}
        <span>{buttonCopy}</span>
      </button>

      <Dialog
        open={dialogOpen}
        onClose={() => {
          if (submitting) return;
          setDialogOpen(false);
          setEmailError("");
        }}
        fullWidth
        maxWidth="xs"
        PaperProps={{
          sx: {
            borderRadius: "24px",
            border: "1px solid #ead9cc",
            boxShadow: "0 24px 80px -36px rgba(44, 22, 15, 0.45)",
          },
        }}
      >
        <DialogTitle sx={{ pb: 1.25, fontWeight: 700, color: "#24150f" }}>
          Get a back-in-stock alert
        </DialogTitle>
        <DialogContent sx={{ pt: "4px !important" }}>
          <p className="mb-4 text-sm leading-6 text-[#6b5144]">
            Enter your email and we’ll let you know when{" "}
            <span className="font-semibold text-[#24150f]">{helperLabel}</span>{" "}
            is available again.
          </p>
          <TextField
            autoFocus
            fullWidth
            label="Email address"
            type="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              if (emailError) setEmailError("");
            }}
            error={Boolean(emailError)}
            helperText={emailError || " "}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, pt: 0 }}>
          <button
            type="button"
            onClick={() => {
              if (submitting) return;
              setDialogOpen(false);
              setEmailError("");
            }}
            className="rounded-xl border border-[#e2d3c8] px-4 py-2 text-sm font-semibold text-[#6b5144]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleGuestSubmit}
            disabled={submitting}
            className="rounded-xl bg-[#24150f] px-4 py-2 text-sm font-semibold text-white disabled:opacity-70"
          >
            {submitting ? "Saving..." : "Notify me"}
          </button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default StockNotificationButton;
