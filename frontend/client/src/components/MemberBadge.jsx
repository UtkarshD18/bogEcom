"use client";

import { Crown } from "lucide-react";

const MemberBadge = ({ isMember, className = "" }) => {
  if (!Boolean(isMember)) return null;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border border-[var(--glass-border)] bg-[var(--flavor-glass)] px-2 py-0.5 text-[10px] font-semibold text-[var(--glass-text)] ${className}`}
    >
      <Crown className="h-3 w-3" />
      Member
    </span>
  );
};

export default MemberBadge;
