"use client";

import useMembership from "@/hooks/useMembership";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

const GuardLoader = () => (
  <div className="min-h-[60vh] flex items-center justify-center">
    <div className="h-10 w-10 rounded-full border-2 border-[var(--flavor-color)] border-t-transparent animate-spin" />
  </div>
);

const LockedCard = ({
  title,
  description,
  primaryHref,
  primaryLabel,
  secondaryHref,
  secondaryLabel,
}) => (
  <section className="min-h-[70vh] flex items-center justify-center px-4 py-10">
    <div className="w-full max-w-xl rounded-3xl border border-[var(--glass-border)] bg-[var(--glass-bg)] p-8 text-center shadow-[var(--glass-shadow)] backdrop-blur-[var(--glass-blur)]">
      <span className="inline-flex px-3 py-1 text-xs font-bold tracking-wider uppercase rounded-full bg-[var(--flavor-glass)] text-[var(--flavor-color)]">
        Members Only
      </span>
      <h1 className="mt-4 text-3xl font-black text-gray-900">{title}</h1>
      <p className="mt-3 text-sm text-gray-600">{description}</p>
      <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
        <Link
          href={primaryHref}
          className="w-full sm:w-auto px-6 py-3 rounded-xl font-semibold text-white bg-[var(--flavor-color)] hover:bg-[var(--flavor-hover)] transition-colors"
        >
          {primaryLabel}
        </Link>
        {secondaryHref ? (
          <Link
            href={secondaryHref}
            className="w-full sm:w-auto px-6 py-3 rounded-xl font-semibold border border-[var(--glass-border)] bg-[var(--glass-bg)] text-[var(--glass-text)] hover:opacity-90 transition-colors"
          >
            {secondaryLabel}
          </Link>
        ) : null}
      </div>
    </div>
  </section>
);

const MembershipGuard = ({
  children,
  mode = "locked",
  upgradeHref = "/membership",
  loginRedirect = "/exclusive-products",
}) => {
  const router = useRouter();
  const { loading, isAuthenticated, isActiveMember } = useMembership({
    autoFetch: true,
  });

  useEffect(() => {
    if (loading || mode !== "redirect") return;

    if (!isAuthenticated) {
      router.replace(`/login?redirect=${encodeURIComponent(loginRedirect)}`);
      return;
    }

    if (!isActiveMember) {
      router.replace(upgradeHref);
    }
  }, [loading, mode, isAuthenticated, isActiveMember, router, loginRedirect, upgradeHref]);

  if (loading) {
    return <GuardLoader />;
  }

  if (mode === "redirect") {
    if (!isAuthenticated || !isActiveMember) return null;
    return children;
  }

  if (!isAuthenticated) {
    return (
      <LockedCard
        title="Login To Unlock Exclusive Products"
        description="Exclusive products are only available to users with an active membership."
        primaryHref={`/login?redirect=${encodeURIComponent(loginRedirect)}`}
        primaryLabel="Login"
        secondaryHref={upgradeHref}
        secondaryLabel="View Membership Plans"
      />
    );
  }

  if (!isActiveMember) {
    return (
      <LockedCard
        title="Exclusive Products Are Locked"
        description="Upgrade to an active membership to view and purchase members-only products."
        primaryHref={upgradeHref}
        primaryLabel="Upgrade Membership"
      />
    );
  }

  return children;
};

export default MembershipGuard;
