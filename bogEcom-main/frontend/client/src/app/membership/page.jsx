"use client";

import cookies from "js-cookie";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { FaCheck, FaCrown, FaShippingFast } from "react-icons/fa";
import { HiSparkles } from "react-icons/hi2";
import {
  IoDiamond,
  IoGift,
  IoRocket,
  IoShield,
  IoSparkles,
  IoStar,
} from "react-icons/io5";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// Benefit card data
const BENEFITS = [
  {
    icon: IoStar,
    title: "Earn Points",
    description:
      "Get 1 point for every ₹1 spent. Redeem points for discounts and exclusive products.",
    gradient: "from-emerald-400 to-teal-500",
  },
  {
    icon: IoRocket,
    title: "Early Access",
    description:
      "Be the first to try our latest products before they're available to the public.",
    gradient: "from-teal-400 to-cyan-500",
  },
  {
    icon: IoDiamond,
    title: "Special Discounts",
    description:
      "Enjoy exclusive pricing and promotions available only to our members.",
    gradient: "from-cyan-400 to-emerald-500",
  },
  {
    icon: FaShippingFast,
    title: "Free Shipping",
    description:
      "Enjoy free shipping on all orders above ₹500. No hidden charges.",
    gradient: "from-emerald-500 to-green-500",
  },
  {
    icon: IoGift,
    title: "Birthday Gifts",
    description:
      "Receive special birthday surprises and exclusive member-only offers monthly.",
    gradient: "from-green-400 to-emerald-500",
  },
  {
    icon: IoShield,
    title: "VIP Support",
    description:
      "Get priority customer support and personalized recommendations.",
    gradient: "from-teal-500 to-emerald-600",
  },
];

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
const BenefitCard = ({ icon: Icon, title, description, gradient, index }) => (
  <div
    className="group relative overflow-hidden rounded-2xl transition-all duration-500 hover:scale-[1.02] hover:-translate-y-1"
    style={{ animationDelay: `${index * 100}ms` }}
  >
    {/* Glass background */}
    <div className="absolute inset-0 bg-white/60 backdrop-blur-xl border border-white/40 rounded-2xl shadow-lg shadow-emerald-500/5" />

    {/* Gradient overlay on hover */}
    <div
      className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-0 group-hover:opacity-10 transition-opacity duration-500 rounded-2xl`}
    />

    {/* Shine effect */}
    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 overflow-hidden rounded-2xl">
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
    </div>

    {/* Content */}
    <div className="relative p-6 sm:p-7">
      {/* Icon container */}
      <div
        className={`w-14 h-14 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center mb-4 shadow-lg group-hover:scale-110 group-hover:rotate-3 transition-all duration-300`}
      >
        <Icon className="text-white text-2xl" />
      </div>

      <h3 className="text-lg font-bold text-gray-800 mb-2 group-hover:text-emerald-700 transition-colors">
        {title}
      </h3>
      <p className="text-gray-600 text-sm leading-relaxed">{description}</p>
    </div>

    {/* Bottom accent line */}
    <div
      className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r ${gradient} transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left rounded-b-2xl`}
    />
  </div>
);

export default function MembershipPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [membershipStatus, setMembershipStatus] = useState(null);
  const [activePlan, setActivePlan] = useState(null);
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      const token = cookies.get("accessToken");
      if (token) {
        setIsLoggedIn(true);
        // Fetch membership status
        try {
          const res = await fetch(`${API_URL}/api/membership/status`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const data = await res.json();
          if (data.success) {
            setMembershipStatus(data.data);
          }
        } catch (err) {
          console.error("Failed to fetch membership status:", err);
        }
      }
      // Fetch active plan
      try {
        const res = await fetch(`${API_URL}/api/membership/active`);
        const data = await res.json();
        if (data.success) {
          setActivePlan(data.data);
        }
      } catch (err) {
        console.error("Failed to fetch active plan:", err);
      }
      setIsLoading(false);
    };
    checkAuth();
  }, []);

  const handleSubscribe = () => {
    if (!isLoggedIn) {
      router.push("/login?redirect=/membership");
      return;
    }
    if (membershipStatus?.isMember && !membershipStatus?.isExpired) {
      return;
    }
    router.push("/membership/checkout");
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
    <main className="min-h-screen bg-gradient-to-br from-emerald-50/80 via-white to-teal-50/80 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-emerald-200/40 rounded-full blur-3xl animate-pulse" />
        <div
          className="absolute top-40 right-20 w-96 h-96 bg-teal-200/30 rounded-full blur-3xl animate-pulse"
          style={{ animationDelay: "1s" }}
        />
        <div
          className="absolute bottom-20 left-1/3 w-80 h-80 bg-green-200/30 rounded-full blur-3xl animate-pulse"
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
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/70 backdrop-blur-lg border border-emerald-200/50 shadow-lg mb-6">
            <FaCrown className="text-emerald-600" />
            <span className="text-sm font-semibold text-emerald-700">
              Premium Membership
            </span>
            <HiSparkles className="text-amber-500" />
          </div>

          {/* Main title */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black mb-4">
            <span className="bg-gradient-to-r from-emerald-600 via-teal-600 to-green-600 bg-clip-text text-transparent">
              {activePlan?.name || "Buy One Gram Club"}
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-gray-600 text-lg sm:text-xl max-w-2xl mx-auto leading-relaxed mb-8">
            {activePlan?.description ||
              "Join our exclusive community and unlock premium benefits designed for your wellness journey"}
          </p>

          {/* Active member badge */}
          {isMemberActive && (
            <div className="inline-flex items-center gap-3 px-6 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-xl shadow-emerald-500/25">
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
              <span className="bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
                Unlock Exclusive Benefits
              </span>
            </h2>
            <p className="text-gray-600 max-w-xl mx-auto">
              Start earning rewards today and take your health journey to the
              next level with premium perks
            </p>
          </div>

          {/* Benefits Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
            {BENEFITS.map((benefit, index) => (
              <BenefitCard key={benefit.title} {...benefit} index={index} />
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
                <div className="relative px-12 py-8 rounded-3xl bg-white/70 backdrop-blur-xl border border-white/50 shadow-2xl shadow-emerald-500/10">
                  {/* Sparkle decoration */}
                  <IoSparkles className="absolute -top-3 -right-3 text-3xl text-amber-400 animate-pulse" />

                  {/* Price */}
                  <div className="flex items-baseline justify-center gap-1 mb-2">
                    <span className="text-2xl font-bold text-gray-500">₹</span>
                    <span className="text-5xl sm:text-6xl font-black bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
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

                  {/* Save badge */}
                  {activePlan.originalPrice > activePlan.price && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-sm font-bold shadow-lg">
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
                ${
                  isMemberActive
                    ? "bg-gradient-to-r from-emerald-500 to-teal-500 cursor-default opacity-90"
                    : "bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 bg-[length:200%_100%] hover:bg-right hover:scale-105 hover:shadow-2xl hover:shadow-emerald-500/30 active:scale-[0.98]"
                }
                shadow-xl shadow-emerald-500/20
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
                    Join Membership
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
