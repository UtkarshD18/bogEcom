"use client";

import { API_BASE_URL } from "@/utils/api";

import cookies from "js-cookie";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { FaCheck, FaCrown } from "react-icons/fa";
import { HiSparkles } from "react-icons/hi2";
import { IoSparkles } from "react-icons/io5";

const API_URL = API_BASE_URL;

const getStoredAuthToken = () => {
  const cookieToken = cookies.get("accessToken");
  if (cookieToken) return cookieToken;
  if (typeof window === "undefined") return "";
  return localStorage.getItem("accessToken") || localStorage.getItem("token") || "";
};

const ensureAccessTokenCookie = (token) => {
  if (!token) return;
  if (!cookies.get("accessToken")) {
    cookies.set("accessToken", token, { expires: 7 });
  }
};

const THEME_PRESETS = {
  mint: {
    bg: "from-emerald-50/80 via-white to-teal-50/80",
    glowA: "bg-emerald-200/40",
    glowB: "bg-teal-200/30",
    glowC: "bg-[var(--flavor-glass)]",
    accent: "from-emerald-600 via-teal-600 to-green-600",
    badge: "from-emerald-500 to-teal-500",
    glass: "bg-white/70",
    border: "border-emerald-200/50",
    text: "text-emerald-700",
  },
  sky: {
    bg: "from-sky-50/80 via-white to-cyan-50/80",
    glowA: "bg-sky-200/40",
    glowB: "bg-cyan-200/30",
    glowC: "bg-blue-200/30",
    accent: "from-sky-600 via-cyan-600 to-blue-600",
    badge: "from-sky-500 to-cyan-500",
    glass: "bg-white/70",
    border: "border-sky-200/50",
    text: "text-sky-700",
  },
  aurora: {
    bg: "from-lime-50/70 via-white to-emerald-50/80",
    glowA: "bg-lime-200/35",
    glowB: "bg-emerald-200/30",
    glowC: "bg-teal-200/25",
    accent: "from-lime-600 via-emerald-600 to-teal-600",
    badge: "from-lime-500 to-emerald-500",
    glass: "bg-white/70",
    border: "border-emerald-200/50",
    text: "text-emerald-700",
  },
  lavender: {
    bg: "from-indigo-50/70 via-white to-purple-50/80",
    glowA: "bg-indigo-200/35",
    glowB: "bg-purple-200/30",
    glowC: "bg-fuchsia-200/25",
    accent: "from-indigo-600 via-purple-600 to-fuchsia-600",
    badge: "from-indigo-500 to-purple-500",
    glass: "bg-white/70",
    border: "border-indigo-200/50",
    text: "text-indigo-700",
  },
  sunset: {
    bg: "from-orange-50/70 via-white to-rose-50/80",
    glowA: "bg-orange-200/35",
    glowB: "bg-rose-200/30",
    glowC: "bg-pink-200/25",
    accent: "from-orange-600 via-rose-600 to-pink-600",
    badge: "from-orange-500 to-rose-500",
    glass: "bg-white/70",
    border: "border-rose-200/50",
    text: "text-rose-700",
  },
  midnight: {
    bg: "from-slate-50/70 via-white to-gray-50/80",
    glowA: "bg-slate-200/35",
    glowB: "bg-gray-200/30",
    glowC: "bg-zinc-200/25",
    accent: "from-slate-700 via-gray-800 to-zinc-800",
    badge: "from-slate-700 to-gray-800",
    glass: "bg-white/70",
    border: "border-slate-200/50",
    text: "text-slate-700",
  },
};

const DEFAULT_CONTENT = {
  theme: { style: "mint" },
  hero: {
    badge: "Premium Membership",
    title: "Buy One Gram Club",
    titleHighlight: "Premium",
    description:
      "Join our exclusive community and unlock premium benefits designed for your wellness journey.",
    note: "Limited member slots refreshed monthly",
  },
  benefits: {
    title: "Unlock Exclusive Benefits",
    subtitle:
      "Start earning rewards today and take your health journey to the next level with premium perks.",
    items: [
      {
        icon: "⭐",
        title: "Earn Points",
        description:
          "Get 1 point for every ₹1 spent. Redeem points for discounts and exclusive products.",
      },
      {
        icon: "🚀",
        title: "Early Access",
        description:
          "Be the first to try our latest products before they're available to the public.",
      },
      {
        icon: "💎",
        title: "Special Discounts",
        description:
          "Enjoy exclusive pricing and promotions available only to our members.",
      },
      {
        icon: "🚚",
        title: "Free Shipping",
        description:
          "Enjoy free shipping on all orders above ₹500. No hidden charges.",
      },
      {
        icon: "🎁",
        title: "Birthday Gifts",
        description:
          "Receive special birthday surprises and exclusive member-only offers monthly.",
      },
      {
        icon: "🛡️",
        title: "VIP Support",
        description:
          "Get priority customer support and personalized recommendations.",
      },
    ],
  },
  pricing: {
    title: "Simple, honest pricing",
    subtitle: "One plan. All benefits. Cancel anytime.",
    ctaText: "Join Membership",
    note: "Instant access after checkout.",
  },
  cta: {
    title: "Ready to upgrade your daily nutrition?",
    description:
      "Members get early access, exclusive drops, and a smoother checkout experience.",
    buttonText: "Explore Plans",
    buttonLink: "/membership",
  },
};

// Floating particle component
const FloatingParticle = ({ delay, size, left, duration }) => (
  <div
    className="absolute rounded-full bg-gradient-to-br from-emerald-400/30 to-teal-400/20 blur-sm"
    style={{
      width: size,
      height: size,
      left: `${left}%`,
      bottom: "-50px",
      animation: `floatUp ${duration}s ease-in-out infinite`,
      animationDelay: `${delay}s`,
    }}
  />
);

// Benefit Card Component with liquid glass effect
const BenefitCard = ({ icon, title, description, accent, index }) => (
  <div
    className="group relative overflow-hidden rounded-2xl transition-all duration-500 hover:scale-[1.02] hover:-translate-y-1"
    style={{ animationDelay: `${index * 100}ms` }}
  >
    {/* Glass background */}
    <div className="absolute inset-0 bg-white/60 backdrop-blur-xl border border-white/40 rounded-2xl shadow-lg shadow-black/5" />

    {/* Gradient overlay on hover */}
    <div
      className={`absolute inset-0 bg-gradient-to-br ${accent} opacity-0 group-hover:opacity-10 transition-opacity duration-500 rounded-2xl`}
    />

    {/* Shine effect */}
    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 overflow-hidden rounded-2xl">
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
    </div>

    {/* Content */}
    <div className="relative p-6 sm:p-7">
      {/* Icon container */}
      <div
        className={`w-14 h-14 rounded-xl bg-gradient-to-br ${accent} flex items-center justify-center mb-4 shadow-lg group-hover:scale-110 group-hover:rotate-3 transition-all duration-300`}
      >
        <span className="text-white text-2xl">{icon || "⭐"}</span>
      </div>

      <h3 className="text-lg font-bold text-gray-800 mb-2 transition-colors">
        {title}
      </h3>
      <p className="text-gray-600 text-sm leading-relaxed">{description}</p>
    </div>

    {/* Bottom accent line */}
    <div
      className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r ${accent} transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left rounded-b-2xl`}
    />
  </div>
);

export default function MembershipPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [membershipStatus, setMembershipStatus] = useState(null);
  const [activePlan, setActivePlan] = useState(null);
  const [pageContent, setPageContent] = useState(DEFAULT_CONTENT);
  const router = useRouter();

  const fetchMembershipStatus = async (token) => {
    if (!token) {
      setMembershipStatus(null);
      return;
    }

    try {
      const res = await fetch(`${API_URL}/api/membership/status`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      });
      if (res.status === 401) {
        setMembershipStatus(null);
        setIsLoggedIn(false);
        return;
      }
      const data = await res.json();
      if (data.success) {
        setMembershipStatus(data.data);
      }
    } catch (err) {
      console.warn("Failed to fetch membership status:", err);
    }
  };

  useEffect(() => {
    const checkAuth = async () => {
      const token = getStoredAuthToken();
      if (token) {
        ensureAccessTokenCookie(token);
        setIsLoggedIn(true);
        await fetchMembershipStatus(token);
      } else {
        setIsLoggedIn(false);
        setMembershipStatus(null);
      }
      // Fetch active plan
      try {
        const res = await fetch(`${API_URL}/api/membership/active`);
        const data = await res.json();
        if (data.success) {
          setActivePlan(data.data);
        }
      } catch (err) {
        console.warn("Failed to fetch active plan:", err);
      }
      // Fetch membership page content
      try {
        const res = await fetch(`${API_URL}/api/membership/page/public`);
        const data = await res.json();
        if (data.success && data.data) {
          setPageContent({
            ...DEFAULT_CONTENT,
            ...data.data,
            hero: { ...DEFAULT_CONTENT.hero, ...(data.data.hero || {}) },
            benefits: {
              ...DEFAULT_CONTENT.benefits,
              ...(data.data.benefits || {}),
            },
            pricing: {
              ...DEFAULT_CONTENT.pricing,
              ...(data.data.pricing || {}),
            },
            cta: { ...DEFAULT_CONTENT.cta, ...(data.data.cta || {}) },
            theme: {
              ...DEFAULT_CONTENT.theme,
              ...(data.data.theme || {}),
            },
          });
        }
      } catch (err) {
        console.warn("Failed to fetch membership page content:", err);
      }
      setIsLoading(false);
    };
    checkAuth();
  }, []);

  useEffect(() => {
    const handleAuthChanged = async () => {
      const token = getStoredAuthToken();
      const loggedIn = Boolean(token);
      setIsLoggedIn(loggedIn);
      if (loggedIn) {
        ensureAccessTokenCookie(token);
        await fetchMembershipStatus(token);
      } else {
        setMembershipStatus(null);
      }
    };

    window.addEventListener("loginSuccess", handleAuthChanged);
    window.addEventListener("storage", handleAuthChanged);
    window.addEventListener("focus", handleAuthChanged);

    return () => {
      window.removeEventListener("loginSuccess", handleAuthChanged);
      window.removeEventListener("storage", handleAuthChanged);
      window.removeEventListener("focus", handleAuthChanged);
    };
  }, []);

  const theme = useMemo(() => {
    const key = pageContent?.theme?.style || "mint";
    return THEME_PRESETS[key] || THEME_PRESETS.mint;
  }, [pageContent]);

  const handleSubscribe = () => {
    if (!isLoggedIn) {
      router.push("/login?redirect=/membership/checkout");
      return;
    }
    if (membershipStatus?.isMember && !membershipStatus?.isExpired) {
      return;
    }
    router.push("/membership/checkout");
  };

  const handleSecondaryCta = () => {
    const configuredLink =
      pageContent?.cta?.buttonLink || DEFAULT_CONTENT.cta.buttonLink;
    if (configuredLink === "/membership") {
      handleSubscribe();
      return;
    }
    router.push(configuredLink);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-teal-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
          <p className="text-emerald-700 font-medium">Loading membership...</p>
        </div>
      </div>
    );
  }

  const isMemberActive =
    membershipStatus?.isMember && !membershipStatus?.isExpired;

  return (
    <main
      className={`min-h-screen bg-gradient-to-br ${theme.bg} relative overflow-hidden`}
    >
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className={`absolute top-20 left-10 w-72 h-72 rounded-full blur-3xl animate-pulse ${theme.glowA}`}
        />
        <div
          className={`absolute top-40 right-20 w-96 h-96 rounded-full blur-3xl animate-pulse ${theme.glowB}`}
          style={{ animationDelay: "1s" }}
        />
        <div
          className={`absolute bottom-20 left-1/3 w-80 h-80 rounded-full blur-3xl animate-pulse ${theme.glowC}`}
          style={{ animationDelay: "2s" }}
        />

        {/* Floating particles */}
        <FloatingParticle delay={0} size={20} left={10} duration={8} />
        <FloatingParticle delay={2} size={15} left={25} duration={10} />
        <FloatingParticle delay={1} size={25} left={50} duration={9} />
        <FloatingParticle delay={3} size={18} left={75} duration={11} />
        <FloatingParticle delay={4} size={22} left={90} duration={7} />
      </div>

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        {/* Header Section */}
        <header className="text-center mb-12 sm:mb-16">
          {/* Crown badge */}
          <div
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${theme.glass} backdrop-blur-lg border ${theme.border} shadow-lg mb-6`}
          >
            <FaCrown className={theme.text} />
            <span className={`text-sm font-semibold ${theme.text}`}>
              {pageContent?.hero?.badge || "Premium Membership"}
            </span>
            <HiSparkles className="text-amber-500" />
          </div>

          {/* Main title */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black mb-4">
            <span className={`bg-gradient-to-r ${theme.accent} bg-clip-text text-transparent`}>
              {pageContent?.hero?.title || activePlan?.name || "Buy One Gram Club"}
            </span>
            {pageContent?.hero?.titleHighlight && (
              <span className={`block bg-gradient-to-r ${theme.accent} bg-clip-text text-transparent`}>
                {pageContent.hero.titleHighlight}
              </span>
            )}
          </h1>

          {/* Subtitle */}
          <p className="text-gray-600 text-lg sm:text-xl max-w-2xl mx-auto leading-relaxed mb-8">
            {pageContent?.hero?.description ||
              activePlan?.description ||
              DEFAULT_CONTENT.hero.description}
          </p>
          {pageContent?.hero?.note && (
            <p className="text-xs sm:text-sm text-gray-500">
              {pageContent.hero.note}
            </p>
          )}

          {/* Active member badge */}
          {isMemberActive && (
            <div className={`inline-flex items-center gap-3 px-6 py-3 rounded-2xl bg-gradient-to-r ${theme.badge} text-white shadow-xl shadow-black/10`}>
              <FaCheck className="text-lg" />
              <span className="font-bold">You&apos;re a Member!</span>
              <span className="text-emerald-100">
                Expires:{" "}
                {new Date(
                  membershipStatus.membershipExpiry,
                ).toLocaleDateString()}
              </span>
            </div>
          )}
        </header>

        {/* Benefits Section */}
        <section className="mb-16">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-3">
              <span className={`bg-gradient-to-r ${theme.accent} bg-clip-text text-transparent`}>
                {pageContent?.benefits?.title || DEFAULT_CONTENT.benefits.title}
              </span>
            </h2>
            <p className="text-gray-600 max-w-xl mx-auto">
              {pageContent?.benefits?.subtitle || DEFAULT_CONTENT.benefits.subtitle}
            </p>
          </div>

          {/* Benefits Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
            {(pageContent?.benefits?.items?.length
              ? pageContent.benefits.items
              : DEFAULT_CONTENT.benefits.items
            ).map((benefit, index) => (
              <BenefitCard
                key={`${benefit.title}-${index}`}
                icon={benefit.icon}
                title={benefit.title}
                description={benefit.description}
                accent={theme.accent}
                index={index}
              />
            ))}
          </div>
        </section>

        {/* Pricing Section */}
        <section className="text-center">
          {/* Price Card */}
          {activePlan && (
            <div className="inline-block mb-8">
              <div className="relative">
                {/* Glass card */}
                <div className={`relative px-12 py-8 rounded-3xl ${theme.glass} backdrop-blur-xl border border-white/50 shadow-2xl shadow-black/10`}>
                  {/* Sparkle decoration */}
                  <IoSparkles className="absolute -top-3 -right-3 text-3xl text-amber-400 animate-pulse" />

                  <div className="mb-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-gray-500">
                      {pageContent?.pricing?.title || DEFAULT_CONTENT.pricing.title}
                    </p>
                    <p className="text-sm text-gray-500">
                      {pageContent?.pricing?.subtitle || DEFAULT_CONTENT.pricing.subtitle}
                    </p>
                  </div>

                  {/* Price */}
                  <div className="flex items-baseline justify-center gap-1 mb-2">
                    <span className="text-2xl font-bold text-gray-500">₹</span>
                    <span className={`text-5xl sm:text-6xl font-black bg-gradient-to-r ${theme.accent} bg-clip-text text-transparent`}>
                      {activePlan.price}
                    </span>
                    {activePlan.originalPrice > activePlan.price && (
                      <span className="text-xl text-gray-400 line-through ml-3">
                        ₹{activePlan.originalPrice}
                      </span>
                    )}
                  </div>

                  {/* Duration */}
                  <p className="text-gray-500 font-medium">
                    for {activePlan.duration} {activePlan.durationUnit}
                  </p>

                  {pageContent?.pricing?.note && (
                    <p className="text-xs text-gray-500 mt-2">
                      {pageContent.pricing.note}
                    </p>
                  )}

                  {/* Save badge */}
                  {activePlan.originalPrice > activePlan.price && (
                    <div className={`absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r ${theme.badge} text-white text-sm font-bold shadow-lg`}>
                      Save ₹{activePlan.originalPrice - activePlan.price}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* CTA Button */}
          <div>
            <button
              onClick={handleSubscribe}
              disabled={isMemberActive}
              className={`
                relative group inline-flex items-center gap-3 px-10 py-4 rounded-2xl text-white font-bold text-lg
                transition-all duration-300 transform
                ${isMemberActive
                  ? `bg-gradient-to-r ${theme.badge} cursor-default opacity-90`
                  : `bg-gradient-to-r ${theme.accent} bg-[length:200%_100%] hover:bg-right hover:scale-105 hover:shadow-2xl hover:shadow-black/20 active:scale-[0.98]`
                }
                shadow-xl shadow-black/15
              `}
            >
              {/* Button shine effect */}
              {!isMemberActive && (
                <div className="absolute inset-0 rounded-2xl overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                </div>
              )}

              <span className="relative">
                {isMemberActive ? (
                  <>
                    <FaCheck className="inline mr-2" />
                    Active Member
                  </>
                ) : isLoggedIn ? (
                  <>
                    <FaCrown className="inline mr-2" />
                    {pageContent?.pricing?.ctaText || DEFAULT_CONTENT.pricing.ctaText}
                  </>
                ) : (
                  "Login to Join"
                )}
              </span>
            </button>

            <p className="text-gray-500 text-sm mt-4">
              {isMemberActive
                ? "Enjoy your exclusive member benefits!"
                : isLoggedIn
                  ? "Click above to proceed to checkout"
                  : "Login required to activate membership"}
            </p>
          </div>
        </section>

        {/* CTA Section */}
        <section className="mt-16">
          <div
            className={`relative overflow-hidden rounded-3xl ${theme.glass} backdrop-blur-xl border border-white/60 shadow-xl shadow-black/10 px-8 sm:px-10 py-10`}
          >
            <div className="absolute inset-0 opacity-40">
              <div
                className={`absolute -top-20 -right-20 h-48 w-48 rounded-full blur-3xl ${theme.glowB}`}
              />
              <div
                className={`absolute -bottom-24 -left-24 h-56 w-56 rounded-full blur-3xl ${theme.glowA}`}
              />
            </div>
            <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
              <div>
                <h3 className="text-2xl sm:text-3xl font-bold text-gray-900">
                  {pageContent?.cta?.title || DEFAULT_CONTENT.cta.title}
                </h3>
                <p className="text-gray-600 mt-2 max-w-2xl">
                  {pageContent?.cta?.description || DEFAULT_CONTENT.cta.description}
                </p>
              </div>
              <button
                onClick={handleSecondaryCta}
                className={`inline-flex items-center justify-center px-8 py-3 rounded-2xl font-semibold text-white bg-gradient-to-r ${theme.accent} shadow-lg shadow-black/15 hover:scale-[1.02] transition-transform`}
              >
                {pageContent?.cta?.buttonText || DEFAULT_CONTENT.cta.buttonText}
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* Custom keyframes for floating animation */}
      <style jsx>{`
        @keyframes floatUp {
          0%,
          100% {
            transform: translateY(0) rotate(0deg);
            opacity: 0;
          }
          10% {
            opacity: 0.7;
          }
          90% {
            opacity: 0.7;
          }
          100% {
            transform: translateY(-100vh) rotate(360deg);
            opacity: 0;
          }
        }
      `}</style>
    </main>
  );
}
