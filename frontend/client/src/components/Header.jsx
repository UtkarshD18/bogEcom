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
import { IoCartOutline } from "react-icons/io5";
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
  const router = useRouter();
  const context = useContext(MyContext);
  const { cartCount } = useCart();
  const { wishlistCount } = useWishlist();

  const open = Boolean(anchorEl);

  // Function to check login status
  const checkLoginStatus = () => {
    const accessToken = cookies.get("accessToken");
    const userEmailCookie = cookies.get("userEmail");
    const userNameCookie = cookies.get("userName");
    const userPhotoCookie = cookies.get("userPhoto");

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

  // Detect scroll to adjust glass intensity
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
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
      const response = await postData("/api/user/logout", {});
      console.log("Logout response:", response);

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
      router.push("/login");
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
      router.push("/login");
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    // Header Container
    <div
      className={`fixed top-0 left-0 right-0 w-full z-50 transition-all duration-300 ${
        scrolled
          ? "bg-white/80 backdrop-blur-xl shadow-md border-b border-white/20"
          : "bg-white/60 backdrop-blur-lg border-b border-transparent"
      }`}
    >
      {/* ================= TOP HEADER ================= */}
      <div className="w-full">
        {/* Removed Decorative Top Line Gradient */}
        <div className="w-full px-4 md:px-6 py-3">
          <div className="flex items-center justify-between gap-8">
            {/* LOGO */}
            <div className="shrink-0 pr-8">
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
                <div className="relative transition-transform duration-300 group-hover:scale-105">
                  <Image
                    src="/logo.png"
                    width={200}
                    height={65}
                    alt="Buy One Gram"
                    priority
                    className="object-contain"
                  />
                </div>
              </Link>
            </div>
            {/* NAVIGATION + SEARCHBAR in one line */}
            <div className="flex flex-1 items-center gap-8">
              <nav className="flex gap-6">
                <Link
                  href="/"
                  className="font-semibold text-base text-[#c1591c] px-2 py-1 rounded-lg hover:bg-[#f5c16c]/20 transition"
                >
                  Home
                </Link>
                <Link
                  href="/products"
                  className="font-semibold text-base text-gray-700 px-2 py-1 rounded-lg hover:bg-[#f5c16c]/20 transition"
                >
                  Products
                </Link>
                <Link
                  href="/membership"
                  className="font-semibold text-base text-gray-700 px-2 py-1 rounded-lg hover:bg-[#f5c16c]/20 transition"
                >
                  Membership
                </Link>
                <Link
                  href="/blogs"
                  className="font-semibold text-base text-gray-700 px-2 py-1 rounded-lg hover:bg-[#f5c16c]/20 transition"
                >
                  Blogs
                </Link>
                <Link
                  href="/about-us"
                  className="font-semibold text-base text-gray-700 px-2 py-1 rounded-lg hover:bg-[#f5c16c]/20 transition"
                >
                  About Us
                </Link>
              </nav>
              <div className="w-full max-w-md relative group">
                <div className="absolute -inset-1 bg-linear-to-r from-[#c1591c]/10 to-[#d06a2d]/10 rounded-full blur opacity-0 group-hover:opacity-100 transition duration-500"></div>
                <div className="relative bg-white shadow-sm border border-gray-200 rounded-full overflow-hidden transition-all duration-300 focus-within:shadow-md focus-within:border-[#c1591c]/50">
                  <div className="h-11 flex items-center">
                    <Search />
                  </div>
                </div>
              </div>
            </div>
            {/* ACTIONS (Icons + Login Button) */}
            <div className="flex items-center justify-end shrink-0 gap-6">
              {/* Wishlist Icon */}
              <Link
                href="/my-list"
                className="relative group p-2 transition-transform hover:scale-110"
              >
                {wishlistCount > 0 && (
                  <div className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full shadow-sm ring-2 ring-white">
                    {wishlistCount > 99 ? "99+" : wishlistCount}
                  </div>
                )}
                <FaRegHeart
                  size={22}
                  className="text-gray-600 group-hover:text-red-500 transition-colors"
                />
              </Link>
              {/* Cart Icon */}
              <Link
                href="/cart"
                className="relative group p-2 transition-transform hover:scale-110"
              >
                {cartCount > 0 && (
                  <div className="absolute -top-1.5 -right-1.5 bg-[#c1591c] text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full shadow-sm ring-2 ring-white">
                    {cartCount > 99 ? "99+" : cartCount}
                  </div>
                )}
                <IoCartOutline
                  size={26}
                  className="text-gray-700 group-hover:text-[#c1591c] transition-colors"
                />
              </Link>
              {/* Login / Register OR User Profile */}
              {!isMounted ? (
                <div className="hidden md:flex items-center gap-1 text-sm font-semibold text-neutral-700 bg-white/60 px-5 py-2.5 rounded-full border border-gray-200/50 shadow-sm ml-2">
                  <span className="text-gray-400">...</span>
                </div>
              ) : !isLoggedIn ? (
                <div className="hidden md:flex items-center gap-1 text-sm font-semibold text-neutral-700 bg-white/60 px-5 py-2.5 rounded-full border border-gray-200/50 shadow-sm ml-2 hover:shadow-md transition-all">
                  <Link
                    href="/login"
                    className="hover:text-[#c1591c] transition-colors"
                  >
                    Login
                  </Link>
                  <span className="text-gray-300 mx-1.5">|</span>
                  <Link
                    href="/register"
                    className="hover:text-[#c1591c] transition-colors"
                  >
                    Register
                  </Link>
                </div>
              ) : (
                <div className="relative">
                  <button
                    onClick={handleClick}
                    className="hidden md:flex items-center gap-2.5 px-4 py-2 rounded-full bg-linear-to-r from-[#c1591c]/10 to-[#d06a2d]/10 border border-[#c1591c]/30 hover:border-[#c1591c]/60 hover:shadow-md transition-all duration-200 group"
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
                      className={`flex items-center justify-center w-8 h-8 rounded-full bg-linear-to-br from-[#c1591c] to-[#d06a2d] text-white ${userPhoto ? "hidden" : "flex"}`}
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
                      <div className="absolute right-0 mt-3 w-64 bg-white rounded-xl shadow-xl border border-gray-200 py-2 z-40 animate-in fade-in slide-in-from-top-2">
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
                            className="flex items-center gap-3 px-4 py-2.5 text-gray-700 hover:bg-gray-50 hover:text-[#c1591c] transition-colors group"
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
                            className="flex items-center gap-3 px-4 py-2.5 text-gray-700 hover:bg-gray-50 hover:text-[#c1591c] transition-colors group"
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
                            className="flex items-center gap-3 px-4 py-2.5 text-gray-700 hover:bg-gray-50 hover:text-[#c1591c] transition-colors group"
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
                            className="flex items-center gap-3 px-4 py-2.5 text-gray-700 hover:bg-gray-50 hover:text-[#c1591c] transition-colors group"
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

          {/* Mobile Search (Below header on small screens) */}
          <div className="md:hidden mt-3">
            <div className="bg-white rounded-full shadow-sm border border-gray-200 overflow-hidden h-10 flex items-center">
              <Search />
            </div>
          </div>
        </div>
      </div>

      {/* NAVBAR removed as redundant. Navigation is handled in header. */}
    </div>
  );
};

export default Header;
