"use client";

import { useCart } from "@/context/CartContext";
import { MyContext } from "@/context/ThemeProvider";
import { useWishlist } from "@/context/WishlistContext";
import { postData } from "@/utils/api";
import cookies from "js-cookie";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useContext, useEffect, useState } from "react";
import { FaRegHeart, FaUser } from "react-icons/fa";
import { IoCartOutline, IoCloseOutline, IoMenuOutline } from "react-icons/io5";
import {
  MdLogout,
  MdOutlineLocationOn,
  MdOutlineSettings,
  MdOutlineShoppingBag,
} from "react-icons/md";
import Search from "./Search";

const Header = () => {
  const [scrolled, setScrolled] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [userName, setUserName] = useState("");
  const [userPhoto, setUserPhoto] = useState("");
  const [anchorEl, setAnchorEl] = useState(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [hideHeader, setHideHeader] = useState(false);
  const router = useRouter();
  const context = useContext(MyContext);
  const { cartCount } = useCart();
  const { wishlistCount } = useWishlist();

  const open = Boolean(anchorEl);

  // ============ MOBILE MENU: Auto-close on scroll ============
  useEffect(() => {
    if (!mobileMenuOpen) return;

    let lastScrollY = window.scrollY;

    const handleScrollClose = () => {
      const currentScrollY = window.scrollY;
      // Close menu if user scrolls more than 10px in any direction
      if (Math.abs(currentScrollY - lastScrollY) > 10) {
        setMobileMenuOpen(false);
      }
    };

    // Add listener with passive for better performance
    window.addEventListener("scroll", handleScrollClose, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScrollClose);
    };
  }, [mobileMenuOpen]);

  // Function to check login status
  const checkLoginStatus = () => {
    const accessToken = cookies.get("accessToken");
    const userEmailCookie = cookies.get("userEmail");
    const userNameCookie = cookies.get("userName");
    const userPhotoCookie = cookies.get("userPhoto");

    console.log("Header checkLoginStatus:", {
      accessToken: accessToken ? "present" : "missing",
      userEmail: userEmailCookie,
      userName: userNameCookie,
    });

    if (accessToken) {
      setIsLoggedIn(true);
      setUserEmail(userEmailCookie || "user@example.com");
      setUserName(userNameCookie || userEmailCookie?.split("@")[0] || "User");
      setUserPhoto(userPhotoCookie || "");
    } else {
      setIsLoggedIn(false);
      setUserEmail("");
      setUserName("");
      setUserPhoto("");
    }
  };

  // Check login status on mount and when route changes
  useEffect(() => {
    setIsMounted(true);
    // Check immediately
    checkLoginStatus();

    // Also check after a small delay to catch redirects from login
    const timer = setTimeout(() => {
      checkLoginStatus();
    }, 150);

    // Listen for custom login event
    const handleLoginSuccess = () => {
      console.log("Login success event received in Header");
      // Force immediate state update
      const accessToken = cookies.get("accessToken");
      if (accessToken) {
        setIsLoggedIn(true);
        setUserEmail(cookies.get("userEmail") || "user@example.com");
        setUserName(cookies.get("userName") || "User");
        setUserPhoto(cookies.get("userPhoto") || "");
      }
    };

    // Listen for storage events (cross-tab sync)
    const handleStorageChange = () => {
      checkLoginStatus();
    };

    window.addEventListener("loginSuccess", handleLoginSuccess);
    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("focus", checkLoginStatus);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("loginSuccess", handleLoginSuccess);
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("focus", checkLoginStatus);
    };
  }, []);

  // Detect scroll to adjust glass intensity and hide/show header
  useEffect(() => {
    let lastScrollY = window.scrollY;

    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      // Set scrolled state
      setScrolled(currentScrollY > 20);

      // Hide header when scrolling down past threshold
      if (currentScrollY > 100) {
        // Scrolling down - hide header
        if (currentScrollY > lastScrollY) {
          setHideHeader(true);
          setMobileMenuOpen(false); // Close mobile menu if open
        }
        // Scrolling up - show header
        else if (currentScrollY < lastScrollY - 10) {
          setHideHeader(false);
        }
      } else {
        // Near top - always show header
        setHideHeader(false);
      }

      lastScrollY = currentScrollY;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await postData("/api/user/logout", {});

      // Clear cookies and user data regardless of API response
      context?.setIsLogin?.(false);
      cookies.remove("accessToken");
      cookies.remove("refreshToken");
      cookies.remove("userEmail");
      cookies.remove("userName");
      cookies.remove("userPhoto");
      context?.setUser?.({});
      setIsLoggedIn(false);
      setAnchorEl(null);

      context?.alertBox("success", "Logged out successfully");
      router.push("/logout-confirmation");
    } catch (error) {
      console.error("Logout error:", error);
      // Logout locally even if API fails
      cookies.remove("accessToken");
      cookies.remove("refreshToken");
      cookies.remove("userEmail");
      cookies.remove("userName");
      cookies.remove("userPhoto");
      setIsLoggedIn(false);
      setAnchorEl(null);
      context?.alertBox("success", "Logged out successfully");
      router.push("/logout-confirmation");
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <>
      {/* Main Header Container */}
      <div
        className={`fixed top-0 left-0 right-0 w-full z-50 transition-all duration-300 backdrop-blur-xl ${
          scrolled ? "shadow-md border-b" : "border-b border-transparent"
        } ${hideHeader ? "-translate-y-full" : "translate-y-0"}`}
        style={{
          backgroundColor: scrolled
            ? `color-mix(in srgb, var(--flavor-card-bg, #fffbf5) 85%, transparent)`
            : `color-mix(in srgb, var(--flavor-card-bg, #fffbf5) 70%, transparent)`,
          borderColor: scrolled
            ? `color-mix(in srgb, var(--flavor-color, #a7f3d0) 20%, transparent)`
            : "transparent",
        }}
      >
        {/* ================= TOP HEADER ================= */}
        <div
          className={`w-full transition-all duration-300 overflow-hidden md:overflow-visible ${
            scrolled
              ? "max-h-0 opacity-0 -mt-2 md:max-h-[220px] md:opacity-100 md:mt-0"
              : "max-h-[220px] opacity-100 mt-0"
          }`}
        >
          {/* Removed Decorative Top Line Gradient */}
          <div className="w-full px-3 sm:px-4 md:px-6 py-1">
            <div className="flex items-center justify-between gap-4 md:gap-8">
              {/* Mobile Menu Button */}
              <button
                className="md:hidden p-2 text-gray-700 hover:text-[#059669] transition-colors"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                aria-label="Toggle menu"
              >
                {mobileMenuOpen ? (
                  <IoCloseOutline size={26} />
                ) : (
                  <IoMenuOutline size={26} />
                )}
              </button>

              {/* LOGO */}
              <div className="shrink-0 md:pr-6 flex items-center">
                <Link
                  href="/"
                  className="block group"
                  onClick={(e) => {
                    if (window.location.pathname === "/") {
                      e.preventDefault();
                      window.location.reload();
                    }
                  }}
                >
                  <div className="relative transition-transform duration-300 group-hover:scale-105 flex items-center">
                    <Image
                      src="/logo.png"
                      width={120}
                      height={36}
                      alt="Buy One Gram"
                      priority
                      className="object-contain mix-blend-multiply w-[70px] sm:w-[90px] md:w-[120px]"
                      style={{ background: "transparent" }}
                    />
                  </div>
                </Link>
              </div>
              {/* NAVIGATION + SEARCHBAR in one line */}
              <div className="hidden md:flex flex-1 items-center gap-6">
                <nav className="flex items-center gap-5">
                  <Link
                    href="/"
                    className="font-semibold text-base text-[#059669] px-2 py-1 rounded-lg hover:bg-[#a7f3d0]/20 transition"
                  >
                    Home
                  </Link>
                  <Link
                    href="/products"
                    className="font-semibold text-base text-gray-700 px-2 py-1 rounded-lg hover:bg-[#a7f3d0]/20 transition"
                  >
                    Products
                  </Link>
                  <Link
                    href="/membership"
                    className="font-semibold text-base text-gray-700 px-2 py-1 rounded-lg hover:bg-[#a7f3d0]/20 transition"
                  >
                    Membership
                  </Link>
                  <Link
                    href="/blogs"
                    className="font-semibold text-base text-gray-700 px-2 py-1 rounded-lg hover:bg-[#a7f3d0]/20 transition"
                  >
                    Blogs
                  </Link>
                  <Link
                    href="/about-us"
                    className="font-semibold text-base text-gray-700 px-2 py-1 rounded-lg hover:bg-[#a7f3d0]/20 transition"
                  >
                    About Us
                  </Link>
                </nav>
                <div className="w-full max-w-sm relative group">
                  <div className="absolute -inset-1 bg-linear-to-r from-[#059669]/10 to-[#10b981]/10 rounded-full blur opacity-0 group-hover:opacity-100 transition duration-500"></div>
                  <div
                    className="relative shadow-sm border rounded-full overflow-hidden transition-all duration-300 focus-within:shadow-md"
                    style={{
                      backgroundColor: "var(--flavor-card-bg, #fffbf5)",
                      borderColor:
                        "color-mix(in srgb, var(--flavor-color, #a7f3d0) 30%, transparent)",
                    }}
                  >
                    <div className="h-10 flex items-center">
                      <Search />
                    </div>
                  </div>
                </div>
              </div>
              {/* ACTIONS (Icons + Login Button) */}
              <div className="flex items-center justify-end shrink-0 gap-5">
                {/* Wishlist Icon */}
                <Link
                  href="/my-list"
                  className="relative group p-2 transition-transform hover:scale-110"
                  aria-label="Wishlist"
                >
                  {wishlistCount > 0 && (
                    <div
                      className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full shadow-sm"
                      style={{
                        boxShadow: "0 0 0 2px var(--flavor-card-bg, #fffbf5)",
                      }}
                    >
                      {wishlistCount > 99 ? "99+" : wishlistCount}
                    </div>
                  )}
                  <FaRegHeart
                    size={22}
                    className="text-gray-600 group-hover:text-red-500 transition-colors"
                  />
                  {/* Custom Tooltip */}
                  <span
                    className="absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-1 text-xs font-medium text-gray-700 backdrop-blur-lg rounded-md shadow-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap pointer-events-none"
                    style={{
                      backgroundColor:
                        "color-mix(in srgb, var(--flavor-card-bg, #fffbf5) 90%, transparent)",
                      border:
                        "1px solid color-mix(in srgb, var(--flavor-color, #a7f3d0) 20%, transparent)",
                    }}
                  >
                    Wishlist
                  </span>
                </Link>
                {/* Cart Icon */}
                <Link
                  href="/cart"
                  className="relative group p-2 transition-transform hover:scale-110"
                  aria-label="Cart"
                >
                  {cartCount > 0 && (
                    <div
                      className="absolute -top-1.5 -right-1.5 bg-[#059669] text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full shadow-sm"
                      style={{
                        boxShadow: "0 0 0 2px var(--flavor-card-bg, #fffbf5)",
                      }}
                    >
                      {cartCount > 99 ? "99+" : cartCount}
                    </div>
                  )}
                  <IoCartOutline
                    size={26}
                    className="text-gray-700 group-hover:text-[#059669] transition-colors"
                  />
                  {/* Custom Tooltip */}
                  <span
                    className="absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-1 text-xs font-medium text-gray-700 backdrop-blur-lg rounded-md shadow-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap pointer-events-none"
                    style={{
                      backgroundColor:
                        "color-mix(in srgb, var(--flavor-card-bg, #fffbf5) 90%, transparent)",
                      border:
                        "1px solid color-mix(in srgb, var(--flavor-color, #a7f3d0) 20%, transparent)",
                    }}
                  >
                    Cart
                  </span>
                </Link>
                {/* Login / Register OR User Profile */}
                {!isMounted ? (
                  <div
                    className="hidden md:flex items-center gap-1 text-sm font-semibold text-neutral-700 px-5 py-2.5 rounded-full shadow-sm ml-2"
                    style={{
                      backgroundColor:
                        "color-mix(in srgb, var(--flavor-card-bg, #fffbf5) 70%, transparent)",
                      border:
                        "1px solid color-mix(in srgb, var(--flavor-color, #a7f3d0) 20%, transparent)",
                    }}
                  >
                    <span className="text-gray-400">...</span>
                  </div>
                ) : !isLoggedIn ? (
                  <div
                    className="hidden md:flex items-center gap-1 text-sm font-semibold text-neutral-700 px-5 py-2.5 rounded-full shadow-sm ml-2 hover:shadow-md transition-all"
                    style={{
                      backgroundColor:
                        "color-mix(in srgb, var(--flavor-card-bg, #fffbf5) 70%, transparent)",
                      border:
                        "1px solid color-mix(in srgb, var(--flavor-color, #a7f3d0) 20%, transparent)",
                    }}
                  >
                    <Link
                      href="/login"
                      className="hover:text-[#059669] transition-colors"
                    >
                      Login
                    </Link>
                    <span className="text-gray-300 mx-1.5">|</span>
                    <Link
                      href="/register"
                      className="hover:text-[#059669] transition-colors"
                    >
                      Register
                    </Link>
                  </div>
                ) : (
                  <div className="relative">
                    <button
                      onClick={handleClick}
                      className="hidden md:flex items-center gap-2.5 px-4 py-2 rounded-full bg-linear-to-r from-[#059669]/10 to-[#10b981]/10 border border-[#059669]/30 hover:border-[#059669]/60 hover:shadow-md transition-all duration-200 group"
                    >
                      {userPhoto ? (
                        <img
                          src={userPhoto}
                          alt="Profile"
                          className="w-8 h-8 rounded-full object-cover"
                          onError={(e) => {
                            e.target.style.display = "none";
                            e.target.nextElementSibling.style.display = "flex";
                          }}
                        />
                      ) : null}
                      <div
                        className={`flex items-center justify-center w-8 h-8 rounded-full bg-linear-to-br from-[#059669] to-[#10b981] text-white ${userPhoto ? "hidden" : "flex"}`}
                      >
                        <FaUser size={14} />
                      </div>
                      <div className="flex flex-col items-start">
                        <span className="text-xs font-medium text-gray-500 leading-none">
                          Profile
                        </span>
                        <span className="text-sm font-semibold text-gray-800 truncate max-w-25">
                          {userName}
                        </span>
                      </div>
                    </button>

                    {/* Dropdown Menu - Production Ready */}
                    {open && (
                      <>
                        {/* Backdrop */}
                        <div
                          className="fixed inset-0 z-30"
                          onClick={handleClose}
                        />

                        {/* Menu */}
                        <div
                          className="absolute right-0 mt-3 w-64 rounded-xl shadow-xl border py-2 z-40 animate-in fade-in slide-in-from-top-2"
                          style={{
                            backgroundColor: "var(--flavor-card-bg, #fffbf5)",
                            borderColor:
                              "color-mix(in srgb, var(--flavor-color, #a7f3d0) 30%, transparent)",
                          }}
                        >
                          {/* User Info Header */}
                          <div className="px-4 py-3 border-b border-gray-100 bg-linear-to-r from-gray-50 to-transparent">
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                              Account
                            </p>
                            <p className="text-sm font-semibold text-gray-900 truncate mt-1">
                              {userName}
                            </p>
                            <p className="text-xs text-gray-600 truncate">
                              {userEmail}
                            </p>
                          </div>

                          {/* Menu Items */}
                          <div className="py-2">
                            <Link
                              href="/my-account"
                              className="flex items-center gap-3 px-4 py-2.5 text-gray-700 hover:bg-gray-50 hover:text-[#059669] transition-colors group"
                              onClick={handleClose}
                            >
                              <FaUser
                                size={16}
                                className="group-hover:scale-110 transition-transform"
                              />
                              <span className="font-medium">My Account</span>
                            </Link>

                            <Link
                              href="/my-orders"
                              className="flex items-center gap-3 px-4 py-2.5 text-gray-700 hover:bg-gray-50 hover:text-[#059669] transition-colors group"
                              onClick={handleClose}
                            >
                              <MdOutlineShoppingBag
                                size={18}
                                className="group-hover:scale-110 transition-transform"
                              />
                              <span className="font-medium">My Orders</span>
                            </Link>

                            <Link
                              href="/address"
                              className="flex items-center gap-3 px-4 py-2.5 text-gray-700 hover:bg-gray-50 hover:text-[#059669] transition-colors group"
                              onClick={handleClose}
                            >
                              <MdOutlineLocationOn
                                size={18}
                                className="group-hover:scale-110 transition-transform"
                              />
                              <span className="font-medium">Addresses</span>
                            </Link>

                            <Link
                              href="/settings"
                              className="flex items-center gap-3 px-4 py-2.5 text-gray-700 hover:bg-gray-50 hover:text-[#059669] transition-colors group"
                              onClick={handleClose}
                            >
                              <MdOutlineSettings
                                size={18}
                                className="group-hover:scale-110 transition-transform"
                              />
                              <span className="font-medium">Settings</span>
                            </Link>

                          </div>

                          {/* Divider */}
                          <div className="border-t border-gray-100 my-1" />

                          {/* Logout Button */}
                          <button
                            onClick={handleLogout}
                            disabled={isLoggingOut}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-red-600 hover:bg-red-50 hover:cursor-pointer transition-colors group font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <MdLogout
                              size={18}
                              className="group-hover:scale-110 transition-transform"
                            />
                            <span>
                              {isLoggingOut ? "Logging out..." : "Logout"}
                            </span>
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Search (Below header on small screens) */}
        <div
          className={`md:hidden px-3 sm:px-4 pb-2 ${scrolled ? "pt-2" : "pt-0"}`}
        >
          <div
            className="rounded-full border overflow-hidden h-10 flex items-center"
            style={{
              backgroundColor: "#fff",
              borderColor: "#e5e5e5",
              boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
            }}
          >
            <Search />
          </div>
        </div>

        {/* ============ MOBILE DROPDOWN MENU ============ */}
        {/* Backdrop - Mobile only */}
        <div
          className={`md:hidden fixed inset-0 bg-black/40 backdrop-blur-[2px] transition-opacity duration-300 ${
            mobileMenuOpen
              ? "opacity-100 pointer-events-auto"
              : "opacity-0 pointer-events-none"
          }`}
          style={{ zIndex: 9997 }}
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />

        {/* Dropdown Panel - Mobile only */}
        <div
          className={`md:hidden fixed left-0 right-0 transition-all duration-300 ease-out ${
            mobileMenuOpen
              ? "translate-y-0 opacity-100 pointer-events-auto"
              : "-translate-y-4 opacity-0 pointer-events-none"
          }`}
          style={{
            top: "calc(var(--header-height, 100px) - 8px)",
            zIndex: 9998,
          }}
        >
          <div
            className="mx-3 rounded-2xl shadow-xl border overflow-hidden"
            style={{
              backgroundColor: "rgba(255, 251, 245, 0.98)",
              borderColor: "rgba(245, 193, 108, 0.3)",
              boxShadow:
                "0 10px 40px rgba(0, 0, 0, 0.12), 0 4px 12px rgba(193, 89, 28, 0.08)",
            }}
          >
            {/* Navigation Links */}
            <nav className="py-2">
              {[
                { name: "Home", href: "/", icon: "🏠" },
                { name: "Products", href: "/products", icon: "🛒" },
                { name: "Membership", href: "/membership", icon: "⭐" },
                { name: "Blogs", href: "/blogs", icon: "📝" },
                { name: "About Us", href: "/about-us", icon: "ℹ️" },
              ].map((item, index) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className="flex items-center gap-3 mx-2 px-4 py-3 rounded-xl text-[15px] font-semibold text-gray-700 hover:bg-[#a7f3d0]/15 hover:text-[#059669] active:bg-[#a7f3d0]/25 transition-all duration-200"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <span className="text-lg w-6 text-center">{item.icon}</span>
                  <span>{item.name}</span>
                </Link>
              ))}
            </nav>

            {/* Divider */}
            <div className="mx-4 border-t border-gray-200/60" />

            {/* Auth Section */}
            <div className="p-3">
              {!isLoggedIn ? (
                <div className="flex gap-2">
                  <Link
                    href="/login"
                    className="flex-1 py-2.5 text-center text-[14px] font-bold text-[#059669] border-2 border-[#059669] rounded-xl hover:bg-[#059669] hover:text-white active:scale-[0.98] transition-all duration-200"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Login
                  </Link>
                  <Link
                    href="/register"
                    className="flex-1 py-2.5 text-center text-[14px] font-bold text-white rounded-xl active:scale-[0.98] transition-all duration-200"
                    style={{
                      background:
                        "linear-gradient(135deg, #059669 0%, #10b981 100%)",
                    }}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Register
                  </Link>
                </div>
              ) : (
                <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50/80">
                  {userPhoto ? (
                    <img
                      src={userPhoto}
                      alt="Profile"
                      className="w-10 h-10 rounded-full object-cover ring-2 ring-[#a7f3d0]/50"
                    />
                  ) : (
                    <div
                      className="flex items-center justify-center w-10 h-10 rounded-full text-white"
                      style={{
                        background:
                          "linear-gradient(135deg, #059669 0%, #10b981 100%)",
                      }}
                    >
                      <FaUser size={14} />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-bold text-gray-900 truncate">
                      {userName}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {userEmail}
                    </p>
                  </div>
                  <Link
                    href="/my-account"
                    className="px-3 py-1.5 text-xs font-bold text-[#059669] border border-[#059669]/50 rounded-lg hover:bg-[#059669] hover:text-white transition-all"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Account
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Floating Search Bar - Shows when header is hidden */}
      <div
        className={`fixed left-0 right-0 z-50 transition-all duration-300 ${
          hideHeader
            ? "translate-y-0 opacity-100"
            : "-translate-y-full opacity-0 pointer-events-none"
        }`}
        style={{ top: 0 }}
      >
        <div className="backdrop-blur-xl bg-white/95 shadow-lg border-b border-gray-200/50 px-3 sm:px-4 md:px-6 py-2.5">
          <div className="max-w-2xl mx-auto">
            <div
              className="rounded-full border overflow-hidden shadow-sm"
              style={{
                backgroundColor: "#fff",
                borderColor:
                  "color-mix(in srgb, var(--flavor-color, #a7f3d0) 30%, transparent)",
              }}
            >
              <div className="h-11 flex items-center">
                <Search />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Header;
