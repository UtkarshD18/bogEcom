"use client";

import { Crown, Lock } from "lucide-react";

const VIPGlassOverlay = ({ isMember, children, overlayRadiusClass = "rounded-3xl" }) => {
  if (!!isMember) {
    return <>{children}</>;
  }

  return (
    <div className="group relative">
      <div className="pointer-events-none select-none blur-[2px]">{children}</div>

      {/* Glow overlay on hover */}
      <div
        className={`pointer-events-none absolute inset-0 ${overlayRadiusClass} bg-gradient-to-br from-purple-300/20 via-pink-300/10 to-indigo-300/20 opacity-0 transition-opacity duration-500 group-hover:opacity-100`}
      />

      {/* Glass card overlay */}
      <div
        className={`absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 border border-purple-300/30 bg-white/30 backdrop-blur-xl ${overlayRadiusClass}`}
      >
        <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-purple-400 to-pink-400 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white shadow-lg">
          <Crown className="h-3 w-3" />
          VIP Members Only
        </span>
        <Lock className="h-6 w-6 text-purple-400/80" />
        <p className="text-sm font-bold text-purple-900/80">
          Members Get First Access
        </p>
        <p className="text-xs font-semibold text-purple-700/70">
          🔒 Reveal VIP Price
        </p>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-purple-500/60">
          Upgrade to Claim This Drop
        </p>
      </div>
    </div>
  );
};

export default VIPGlassOverlay;
