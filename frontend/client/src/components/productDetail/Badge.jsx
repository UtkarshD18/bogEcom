"use client";

import { HiOutlineFire } from "react-icons/hi";

const Badge = ({
  type = "available",
  label = "",
  value = 0,
}) => {
  if (type === "bestSellerRibbon") {
    return (
      <span className="absolute -left-8 top-4 z-20 -rotate-45 bg-red-600 px-8 py-1 text-[9px] font-extrabold tracking-[0.2em] text-white shadow-md">
        BEST SELLER
      </span>
    );
  }

  if (type === "discount") {
    return (
      <span className="absolute top-4 left-4 bg-red-500 text-white text-sm font-bold px-3 py-1 rounded-full z-10">
        {Math.max(Number(value || 0), 0)}% OFF
      </span>
    );
  }

  if (type === "highDemand") {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold bg-red-100 text-red-600">
        <HiOutlineFire className="w-4 h-4" />
        {label || "High Demand"}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold bg-[var(--flavor-glass)] text-primary">
      <span className="w-2 h-2 bg-primary rounded-full"></span>
      {label || "Available"}
    </span>
  );
};

export default Badge;