"use client";

import { useSettings } from "@/context/SettingsContext";
import { useMemo } from "react";
import { FaWhatsapp } from "react-icons/fa";

const normalizePhoneForWhatsapp = (value = "") =>
  String(value || "")
    .replace(/[^\d]/g, "")
    .replace(/^0+/, "");

export default function WhatsAppFloatingButton() {
  const { storeInfo } = useSettings();
  const phone = normalizePhoneForWhatsapp(storeInfo?.whatsapp || storeInfo?.phone);

  const href = useMemo(() => {
    if (!phone) return "";
    const message = encodeURIComponent(
      "Hi Healthy One Gram, I need help with products or my order.",
    );
    return `https://wa.me/${phone}?text=${message}`;
  }, [phone]);

  if (!href) return null;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with us on WhatsApp"
      className="fixed bottom-5 right-4 z-[1200] inline-flex h-14 w-14 items-center justify-center rounded-full bg-[#16a34a] text-white shadow-[0_18px_45px_-22px_rgba(22,163,74,0.9)] ring-4 ring-white/80 transition hover:-translate-y-0.5 hover:bg-[#128c3f] sm:bottom-6 sm:right-6 sm:h-16 sm:w-16"
    >
      <FaWhatsapp className="text-3xl sm:text-4xl" />
      <span className="absolute right-12 top-1/2 hidden -translate-y-1/2 whitespace-nowrap rounded-full bg-[#18301f] px-3 py-1.5 text-xs font-bold text-white shadow-lg sm:block">
        Chat on WhatsApp
      </span>
    </a>
  );
}
