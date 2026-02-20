"use client";

import { FaCrown } from "react-icons/fa";

const PremiumBadge = ({ label = "VIP Members Only", className = "" }) => {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[#6d5dfc] via-[#8b5cf6] to-[#ec4899] px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide text-white shadow-[0_4px_12px_rgba(168,85,247,0.35)] ${className}`}
    >
      <FaCrown className="text-[9px] text-amber-200" />
      {label}
    </span>
  );
};

export default PremiumBadge;
