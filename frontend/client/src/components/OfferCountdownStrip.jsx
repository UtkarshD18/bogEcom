"use client";

import { useSettings } from "@/context/SettingsContext";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { FiClock, FiTag } from "react-icons/fi";

const getTimeParts = (endsAt) => {
  const end = new Date(endsAt).getTime();
  const remaining = end - Date.now();
  if (!Number.isFinite(end) || remaining <= 0) {
    return null;
  }

  const totalSeconds = Math.floor(remaining / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return { days, hours, minutes, seconds };
};

const pad = (value) => String(Math.max(Number(value || 0), 0)).padStart(2, "0");

export default function OfferCountdownStrip() {
  const { settings } = useSettings();
  const config = settings?.offerCountdownSettings || {};
  const [parts, setParts] = useState(null);

  useEffect(() => {
    setParts(getTimeParts(config.endsAt));
    if (!config?.enabled || !config?.endsAt) return undefined;

    const timer = window.setInterval(() => {
      setParts(getTimeParts(config.endsAt));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [config?.enabled, config?.endsAt]);

  const isVisible = useMemo(
    () => Boolean(config?.enabled && config?.endsAt && parts),
    [config?.enabled, config?.endsAt, parts],
  );

  if (!isVisible) return null;

  const title = String(config.title || "Limited time offer").trim();
  const subtitle = String(config.subtitle || "Fresh deals are live now.").trim();
  const discountText = String(config.discountText || "").trim();
  const couponCode = String(config.couponCode || "").trim().toUpperCase();
  const ctaLabel = String(config.ctaLabel || "Shop offers").trim();
  const ctaHref = String(config.ctaHref || "/products").trim() || "/products";

  return (
    <section className="bg-[#24160f] px-4 py-4 text-white">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 rounded-[24px] border border-white/10 bg-[linear-gradient(135deg,#3a2115_0%,#6b4327_58%,#94611e_100%)] px-5 py-4 shadow-[0_24px_70px_-48px_rgba(40,20,8,0.75)] sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/14">
            <FiClock />
          </span>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#ffe2b0]">
              {discountText || "Offer ends soon"}
            </p>
            <h2 className="mt-1 text-xl font-black leading-tight sm:text-2xl">
              {title}
            </h2>
            <p className="mt-1 text-sm text-white/78">{subtitle}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="grid grid-cols-4 gap-2 rounded-2xl bg-black/18 p-2">
            {[
              ["Days", parts.days],
              ["Hrs", parts.hours],
              ["Min", parts.minutes],
              ["Sec", parts.seconds],
            ].map(([label, value]) => (
              <div
                key={label}
                className="min-w-[54px] rounded-xl bg-white/12 px-2 py-2 text-center"
              >
                <p className="text-lg font-black leading-none">{pad(value)}</p>
                <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.12em] text-white/62">
                  {label}
                </p>
              </div>
            ))}
          </div>

          {couponCode ? (
            <span className="inline-flex items-center gap-2 rounded-full border border-white/18 bg-white/12 px-4 py-2 text-sm font-black">
              <FiTag />
              {couponCode}
            </span>
          ) : null}

          <Link
            href={ctaHref}
            className="inline-flex items-center justify-center rounded-full bg-white px-5 py-3 text-sm font-black text-[#3a2115] transition hover:bg-[#fff3df]"
          >
            {ctaLabel}
          </Link>
        </div>
      </div>
    </section>
  );
}
