"use client";

import { useCallback, useEffect, useState } from "react";

const COIN_REWARD_KEY = "coinRewardAnimation";
const COIN_REWARD_SHOWN_PREFIX = "coinRewardShown:";

const parseRewardPayload = (value) => {
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    if (!parsed) return null;
    const orderId = String(parsed.orderId || "").trim();
    const coins = Math.max(Math.floor(Number(parsed.coins || 0)), 0);
    if (!orderId || coins <= 0) return null;
    return { orderId, coins };
  } catch {
    return null;
  }
};

const getVisibleCoinTarget = () => {
  if (typeof window === "undefined") return null;
  const desktop = document.getElementById("coin-balance-anchor");
  const mobile = document.getElementById("coin-balance-anchor-mobile");
  const candidates = [desktop, mobile].filter(Boolean);

  const visible = candidates.find((el) => {
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  });

  return visible || desktop || mobile || null;
};

const buildParticles = ({ targetX, targetY }) => {
  const startX = window.innerWidth * 0.5;
  const startY = Math.max(window.innerHeight * 0.25, 120);

  return Array.from({ length: 14 }).map((_, index) => {
    const spread = (Math.random() - 0.5) * 150;
    const lift = (Math.random() - 0.5) * 80;
    return {
      id: `${Date.now()}-${index}`,
      startX: startX + (Math.random() - 0.5) * 90,
      startY: startY + (Math.random() - 0.5) * 60,
      dx: targetX - startX + spread,
      dy: targetY - startY + lift,
      delay: Math.floor(Math.random() * 180),
    };
  });
};

const CoinRewardLayer = () => {
  const [toast, setToast] = useState(null);
  const [burst, setBurst] = useState(null);

  const playRewardAnimation = useCallback((payload) => {
    const parsed = parseRewardPayload(payload);
    if (!parsed || typeof window === "undefined") return;

    const shownKey = `${COIN_REWARD_SHOWN_PREFIX}${parsed.orderId}`;
    if (window.localStorage.getItem(shownKey) === "1") {
      window.localStorage.removeItem(COIN_REWARD_KEY);
      return;
    }

    const targetElement = getVisibleCoinTarget();
    if (!targetElement) return;

    const targetRect = targetElement.getBoundingClientRect();
    const targetX = targetRect.left + targetRect.width / 2;
    const targetY = targetRect.top + targetRect.height / 2;

    setToast({ coins: parsed.coins });
    setBurst({
      id: `${Date.now()}-${parsed.orderId}`,
      active: false,
      particles: buildParticles({ targetX, targetY }),
    });

    window.localStorage.removeItem(COIN_REWARD_KEY);

    requestAnimationFrame(() => {
      setBurst((prev) => (prev ? { ...prev, active: true } : prev));
    });

    window.setTimeout(() => {
      window.localStorage.setItem(shownKey, "1");
      window.dispatchEvent(
        new CustomEvent("coinBalanceRefresh", {
          detail: {
            source: "reward_animation",
            orderId: parsed.orderId,
            coins: parsed.coins,
          },
        }),
      );
      setBurst(null);
    }, 1200);

    window.setTimeout(() => {
      setToast(null);
    }, 1900);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const customHandler = (event) => {
      playRewardAnimation(event?.detail || null);
    };
    const storageHandler = (event) => {
      if (event.key !== COIN_REWARD_KEY || !event.newValue) return;
      playRewardAnimation(event.newValue);
    };

    window.addEventListener("coinRewardAnimation", customHandler);
    window.addEventListener("storage", storageHandler);

    const existing = window.localStorage.getItem(COIN_REWARD_KEY);
    if (existing) {
      playRewardAnimation(existing);
    }

    return () => {
      window.removeEventListener("coinRewardAnimation", customHandler);
      window.removeEventListener("storage", storageHandler);
    };
  }, [playRewardAnimation]);

  return (
    <>
      {toast && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[130] pointer-events-none">
          <div className="rounded-full px-4 py-2 text-sm font-semibold text-white shadow-lg bg-emerald-600/95 animate-[coinToastUp_1.6s_ease-out_forwards]">
            +{toast.coins} Coins Earned ??
          </div>
        </div>
      )}

      {burst?.particles?.map((particle) => (
        <span
          key={particle.id}
          className="fixed z-[129] pointer-events-none select-none text-lg"
          style={{
            left: particle.startX,
            top: particle.startY,
            opacity: burst.active ? 0 : 1,
            transform: burst.active
              ? `translate(${particle.dx}px, ${particle.dy}px) scale(0.35)`
              : "translate(0px, 0px) scale(1)",
            transition: `transform 920ms cubic-bezier(0.19, 1, 0.22, 1) ${particle.delay}ms, opacity 920ms ease ${particle.delay}ms`,
          }}
        >
          ??
        </span>
      ))}

      <style jsx>{`
        @keyframes coinToastUp {
          0% {
            transform: translate(-50%, 10px);
            opacity: 0;
          }
          15% {
            transform: translate(-50%, 0px);
            opacity: 1;
          }
          85% {
            transform: translate(-50%, -2px);
            opacity: 1;
          }
          100% {
            transform: translate(-50%, -18px);
            opacity: 0;
          }
        }
      `}</style>
    </>
  );
};

export default CoinRewardLayer;
