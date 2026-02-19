"use client";

import PremiumBadge from "@/components/PremiumBadge";
import { HiLockClosed } from "react-icons/hi2";

const LockOverlay = () => {
  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden rounded-[22px]">
      {/* Glass + gradient layers to create a premium locked-state effect */}
      <div className="absolute inset-0 bg-white/20 backdrop-blur-md" />
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/45 via-fuchsia-800/25 to-sky-900/35" />

      {/* Moving shimmer amplifies curiosity for conversion */}
      <div className="lock-shimmer absolute inset-y-0 -left-1/2 w-1/2" />

      <div className="relative z-10 flex h-full flex-col items-center justify-center gap-2 px-4 text-center">
        <PremiumBadge />
        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/40 bg-white/25">
          <HiLockClosed className="text-xl text-white" />
        </div>
        <p className="text-sm font-extrabold text-white">Members Get First Access</p>
        <p className="text-lg font-black text-white/95">🔓 Reveal VIP Price</p>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-white/85">
          Upgrade To Claim This Drop
        </p>
      </div>

      <style jsx>{`
        .lock-shimmer {
          background: linear-gradient(
            110deg,
            transparent 0%,
            rgba(255, 255, 255, 0.52) 45%,
            transparent 100%
          );
          filter: blur(2px);
          animation: lockSlide 2.8s linear infinite;
          opacity: 0.8;
        }
        @keyframes lockSlide {
          0% {
            transform: translateX(0%);
          }
          100% {
            transform: translateX(320%);
          }
        }
      `}</style>
    </div>
  );
};

export default LockOverlay;
