"use client";

const STATUS_STYLES = {
  active: "bg-emerald-100 text-emerald-700 border-emerald-200",
  expired: "bg-red-100 text-red-700 border-red-200",
  cancelled: "bg-slate-100 text-slate-700 border-slate-200",
};

export default function MembershipStatusBadge({ status }) {
  const normalized = String(status || "").toLowerCase();
  const style = STATUS_STYLES[normalized] || STATUS_STYLES.cancelled;
  const label = normalized
    ? normalized.charAt(0).toUpperCase() + normalized.slice(1)
    : "Cancelled";

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${style}`}
    >
      {label}
    </span>
  );
}
