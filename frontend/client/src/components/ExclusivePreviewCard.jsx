"use client";

import LockOverlay from "@/components/LockOverlay";
import PremiumBadge from "@/components/PremiumBadge";
import { getImageUrl } from "@/utils/imageUtils";
import { HiArrowUpRight } from "react-icons/hi2";

const formatPrice = (value) => {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return "₹ --";
  return `₹ ${amount.toLocaleString("en-IN")}`;
};

const ExclusivePreviewCard = ({
  product,
  isLocked = true,
  onClick,
  animationDelayMs = 0,
}) => {
  const imageSrc = getImageUrl(
    product?.images?.[0] || product?.thumbnail || product?.image,
    "/product_placeholder.png",
  );

  return (
    <article
      className={`group relative transition-all duration-300 ease-out ${
        isLocked
          ? "pointer-events-none"
          : "cursor-pointer hover:-translate-y-1 hover:scale-[1.035] hover:shadow-[0_20px_60px_rgba(124,58,237,0.22)]"
      }`}
      style={{ transitionDelay: `${animationDelayMs}ms` }}
      onClick={isLocked ? undefined : onClick}
    >
      {/* Premium gradient edge + glow for conversion-focused visual hierarchy */}
      <div
        className="absolute -inset-[1px] rounded-3xl bg-gradient-to-br from-[#ede6ff] via-[#f0eaff] to-[#e8e0ff]"
      />
      <div
        className="premium-glow absolute -inset-3 rounded-[30px] bg-gradient-to-br from-[#e8deff]/20 via-[#f0d6ff]/10 to-[#ddd6ff]/20 blur-2xl opacity-40 transition-opacity duration-500 group-hover:opacity-60"
      />

      <div className="relative overflow-hidden rounded-2xl border border-[#e9e3ff] bg-gradient-to-br from-white/80 via-[#f6f3ff] to-[#efe9ff] shadow-[0_10px_30px_rgba(124,58,237,0.12)] backdrop-blur-xl ring-1 ring-white/30 transition-all duration-300 ease-out group-hover:shadow-[0_20px_60px_rgba(124,58,237,0.22)]">
        <div className="absolute inset-0 bg-gradient-to-br from-white/65 to-slate-100/40" />

        {/* Product details are blurred for non-members and fully interactive for members */}
        <div
          className={`relative transition-all duration-500 ${
            isLocked ? "blur-sm" : "blur-0"
          }`}
        >
          <div className="relative aspect-[4/3] overflow-hidden rounded-t-[22px] bg-white/70">
            <img
              src={imageSrc}
              alt={product?.name || "Members only product"}
              className="h-full w-full object-contain p-5 transition-transform duration-500 group-hover:scale-105"
            />
            <div className="absolute left-3 top-3">
              <PremiumBadge />
            </div>
          </div>

          <div className="px-4 pb-4 pt-3">
            <h3 className="line-clamp-2 min-h-[44px] text-sm font-extrabold text-[var(--glass-text)]">
              {product?.name || "Exclusive Product"}
            </h3>
            <p className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--glass-text)]/70">
              {product?.brand || "Members Collection"}
            </p>

            <div className="mt-3 flex items-end justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--glass-text)]/70">
                  {isLocked ? "Hidden VIP Deal" : "Members Price"}
                </p>
                <p className="text-lg font-black text-[var(--glass-text)]">
                  {isLocked ? "🔒 VIP Price" : formatPrice(product?.price)}
                </p>
              </div>

              {!isLocked ? (
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--glass-border)] bg-[var(--glass-bg)] text-[var(--glass-text)] shadow-[var(--glass-shadow)]">
                  <HiArrowUpRight className="text-lg" />
                </span>
              ) : null}
            </div>
          </div>
        </div>

        {isLocked ? <LockOverlay /> : null}
      </div>

      <style jsx>{`
        .premium-glow {
          animation: premiumGlow 4s ease-in-out infinite;
        }
        @keyframes premiumGlow {
          0%,
          100% {
            opacity: 0.45;
            transform: scale(0.98);
          }
          50% {
            opacity: 0.85;
            transform: scale(1.02);
          }
        }
      `}</style>
    </article>
  );
};

export default ExclusivePreviewCard;
