"use client";

import { Crown, Gift, Package, Percent, Rocket, Trophy } from "lucide-react";

const perks = [
  {
    icon: Trophy,
    title: "Earn Points",
    text: "Shop & Earn: Get 1 point for every ₹1 spent. Redeem points for exclusive rewards.",
    gradient: "from-amber-400 to-orange-500",
    bgGlow: "bg-amber-500/20",
  },
  {
    icon: Rocket,
    title: "Early Access",
    text: "First Dibs: Get 24-hour early access to new product launches before the public.",
    gradient: "from-violet-400 to-purple-500",
    bgGlow: "bg-violet-500/20",
  },
  {
    icon: Percent,
    title: "Special Discounts",
    text: "Members Only: Unlock exclusive pricing, flash sales, and secret promotions.",
    gradient: "from-emerald-400 to-teal-500",
    bgGlow: "bg-emerald-500/20",
  },
  {
    icon: Package,
    title: "Free Shipping",
    text: "Zero Shipping Fees: Free delivery on all orders over ₹500. No hidden charges.",
    gradient: "from-blue-400 to-cyan-500",
    bgGlow: "bg-blue-500/20",
  },
  {
    icon: Gift,
    title: "Birthday Gifts",
    text: "Birthday Treats: A special surprise gift delivered to your inbox every year.",
    gradient: "from-pink-400 to-rose-500",
    bgGlow: "bg-pink-500/20",
  },
  {
    icon: Crown,
    title: "VIP Support",
    text: "Priority Care: Skip the queue with dedicated support and personalized advice.",
    gradient: "from-yellow-400 to-amber-500",
    bgGlow: "bg-yellow-500/20",
  },
];

const MembershipPerks = () => {
  return (
    <section className="relative py-10 sm:py-16 md:py-20 px-3 sm:px-4 md:px-8 overflow-hidden">
      {/* Background with subtle pattern */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-orange-50/30" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-orange-100/40 via-transparent to-transparent" />

      {/* Decorative blobs */}
      <div className="absolute top-20 left-10 w-72 h-72 bg-orange-200/30 rounded-full blur-3xl hidden sm:block" />
      <div className="absolute bottom-20 right-10 w-96 h-96 bg-amber-200/20 rounded-full blur-3xl hidden sm:block" />

      <div className="relative max-w-7xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-10 sm:mb-16">
          <span className="inline-block px-3 sm:px-4 py-1 sm:py-1.5 mb-3 sm:mb-4 text-xs sm:text-sm font-semibold text-[#c1591c] bg-[#c1591c]/10 rounded-full">
            ✨ Exclusive Benefits
          </span>
          <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-extrabold text-gray-900 mb-3 sm:mb-5 tracking-tight">
            Membership Perks
          </h2>
          <p className="text-gray-500 text-sm sm:text-base md:text-lg lg:text-xl max-w-2xl mx-auto leading-relaxed px-4 sm:px-0">
            Join our community and unlock premium benefits designed to make your
            shopping experience exceptional.
          </p>
        </div>

        {/* Perks Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
          {perks.map((perk, index) => {
            const IconComponent = perk.icon;
            return (
              <div
                key={index}
                className="group relative bg-white/80 backdrop-blur-sm rounded-xl sm:rounded-2xl p-5 sm:p-6 md:p-8 
                           border border-gray-100 shadow-sm
                           transition-all duration-500 ease-out
                           hover:-translate-y-2 hover:shadow-2xl hover:shadow-gray-200/50
                           hover:border-gray-200"
              >
                {/* Hover glow effect */}
                <div
                  className={`absolute inset-0 ${perk.bgGlow} rounded-xl sm:rounded-2xl opacity-0 group-hover:opacity-100 blur-xl transition-opacity duration-500 -z-10`}
                />

                {/* Icon Container */}
                <div
                  className={`relative w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-xl sm:rounded-2xl bg-gradient-to-br ${perk.gradient} 
                                flex items-center justify-center mb-4 sm:mb-6 shadow-lg
                                group-hover:scale-110 group-hover:rotate-3 transition-all duration-500`}
                >
                  <IconComponent
                    className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-white"
                    strokeWidth={2}
                  />
                </div>

                {/* Content */}
                <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-2 sm:mb-3 group-hover:text-gray-800 transition-colors">
                  {perk.title}
                </h3>
                <p className="text-gray-500 leading-relaxed text-[13px] sm:text-[14px] md:text-[15px]">
                  {perk.text}
                </p>

                {/* Bottom accent line */}
                <div
                  className={`absolute bottom-0 left-5 right-5 sm:left-8 sm:right-8 h-1 bg-gradient-to-r ${perk.gradient} 
                                rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500`}
                />
              </div>
            );
          })}
        </div>

        {/* CTA Section */}
        <div className="text-center mt-10 sm:mt-16">
          <div className="inline-flex flex-col sm:flex-row items-center gap-3 sm:gap-4">
            <a
              href="/membership"
              className="group inline-flex items-center gap-2 sm:gap-3 px-6 sm:px-8 py-3 sm:py-4 bg-gradient-to-r from-[#c1591c] to-[#e07a3a] 
                         text-white font-semibold text-base sm:text-lg rounded-xl sm:rounded-2xl
                         shadow-xl shadow-orange-500/25
                         hover:shadow-2xl hover:shadow-orange-500/30 
                         hover:-translate-y-1 active:scale-[0.98]
                         transition-all duration-300"
            >
              <span>Become a Member</span>
              <Rocket className="w-4 h-4 sm:w-5 sm:h-5 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform duration-300" />
            </a>
            <span className="text-gray-400 text-xs sm:text-sm">
              Join 10,000+ happy members
            </span>
          </div>
        </div>
      </div>
    </section>
  );
};

export default MembershipPerks;
