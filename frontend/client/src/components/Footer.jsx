"use client";

import { API_BASE_URL, postData } from "@/utils/api";
import { motion } from "framer-motion";
import Link from "next/link";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { AiOutlineYoutube } from "react-icons/ai";
import { BiSupport } from "react-icons/bi";
import { BsWallet2 } from "react-icons/bs";
import { FaFacebook, FaInstagram, FaLinkedin } from "react-icons/fa";
import { FaXTwitter } from "react-icons/fa6";
import { IoLocationSharp } from "react-icons/io5";
import { LiaGiftSolid, LiaShippingFastSolid } from "react-icons/lia";

const API_URL = API_BASE_URL;

const Footer = () => {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState(null);
  const [message, setMessage] = useState("");
  const [policyLinks, setPolicyLinks] = useState({
    terms: { name: "Terms & Conditions", link: "/policy/terms-and-conditions" },
  });

  const handleSubscribe = async (e) => {
    e.preventDefault();
    if (!email) return;
    setStatus("loading");
    setMessage("");
    try {
      const response = await postData("/api/newsletter/subscribe", {
        email,
        source: "footer",
      });
      if (response.success) {
        setStatus("success");
        setMessage(response.message || "Thank you for subscribing!");
        setEmail("");
        toast.success(response.message || "Thank you for subscribing!");
      } else {
        setStatus("error");
        setMessage(
          response.message || "Failed to subscribe. Please try again.",
        );
        toast.error(
          response.message || "Failed to subscribe. Please try again.",
        );
      }
    } catch (error) {
      console.error("Newsletter subscription error:", error);
      setStatus("error");
      setMessage("Failed to subscribe. Please try again.");
      toast.error("Failed to subscribe. Please try again.");
    }
  };

  useEffect(() => {
    const fetchPolicyLinks = async () => {
      try {
        const response = await fetch(`${API_URL}/api/policies/public`);
        const data = await response.json();
        if (!data.success || !Array.isArray(data.data)) return;
        const policyBySlug = data.data.reduce((acc, policy) => {
          acc[policy.slug] = policy;
          return acc;
        }, {});
        setPolicyLinks({
          terms: policyBySlug["terms-and-conditions"]
            ? {
                name: policyBySlug["terms-and-conditions"].title,
                link: `/policy/${policyBySlug["terms-and-conditions"].slug}`,
              }
            : {
                name: "Terms & Conditions",
                link: "/policy/terms-and-conditions",
              },
        });
      } catch (error) {
        /* Silent fallback */
      }
    };
    fetchPolicyLinks();
  }, []);

  const features = [
    {
      icon: <LiaShippingFastSolid />,
      title: "Free Shipping",
      desc: "On Every Order",
      gradient: "linear-gradient(135deg, var(--primary), var(--flavor-hover))",
    },
    {
      icon: <BsWallet2 />,
      title: "100% Genuine",
      desc: "Quality Assured",
      gradient: "linear-gradient(135deg, #7c3aed, #a78bfa)",
    },
    {
      icon: <BsWallet2 />,
      title: "Secure Pay",
      desc: "Cards Accepted",
      gradient: "linear-gradient(135deg, #3b82f6, #60a5fa)",
    },
    {
      icon: <LiaGiftSolid />,
      title: "Special Gifts",
      desc: "First Order Perks",
      gradient: "linear-gradient(135deg, #ff6b9d, #ff9ec0)",
    },
    {
      icon: <BiSupport />,
      title: "24/7 Support",
      desc: "Always Here",
      gradient: "linear-gradient(135deg, #ffb020, #fcd34d)",
    },
  ];

  return (
    <footer
      className="site-footer relative overflow-hidden"
      style={{
        background: "linear-gradient(180deg, #0a0a0a 0%, #111827 100%)",
      }}
    >
      {/* Decorative mesh gradient overlay */}
      <div className="pointer-events-none absolute inset-0">
        <div
          className="absolute top-0 left-1/4 w-96 h-96 rounded-full blur-[120px] opacity-20"
          style={{ background: "var(--primary)" }}
        />
        <div
          className="absolute bottom-0 right-1/4 w-80 h-80 rounded-full blur-[120px] opacity-15"
          style={{ background: "#7c3aed" }}
        />
        <div
          className="absolute top-1/2 right-0 w-64 h-64 rounded-full blur-[100px] opacity-10"
          style={{ background: "#ff6b9d" }}
        />
      </div>

      <div className="container mx-auto px-4 sm:px-6 relative z-10">
        {/* ============ FEATURE CARDS ============ */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 py-10 sm:py-14">
          {features.map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              whileHover={{ y: -5, transition: { duration: 0.2 } }}
              whileTap={{ y: -3, scale: 0.97, transition: { duration: 0.15 } }}
              className="group flex flex-col items-center p-4 sm:p-6 rounded-2xl sm:rounded-3xl cursor-default active:bg-white/[0.08]"
              style={{
                background: "rgba(255, 255, 255, 0.04)",
                border: "1px solid rgba(255, 255, 255, 0.06)",
                backdropFilter: "blur(12px)",
              }}
            >
              <div
                className="w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center rounded-2xl text-white text-[22px] sm:text-[26px] transition-all duration-500 group-hover:scale-110 group-hover:shadow-lg"
                style={{ background: item.gradient }}
              >
                {item.icon}
              </div>
              <h3 className="text-[12px] sm:text-[14px] font-bold mt-3 sm:mt-4 text-white text-center">
                {item.title}
              </h3>
              <p className="text-[10px] sm:text-[11px] font-medium text-gray-500 mt-1 text-center">
                {item.desc}
              </p>
            </motion.div>
          ))}
        </div>

        {/* Separator */}
        <div
          className="h-px w-full"
          style={{
            background:
              "linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)",
          }}
        />

        {/* ============ MAIN FOOTER CONTENT ============ */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 sm:gap-10 py-10 sm:py-14">
          {/* 1. CONTACT */}
          {/* 1. CONTACT */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="flex flex-col gap-4 sm:gap-5 lg:border-r lg:pr-8 border-white/5"
          >
            <h3 className="text-[16px] sm:text-[18px] font-extrabold text-white uppercase tracking-[0.15em]">
              Contact Us
            </h3>
            <p className="text-[13px] sm:text-[14px] leading-relaxed text-gray-400">
              G-222, RIICO, sitapura industrial area, <br />
              tonk road Jaipur, rajasthan 302019
            </p>
            <a
              href="mailto:support@healthyonegram.com"
              className="text-[14px] font-semibold text-gray-400 hover:text-primary transition-colors duration-300"
            >
              support@healthyonegram.com
            </a>
            <a
              href="tel:+918619641968"
              className="text-[18px] font-extrabold tracking-tight hover:underline transition-colors"
              style={{ color: "var(--primary)" }}
            >
              (+91) 8619-641-968
            </a>

            {/* Map Card */}
            <Link
              href="https://maps.app.goo.gl/zbbCcKeTnX3GYPhZ8"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-4 mt-1 p-3.5 rounded-2xl transition-all duration-300 hover:-translate-y-1 active:-translate-y-0.5 active:bg-white/[0.08]"
              style={{
                background: "rgba(255, 255, 255, 0.04)",
                border: "1px solid rgba(255, 255, 255, 0.06)",
              }}
            >
              <IoLocationSharp
                className="text-[28px] transition-transform group-hover:scale-110 group-active:scale-110"
                style={{ color: "var(--primary)" }}
              />
              <span className="text-[13px] font-bold text-gray-300 leading-tight">
                View on Map <br />
                <span className="font-normal text-gray-500 group-hover:text-primary group-active:text-primary transition-colors">
                  Open in Google Maps
                </span>
              </span>
            </Link>

            {/* Contact Card */}
            <Link
              href="/contact"
              className="group flex items-center gap-4 p-3.5 rounded-2xl transition-all duration-300 hover:-translate-y-1 active:-translate-y-0.5 active:bg-white/[0.08]"
              style={{
                background: "rgba(255, 255, 255, 0.04)",
                border: "1px solid rgba(255, 255, 255, 0.06)",
              }}
            >
              <BiSupport
                className="text-[28px] transition-transform group-hover:scale-110 group-active:scale-110"
                style={{ color: "var(--primary)" }}
              />
              <span className="text-[13px] font-bold text-gray-300 leading-tight">
                Contact Us <br />
                <span className="font-normal text-gray-500 group-hover:text-primary group-active:text-primary transition-colors">
                  Open contact page
                </span>
              </span>
            </Link>
          </motion.div>

          {/* 2. PRODUCTS */}
          {/* 2. PRODUCTS */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <h3 className="text-[16px] sm:text-[18px] font-extrabold text-white uppercase tracking-[0.15em] mb-5 sm:mb-7">
              Products
            </h3>
            <ul className="space-y-3.5">
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
                    className="group flex items-center text-[14px] font-medium text-gray-500 hover:text-primary active:text-primary transition-all duration-300"
                  >
                    <span
                      className="w-0 h-0.5 mr-0 transition-all duration-300 group-hover:w-4 group-hover:mr-2.5 group-active:w-4 group-active:mr-2.5 rounded-full"
                      style={{
                        background:
                          "linear-gradient(90deg, var(--primary), var(--flavor-hover))",
                      }}
                    ></span>
                    {item.name}
                  </Link>
                </li>
              ))}
            </ul>
          </motion.div>

          {/* 3. COMPANY */}
          {/* 3. COMPANY */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            <h3 className="text-[16px] sm:text-[18px] font-extrabold text-white uppercase tracking-[0.15em] mb-5 sm:mb-7">
              Our Company
            </h3>
            <ul className="space-y-3.5">
              {[
                { name: "Login", link: "/login" },
                { name: "Collaborator Portal", link: "/affiliate/login" },
                { name: "Delivery", link: "/delivery" },
                { name: "Secure payment", link: "/secure-payment" },
                policyLinks.terms,
                { name: "Cancellation & Return", link: "/cancellation" },
                { name: "About Us", link: "/about-us" },
              ].map((item, i) => (
                <li key={i}>
                  <Link
                    href={item.link}
                    className="group flex items-center text-[14px] font-medium text-gray-500 hover:text-primary active:text-primary transition-all duration-300"
                  >
                    <span
                      className="w-0 h-0.5 mr-0 transition-all duration-300 group-hover:w-4 group-hover:mr-2.5 group-active:w-4 group-active:mr-2.5 rounded-full"
                      style={{
                        background:
                          "linear-gradient(90deg, var(--primary), var(--flavor-hover))",
                      }}
                    ></span>
                    {item.name}
                  </Link>
                </li>
              ))}
            </ul>
          </motion.div>

          {/* 4. NEWSLETTER */}
          {/* 4. NEWSLETTER */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            <h3 className="text-[16px] sm:text-[18px] font-extrabold text-white uppercase tracking-[0.15em] mb-3 sm:mb-4">
              Stay in the loop
            </h3>
            <p className="text-[12px] sm:text-[13px] text-gray-500 mb-5 sm:mb-6 leading-relaxed">
              Get the latest drops, deals & wellness tips. No spam, ever.
            </p>

            <form
              onSubmit={handleSubscribe}
              className="flex flex-col gap-3 w-full"
            >
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
                disabled={status === "loading" || status === "success"}
                className="w-full h-[48px] px-5 rounded-full outline-none text-sm text-white placeholder-gray-600 focus:ring-2 transition-all duration-300 disabled:opacity-70 disabled:cursor-not-allowed"
                style={{
                  background: "rgba(255, 255, 255, 0.06)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  focusRingColor: "var(--primary)",
                }}
              />
              <button
                type="submit"
                disabled={status === "loading" || status === "success"}
                className={`h-[48px] w-full rounded-full text-[14px] font-bold tracking-wide transition-all duration-400 active:scale-95 flex items-center justify-center disabled:opacity-80 disabled:cursor-not-allowed ${
                  status === "success"
                    ? ""
                    : "hover:shadow-lg hover:-translate-y-0.5"
                }`}
                style={{
                  background:
                    status === "success"
                      ? "linear-gradient(135deg, var(--primary), var(--flavor-hover))"
                      : "linear-gradient(135deg, var(--primary), var(--flavor-hover))",
                  color: "#0a0a0a",
                  boxShadow: "0 4px 20px rgba(0, 216, 158, 0.25)",
                }}
              >
                {status === "loading" ? (
                  <span className="w-5 h-5 border-2 border-[#0a0a0a]/20 border-t-[#0a0a0a] rounded-full animate-spin" />
                ) : status === "success" ? (
                  "✓ SUBSCRIBED!"
                ) : (
                  "SUBSCRIBE →"
                )}
              </button>
            </form>

            {status === "success" && (
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-primary text-xs mt-3 font-semibold"
              >
                {message || "Thank you for subscribing!"}
              </motion.p>
            )}
            {status === "error" && (
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-[#ff4757] text-xs mt-3 font-semibold"
              >
                {message || "Failed to subscribe. Please try again."}
              </motion.p>
            )}
          </motion.div>
        </div>

        {/* Separator */}
        <div
          className="h-px w-full"
          style={{
            background:
              "linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)",
          }}
        />

        {/* ============ BOTTOM BAR ============ */}
        <div className="py-6 sm:py-8 flex flex-col md:flex-row items-center justify-between gap-4 sm:gap-6">
          {/* Social Icons */}
          <div className="flex gap-2.5 sm:gap-3">
            {[
              {
                Icon: FaFacebook,
                link: "https://www.facebook.com/buyonegram/",
                hoverColor: "#1877F2",
              },
              {
                Icon: AiOutlineYoutube,
                link: "https://www.youtube.com/@buyonegram",
                hoverColor: "#FF0000",
              },
              {
                Icon: FaInstagram,
                link: "https://www.instagram.com/buyonegram/",
                hoverColor: "#E4405F",
              },
              {
                Icon: FaLinkedin,
                link: "https://www.linkedin.com/company/buy-one-gram-private-limited/",
                hoverColor: "#0A66C2",
              },
              {
                Icon: FaXTwitter,
                link: "https://x.com/buyonegram/",
                hoverColor: "#ffffff",
              },
            ].map(({ Icon, link, hoverColor }, i) => (
              <motion.a
                key={i}
                href={link}
                target="_blank"
                rel="noopener noreferrer"
                initial={{ opacity: 0, scale: 0 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.3, delay: i * 0.1 }}
                whileHover={{
                  y: -5,
                  scale: 1.1,
                  color: hoverColor,
                  borderColor: `${hoverColor}40`,
                  boxShadow: `0 8px 24px ${hoverColor}20`,
                  transition: { duration: 0.2 },
                }}
                whileTap={{
                  scale: 0.95,
                  color: hoverColor,
                  borderColor: `${hoverColor}40`,
                  boxShadow: `0 4px 15px ${hoverColor}20`,
                }}
                className="w-[40px] h-[40px] sm:w-[44px] sm:h-[44px] flex items-center justify-center rounded-full text-gray-500 transition-colors duration-300"
                style={{
                  background: "rgba(255, 255, 255, 0.05)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                }}
              >
                <Icon size={18} />
              </motion.a>
            ))}
          </div>

          <p className="text-center text-[11px] sm:text-[13px] font-medium text-gray-600">
            © 2026 Healthyonegram. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
