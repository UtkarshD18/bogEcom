"use client";

import Link from "next/link";
import { useState } from "react";
import { AiOutlineYoutube } from "react-icons/ai";
import { BiSupport } from "react-icons/bi";
import { BsWallet2 } from "react-icons/bs";
import { FaFacebook, FaInstagram } from "react-icons/fa";
import { IoChatboxOutline } from "react-icons/io5";
import { LiaGiftSolid, LiaShippingFastSolid } from "react-icons/lia";
import { PiKeyReturnLight } from "react-icons/pi";

const Footer = () => {
  // --- STATE FOR NEWSLETTER ---
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState(null);

  const handleSubscribe = (e) => {
    e.preventDefault();
    if (!email) return;
    setStatus("loading");
    setTimeout(() => {
      console.log("Subscribed:", email);
      setStatus("success");
      setEmail("");
    }, 1500);
  };

  return (
    <footer className="relative bg-[#Fdfbf7] text-gray-700 overflow-hidden">
      <div className="container mx-auto px-4 sm:px-6">
        {/* ========================================================== */}
        {/* MEMBERSHIP BANNER (Top Section) - Hidden                   */}
        {/* ========================================================== */}
        {/* Membership banner removed as per request */}

        {/* ================= TOP FEATURES (Shipping Area) ================= */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-4 pb-8 sm:pb-12 pt-4">
          {[
            {
              icon: <LiaShippingFastSolid />,
              title: "Free Shipping",
              desc: "For all Orders Over ₹500",
            },
            {
              icon: <PiKeyReturnLight />,
              title: "7 Days Returns",
              desc: "For an Exchange Product",
            },
            {
              icon: <BsWallet2 />,
              title: "Secured Payment",
              desc: "Payment Cards Accepted",
            },
            {
              icon: <LiaGiftSolid />,
              title: "Special Gifts",
              desc: "Our First Product Order",
            },
            {
              icon: <BiSupport />,
              title: "Support 24/7",
              desc: "Contact Us Anytime",
            },
          ].map((item, i) => (
            <div
              key={i}
              className="group flex flex-col items-center p-3 sm:p-6 rounded-xl sm:rounded-2xl transition-all duration-500 backdrop-blur-md border shadow-sm hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)] hover:-translate-y-2"
              style={{
                backgroundColor:
                  "color-mix(in srgb, var(--flavor-card-bg, #fffbf5) 50%, transparent)",
                borderColor:
                  "color-mix(in srgb, var(--flavor-color, #f5c16c) 30%, transparent)",
              }}
            >
              <div className="text-[28px] sm:text-[38px] text-gray-400 transition-all duration-300 group-hover:text-[#c1591c] group-hover:scale-110">
                {item.icon}
              </div>
              <h3 className="text-[12px] sm:text-[15px] font-bold mt-2 sm:mt-4 text-gray-800 text-center">
                {item.title}
              </h3>
              <p className="text-[9px] sm:text-[11px] font-medium text-gray-500 mt-1 text-center">
                {item.desc}
              </p>
            </div>
          ))}
        </div>

        {/* Separator */}
        <div className="h-px w-full bg-gradient-to-r from-transparent via-gray-200 to-transparent" />

        {/* ================= BOTTOM MAIN SECTION ================= */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-10 py-8 sm:py-12">
          {/* 1. CONTACT */}
          <div className="flex flex-col gap-4 sm:gap-5 lg:border-r lg:pr-8 border-gray-200/60">
            <h3 className="text-[16px] sm:text-[18px] font-bold text-gray-800 uppercase tracking-wide">
              Contact Us
            </h3>
            <p className="text-[13px] sm:text-[14px] leading-relaxed text-gray-600">
              Healthy One Gram – Mega Health Store <br />
              Rajasthan Centre of Advanced Technology (R-CAT)
            </p>

            <a
              href="mailto:support@healthyonegram.com"
              className="text-[14px] font-semibold text-gray-600 hover:text-[#c1591c] transition-colors"
            >
              support@healthyonegram.com
            </a>

            <a
              href="tel:+918619641968"
              className="text-[18px] text-[#c1591c] font-bold tracking-tight hover:underline"
            >
              (+91) 8619-641-968
            </a>

            {/* --- ONLINE CHAT (WhatsApp) --- */}
            <Link
              href="https://wa.me/918619641968?text=Hello%20Healthy%20One%20Gram,%20I%20need%20help%20with..."
              target="_blank"
              className="group flex items-center gap-4 mt-2 p-3 rounded-xl border shadow-sm transition-all duration-300 hover:border-[#c1591c] hover:shadow-md hover:-translate-y-1"
              style={{
                backgroundColor:
                  "color-mix(in srgb, var(--flavor-card-bg, #fffbf5) 60%, transparent)",
                borderColor:
                  "color-mix(in srgb, var(--flavor-color, #f5c16c) 30%, transparent)",
              }}
            >
              <IoChatboxOutline className="text-[32px] text-[#c1591c] transition-transform group-hover:scale-110" />
              <span className="text-[13px] font-bold text-gray-700 leading-tight">
                Online Chat <br />
                <span className="font-normal text-gray-500 group-hover:text-[#c1591c] transition-colors">
                  Click to chat on WhatsApp
                </span>
              </span>
            </Link>
          </div>

          {/* 2. PRODUCTS */}
          <div>
            <h3 className="text-[16px] sm:text-[18px] font-bold text-gray-800 uppercase tracking-wide mb-4 sm:mb-6">
              Products
            </h3>
            <ul className="space-y-3">
              {[
                { name: "Prices drop", link: "/products?sort=price-low" },
                { name: "New products", link: "/products?filter=new" },
                { name: "Best sales", link: "/products?filter=bestseller" },
                { name: "All Products", link: "/products" },
                { name: "Contact us", link: "/contact" },
                { name: "Our Blogs", link: "/blogs" },
              ].map((item, i) => (
                <li key={i}>
                  <Link
                    href={item.link}
                    className="group flex items-center text-[14px] font-medium text-gray-500 hover:text-[#c1591c] transition-all duration-300"
                  >
                    <span className="w-0 h-0.5 bg-[#c1591c] mr-0 transition-all duration-300 group-hover:w-3 group-hover:mr-2 rounded-full"></span>
                    {item.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* 3. COMPANY */}
          <div>
            <h3 className="text-[16px] sm:text-[18px] font-bold text-gray-800 uppercase tracking-wide mb-4 sm:mb-6">
              Our Company
            </h3>
            <ul className="space-y-3">
              {[
                { name: "Delivery", link: "/delivery" },
                { name: "Legal Notice", link: "/legal" },
                { name: "Terms and Conditions", link: "/terms" },
                { name: "About Us", link: "/about-us" },
                { name: "Secure payment", link: "/secure-payment" },
                { name: "Login", link: "/login" },
              ].map((item, i) => (
                <li key={i}>
                  <Link
                    href={item.link}
                    className="group flex items-center text-[14px] font-medium text-gray-500 hover:text-[#c1591c] transition-all duration-300"
                  >
                    <span className="w-0 h-0.5 bg-[#c1591c] mr-0 transition-all duration-300 group-hover:w-3 group-hover:mr-2 rounded-full"></span>
                    {item.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* 4. NEWSLETTER */}
          <div>
            <h3 className="text-[16px] sm:text-[18px] font-bold text-gray-800 uppercase tracking-wide mb-3 sm:mb-4">
              Subscribe to newsletter
            </h3>
            <p className="text-[12px] sm:text-[13px] text-gray-500 mb-4 sm:mb-6 leading-relaxed">
              Subscribe to our latest newsletter to get news about special
              discounts.
            </p>

            <form
              onSubmit={handleSubscribe}
              className="flex flex-col gap-3 w-full"
            >
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Your e-mail address"
                required
                disabled={status === "loading" || status === "success"}
                className="w-full h-[48px] px-5 rounded-full border backdrop-blur-sm outline-none text-sm text-gray-700 placeholder-gray-400 focus:border-[#c1591c] focus:ring-2 focus:ring-[#c1591c]/10 transition-all duration-300 disabled:opacity-70 disabled:cursor-not-allowed"
                style={{
                  backgroundColor:
                    "color-mix(in srgb, var(--flavor-card-bg, #fffbf5) 60%, transparent)",
                  borderColor:
                    "color-mix(in srgb, var(--flavor-color, #f5c16c) 30%, transparent)",
                }}
              />

              <button
                type="submit"
                disabled={status === "loading" || status === "success"}
                className={`h-[48px] w-full rounded-full text-white text-[14px] font-semibold tracking-wide transition-all duration-300 active:scale-95 flex items-center justify-center ${status === "success" ? "bg-green-600 hover:bg-green-700" : "bg-gray-900 hover:bg-[#c1591c] hover:shadow-lg"} disabled:opacity-80 disabled:cursor-not-allowed`}
              >
                {status === "loading" ? (
                  <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : status === "success" ? (
                  "SUBSCRIBED!"
                ) : (
                  "SUBSCRIBE"
                )}
              </button>
            </form>

            {status === "success" && (
              <p className="text-green-600 text-xs mt-3 font-medium animate-pulse">
                Thank you for subscribing!
              </p>
            )}
          </div>
        </div>

        {/* Separator */}
        <div className="h-px w-full bg-gradient-to-r from-transparent via-gray-200 to-transparent" />

        {/* ================= BOTTOM STRIP (SOCIAL ICONS) ================= */}
        <div className="py-6 sm:py-8 flex flex-col md:flex-row items-center justify-between gap-4 sm:gap-6">
          {/* Social Icons */}
          <div className="flex gap-2 sm:gap-3">
            {[
              { Icon: FaFacebook, link: "https://facebook.com/healthyonegram" },
              {
                Icon: AiOutlineYoutube,
                link: "https://youtube.com/@healthyonegram",
              },
              {
                Icon: FaInstagram,
                link: "https://instagram.com/healthyonegram",
              },
            ].map(({ Icon, link }, i) => (
              <Link
                key={i}
                href={link}
                target="_blank"
                rel="noopener noreferrer"
                className="w-[38px] h-[38px] sm:w-[42px] sm:h-[42px] flex items-center justify-center rounded-full border text-gray-500 shadow-sm transition-all duration-300 hover:bg-[#c1591c] hover:text-white hover:border-[#c1591c] hover:-translate-y-1 hover:shadow-md"
                style={{
                  backgroundColor: "var(--flavor-card-bg, #fffbf5)",
                  borderColor:
                    "color-mix(in srgb, var(--flavor-color, #f5c16c) 30%, transparent)",
                }}
              >
                <Icon size={18} />
              </Link>
            ))}
          </div>

          <p className="text-center text-[11px] sm:text-[13px] font-medium text-gray-400">
            © 2026 Healthyonegram. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
