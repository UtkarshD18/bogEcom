"use client";

import { FaCrown } from "react-icons/fa";

const PremiumBadge = ({ label = "VIP Members Only", className = "" }) => {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border border-white/40 bg-gradient-to-r from-indigo-600 via-fuchsia-600 to-sky-500 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white shadow-lg shadow-indigo-500/30 ${className}`}
    >
      <FaCrown className="text-[9px] text-amber-200" />
      {label}
    </span>
  );
};

export default PremiumBadge;
