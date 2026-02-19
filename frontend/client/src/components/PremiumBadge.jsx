"use client";

import { FaCrown } from "react-icons/fa";

const PremiumBadge = ({ label = "VIP Members Only", className = "" }) => {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border border-[var(--glass-border)] bg-[image:var(--glass-accent)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white shadow-[var(--glass-shadow)] ${className}`}
    >
      <FaCrown className="text-[9px] text-amber-200" />
      {label}
    </span>
  );
};

export default PremiumBadge;
