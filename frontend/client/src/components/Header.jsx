"use client";

import { useCart } from "@/context/CartContext";
import { MyContext } from "@/context/ThemeProvider";
import { useWishlist } from "@/context/WishlistContext";
import { fetchDataFromApi, postData } from "@/utils/api";
import cookies from "js-cookie";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { FaRegHeart, FaUser } from "react-icons/fa";
import { IoCartOutline, IoCloseOutline, IoMenuOutline } from "react-icons/io5";
import {
  MdInfoOutline,
  MdLogout,
  MdOutlineLocationOn,
  MdOutlineSettings,
  MdOutlineShoppingBag,
} from "react-icons/md";
import Search from "./Search";

const resolveUserPhotoUrl = (photo, apiUrl) => {
  const value = String(photo || "").trim();
  if (!value) return "";

  if (value.startsWith("data:")) return value;
  if (value.startsWith("http://") || value.startsWith("https://")) {
    return value;
  }
  if (value.startsWith("/uploads/")) return `${apiUrl}${value}`;
  if (value.startsWith("uploads/")) return `${apiUrl}/${value}`;
  if (value.startsWith("/")) return value;
  return value;
};

const normalizeIdentity = (value) => String(value || "").trim().toLowerCase();
const getStoredAuthToken = () => {
  if (typeof window === "undefined") return cookies.get("accessToken") || "";
  return (
    cookies.get("accessToken") ||
    localStorage.getItem("accessToken") ||
    localStorage.getItem("token") ||
    ""
  );
};
const decodeJwtPayload = (token) => {
  try {
    const tokenPart = String(token || "").split(".")[1];
    if (!tokenPart) return null;
    const normalized = tokenPart
      .replace(/-/g, "+")
      .replace(/_/g, "/")
      .padEnd(Math.ceil(tokenPart.length / 4) * 4, "=");
    return JSON.parse(atob(normalized));
  } catch {
    return null;
  }
};
const getPhotoStorageKey = (emailValue) => {
  const normalizedEmail = normalizeIdentity(emailValue);
  return normalizedEmail ? `userPhoto:${normalizedEmail}` : "";
};
const getPhotoRemovedKey = (emailValue) => {
  const normalizedEmail = normalizeIdentity(emailValue);
  return normalizedEmail ? `userPhotoRemoved:${normalizedEmail}` : "";
};
const getStoredPhotoForUser = (emailValue) => {
  if (typeof window === "undefined") return "";
  const key = getPhotoStorageKey(emailValue);
  return key ? localStorage.getItem(key) || "" : "";
};
const isPhotoRemovalOverride = (emailValue) => {
  if (typeof window === "undefined") return false;
  const key = getPhotoRemovedKey(emailValue);
  return key ? localStorage.getItem(key) === "1" : false;
};
const clearStoredPhotoForUser = (emailValue) => {
  if (typeof window === "undefined") return;
  const key = getPhotoStorageKey(emailValue);
  const removedKey = getPhotoRemovedKey(emailValue);
  if (key) localStorage.removeItem(key);
  if (removedKey) localStorage.removeItem(removedKey);
  // Cleanup old global key to prevent cross-account leakage.
  localStorage.removeItem("userPhoto");
};
const DEFAULT_COIN_SUMMARY = {
  total_coins: 0,
  usable_coins: 0,
  rupee_value: 0,
  expiring_soon: 0,
  membership_bonus_multiplier: 1,
  settings: {
    coinsPerRupee: 0,
    redeemRate: 0,
    maxRedeemPercentage: 0,
    expiryDays: 0,
  },
};

const Header = () => {
  const pathname = usePathname();
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
  const [coinSummary, setCoinSummary] = useState(DEFAULT_COIN_SUMMARY);
  const [animatedCoins, setAnimatedCoins] = useState(0);
  const [coinPanelAnchor, setCoinPanelAnchor] = useState(null);
  const [coinInfoOpen, setCoinInfoOpen] = useState(false);
  const [coinLoading, setCoinLoading] = useState(false);
  const coinDesktopRef = useRef(null);
  const coinMobileRef = useRef(null);
  const coinAnimationRef = useRef(0);
  const router = useRouter();
  const API_URL = (
    process.env.NEXT_PUBLIC_APP_API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "http://localhost:8000"
  )
    .trim()
    .replace(/\/+$/, "");
  const context = useContext(MyContext);
  const { cartCount } = useCart();
  const { wishlistCount } = useWishlist();

  const open = Boolean(anchorEl);
  const isCoinPanelOpen = Boolean(coinPanelAnchor);

  // ============ MOBILE MENU: Auto-close on scroll ============
  useEffect(() => {
    if (!mobileMenuOpen) return;
    let lastScrollY = window.scrollY;
    const handleScrollClose = () => {
      const currentScrollY = window.scrollY;
      if (Math.abs(currentScrollY - lastScrollY) > 10) {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener("scroll", handleScrollClose, { passive: true });
    return () => window.removeEventListener("scroll", handleScrollClose);
  }, [mobileMenuOpen]);

  // Function to check login status
  const checkLoginStatus = () => {
    const accessToken = getStoredAuthToken();
    const userEmailCookie =
      cookies.get("userEmail") ||
      (typeof window !== "undefined" ? localStorage.getItem("userEmail") : "") ||
      "";
    const userNameCookie =
      cookies.get("userName") ||
      (typeof window !== "undefined" ? localStorage.getItem("userName") : "") ||
      "";
    const userPhotoCookie =
      cookies.get("userPhoto") ||
      (typeof window !== "undefined" ? localStorage.getItem("userPhoto") : "") ||
      "";
    const removalOverride = isPhotoRemovalOverride(userEmailCookie);
    const userPhotoLocal = getStoredPhotoForUser(userEmailCookie);
    const resolvedUserPhoto = resolveUserPhotoUrl(
      removalOverride ? "" : userPhotoCookie || userPhotoLocal,
      API_URL,
    );

    let tokenValid = false;
    if (accessToken) {
      const payload = decodeJwtPayload(accessToken);
      tokenValid = Boolean(payload?.exp && payload.exp * 1000 > Date.now());
    }

    if (tokenValid) {
      setIsLoggedIn(true);
      setUserEmail(userEmailCookie || "user@example.com");
      setUserName(userNameCookie || userEmailCookie?.split("@")[0] || "User");
      setUserPhoto(resolvedUserPhoto);
    } else {
      setIsLoggedIn(false);
      setUserEmail("");
      setUserName("");
      setUserPhoto("");
    }
  };

  const fetchCoinSummary = useCallback(async () => {
    if (!getStoredAuthToken()) {
      setCoinSummary(DEFAULT_COIN_SUMMARY);
      setCoinLoading(false);
      return;
    }

    setCoinLoading(true);
    try {
      const response = await fetchDataFromApi("/api/user/coins-summary");
      if (response?.success && response?.data) {
        setCoinSummary({
          ...DEFAULT_COIN_SUMMARY,
          ...response.data,
          settings: {
            ...DEFAULT_COIN_SUMMARY.settings,
            ...(response.data.settings || {}),
          },
        });
      }
    } catch (error) {
      // Keep header resilient if coin service is unavailable.
    } finally {
      setCoinLoading(false);
    }
  }, []);

  const closeCoinPanel = useCallback(() => {
    setCoinPanelAnchor(null);
  }, []);

  const handleCoinButtonClick = useCallback(
    (anchor) => {
      if (!isLoggedIn) {
        router.push("/login");
        return;
      }
      setCoinPanelAnchor((prev) => (prev === anchor ? null : anchor));
    },
    [isLoggedIn, router],
  );

  const handleCoinInfoClick = useCallback(
    (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (!isLoggedIn) {
        router.push("/login");
        return;
      }
      setCoinInfoOpen(true);
    },
    [isLoggedIn, router],
  );

  const handleViewCoinHistory = useCallback(() => {
    closeCoinPanel();
    router.push("/coin-history");
  }, [closeCoinPanel, router]);

  useEffect(() => {
    setIsMounted(true);
    checkLoginStatus();
    const timer = setTimeout(() => checkLoginStatus(), 150);

    const handleLoginSuccess = () => checkLoginStatus();
    const handleStorageChange = () => checkLoginStatus();

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

  useEffect(() => {
    if (!isLoggedIn) {
      setCoinSummary(DEFAULT_COIN_SUMMARY);
      setAnimatedCoins(0);
      coinAnimationRef.current = 0;
      setCoinPanelAnchor(null);
      return;
    }
    fetchCoinSummary();
  }, [isLoggedIn, fetchCoinSummary]);

  useEffect(() => {
    if (!isLoggedIn) return;

    const refresh = () => fetchCoinSummary();
    const poll = window.setInterval(refresh, 45000);
    window.addEventListener("focus", refresh);
    window.addEventListener("coinBalanceRefresh", refresh);

    return () => {
      window.clearInterval(poll);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("coinBalanceRefresh", refresh);
    };
  }, [isLoggedIn, fetchCoinSummary]);

  useEffect(() => {
    const target = isLoggedIn
      ? Math.max(
          Math.floor(
            Number(coinSummary?.usable_coins ?? coinSummary?.total_coins ?? 0),
          ),
          0,
        )
      : 0;
    const start = coinAnimationRef.current;

    if (start === target) {
      setAnimatedCoins(target);
      return;
    }

    const duration = 650;
    const startAt = performance.now();
    let rafId = 0;

    const step = (now) => {
      const progress = Math.min((now - startAt) / duration, 1);
      const next = Math.round(start + (target - start) * progress);
      coinAnimationRef.current = next;
      setAnimatedCoins(next);
      if (progress < 1) {
        rafId = requestAnimationFrame(step);
      }
    };

    rafId = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [coinSummary?.usable_coins, coinSummary?.total_coins, isLoggedIn]);

  useEffect(() => {
    if (!isCoinPanelOpen) return;

    const activeRef =
      coinPanelAnchor === "mobile" ? coinMobileRef : coinDesktopRef;

    const handleOutsideClick = (event) => {
      if (activeRef?.current?.contains(event.target)) return;
      setCoinPanelAnchor(null);
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [coinPanelAnchor, isCoinPanelOpen]);

  useEffect(() => {
    setCoinPanelAnchor(null);
  }, [pathname]);

  // Scroll detection
  useEffect(() => {
    let lastScrollY = window.scrollY;
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      setScrolled(currentScrollY > 20);
      if (currentScrollY > 100) {
        if (currentScrollY > lastScrollY) {
          setHideHeader(true);
          setMobileMenuOpen(false);
        } else if (currentScrollY < lastScrollY - 10) {
          setHideHeader(false);
        }
      } else {
        setHideHeader(false);
      }
      lastScrollY = currentScrollY;
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleClick = (event) => setAnchorEl(event.currentTarget);
  const handleClose = () => setAnchorEl(null);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await postData("/api/user/logout", {});
      context?.setIsLogin?.(false);
      cookies.remove("accessToken");
      cookies.remove("refreshToken");
      cookies.remove("userEmail");
      cookies.remove("userName");
      cookies.remove("userPhoto");
      if (typeof window !== "undefined") {
        localStorage.removeItem("accessToken");
        localStorage.removeItem("token");
        localStorage.removeItem("refreshToken");
        localStorage.removeItem("userEmail");
        localStorage.removeItem("userName");
        localStorage.removeItem("userPhoto");
      }
      clearStoredPhotoForUser(userEmail || cookies.get("userEmail"));
      context?.setUser?.({});
      setIsLoggedIn(false);
      setAnchorEl(null);
      setCoinPanelAnchor(null);
      context?.alertBox("success", "Logged out successfully");
      router.push("/logout-confirmation");
    } catch (error) {
      console.error("Logout error:", error);
      cookies.remove("accessToken");
      cookies.remove("refreshToken");
      cookies.remove("userEmail");
      cookies.remove("userName");
      cookies.remove("userPhoto");
      if (typeof window !== "undefined") {
        localStorage.removeItem("accessToken");
        localStorage.removeItem("token");
        localStorage.removeItem("refreshToken");
        localStorage.removeItem("userEmail");
        localStorage.removeItem("userName");
        localStorage.removeItem("userPhoto");
      }
      clearStoredPhotoForUser(userEmail || cookies.get("userEmail"));
      setIsLoggedIn(false);
      setAnchorEl(null);
      setCoinPanelAnchor(null);
      context?.alertBox("success", "Logged out successfully");
      router.push("/logout-confirmation");
    } finally {
      setIsLoggingOut(false);
    }
  };

  const mobileNavItems = [
    { name: "Home", href: "/", icon: "🏠" },
    { name: "Products", href: "/products", icon: "🛍️" },
    { name: "Membership", href: "/membership", icon: "💎" },
    { name: "Blogs", href: "/blogs", icon: "📝" },
    { name: "About Us", href: "/about-us", icon: "✨" },
  ];
  const coinCount = Math.max(Math.floor(Number(animatedCoins || 0)), 0);
  const coinSettings = {
    ...DEFAULT_COIN_SUMMARY.settings,
    ...(coinSummary?.settings || {}),
  };
  const coinTooltip = isLoggedIn
    ? `You have ${coinCount} coins`
    : "Login to earn coins";

  const renderCoinDropdown = (anchor) => (
    <div
      className={`${anchor === "mobile"
        ? "fixed left-1/2 -translate-x-1/2 z-[100] top-[calc(var(--header-height,100px)+18px)] w-[min(92vw,300px)]"
        : "absolute right-0 z-40 mt-3 w-[280px]"
        } rounded-2xl border shadow-xl`}
      style={{
        backgroundColor: "var(--flavor-card-bg, #fffbf5)",
        borderColor:
          "color-mix(in srgb, var(--flavor-color, #a7f3d0) 25%, transparent)",
      }}
    >
      <div className="px-4 py-3 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
            Coin Wallet
          </p>
          <button
            type="button"
            onClick={handleCoinInfoClick}
            className="p-1 rounded-full hover:bg-gray-100 text-gray-500"
            aria-label="Coin info"
          >
            <MdInfoOutline size={16} />
          </button>
        </div>
        <p className="mt-1 text-xl font-bold text-gray-900">🪙 {coinCount}</p>
      </div>
      <div className="px-4 py-3 space-y-2 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-gray-600">Value in INR</span>
          <span className="font-semibold text-gray-900">
            ₹{Number(coinSummary?.rupee_value || 0).toFixed(2)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-gray-600">Expiring soon</span>
          <span className="font-semibold text-amber-700">
            {Math.max(Math.floor(Number(coinSummary?.expiring_soon || 0)), 0)}{" "}
            coins
          </span>
        </div>
        <div className="text-[11px] text-gray-500">
          1 coin = ₹{Number(coinSettings.redeemRate || 0).toFixed(2)}
        </div>
      </div>
      <div className="px-4 pb-4">
        <button
          type="button"
          onClick={handleViewCoinHistory}
          className="w-full rounded-xl py-2.5 text-sm font-semibold text-white hover:brightness-110 transition"
          style={{
            background:
              "linear-gradient(135deg, var(--flavor-color), var(--flavor-hover))",
          }}
        >
          View Coin History
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Main Header Container */}
      <div
        className={`fixed top-0 left-0 right-0 w-full z-50 transition-all duration-300 backdrop-blur-xl ${scrolled ? "shadow-md border-b" : "border-b border-transparent"
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
          className={`w-full transition-all duration-300 overflow-hidden md:overflow-visible ${scrolled
            ? "max-h-0 opacity-0 -mt-2 md:max-h-[220px] md:opacity-100 md:mt-0"
            : "max-h-[220px] opacity-100 mt-0"
            }`}
        >
          {/* Removed Decorative Top Line Gradient */}
          <div className="w-full px-3 sm:px-4 md:px-6 py-0.5">
            {/* === MOBILE TOP BAR (3-column grid for centered logo) === */}
            <div className="grid grid-cols-3 items-center md:hidden">
              {/* Left: Hamburger */}
              <div className="flex justify-start">
                <button
                  className="p-2 text-gray-700 hover:text-[var(--flavor-color)] transition-colors"
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  aria-label="Toggle menu"
                >
                  {mobileMenuOpen ? (
                    <IoCloseOutline size={26} />
                  ) : (
                    <IoMenuOutline size={26} />
                  )}
                </button>
              </div>

              {/* Center: Logo */}
              <div className="flex justify-center">
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
                      className="object-contain mix-blend-multiply w-[70px] sm:w-[90px]"
                      style={{ background: "transparent" }}
                    />
                  </div>
                </Link>
              </div>

              {/* Right: Action icons (mobile) */}
              <div className="flex justify-end items-center gap-2">
                <Link
                  href="/my-list"
                  className="relative p-1.5"
                  aria-label="Wishlist"
                >
                  {wishlistCount > 0 && (
                    <div
                      className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold w-4 h-4 flex items-center justify-center rounded-full"
                      style={{ boxShadow: "0 0 0 2px var(--flavor-card-bg, #fffbf5)" }}
                    >
                      {wishlistCount > 99 ? "99+" : wishlistCount}
                    </div>
                  )}
                  <FaRegHeart size={18} className="text-gray-600" />
                </Link>
                <Link
                  href="/cart"
                  className="relative p-1.5"
                  aria-label="Cart"
                >
                  {cartCount > 0 && (
                    <div
                      className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold w-4 h-4 flex items-center justify-center rounded-full"
                      style={{ boxShadow: "0 0 0 2px var(--flavor-card-bg, #fffbf5)" }}
                    >
                      {cartCount > 99 ? "99+" : cartCount}
                    </div>
                  )}
                  <IoCartOutline size={22} className="text-gray-700" />
                </Link>
              </div>
            </div>

            {/* === DESKTOP TOP BAR (unchanged flex layout) === */}
            <div className="hidden md:flex items-center justify-between gap-8">
              {/* LOGO */}
              <div className="shrink-0 md:pr-6 flex items-center h-full">
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
                      className="object-contain mix-blend-multiply w-[120px]"
                      style={{ background: "transparent" }}
                    />
                  </div>
                </Link>
              </div>
              {/* NAVIGATION + SEARCHBAR in one line */}
              <div className="hidden md:flex flex-1 items-center gap-6">
                <nav className="flex items-center gap-5">
                  {[
                    { name: "Home", href: "/" },
                    { name: "Products", href: "/products" },
                    { name: "Membership", href: "/membership" },
                    { name: "Blogs", href: "/blogs" },
                    { name: "About Us", href: "/about-us" },
                  ].map((item) => {
                    const isActive =
                      item.href === "/"
                        ? pathname === "/"
                        : pathname.startsWith(item.href);
                    return (
                      <Link
                        key={item.name}
                        href={item.href}
                        // Keep nav labels like "About Us" on one line under browser zoom
                        className={`whitespace-nowrap flex-shrink-0 font-semibold text-base px-2 py-1 rounded-lg transition ${isActive
                          ? "text-[var(--flavor-color)] bg-[var(--flavor-glass)]"
                          : "text-gray-700 hover:bg-[var(--flavor-glass)] hover:text-[var(--flavor-color)]"
                          }`}
                      >
                        {item.name}
                      </Link>
                    );
                  })}
                </nav>
                <div className="w-full max-w-2xl relative group">
                  <div className="absolute -inset-1 bg-[var(--flavor-glass)] rounded-full blur opacity-0 group-hover:opacity-100 transition duration-500"></div>
                  <div
                    className="relative shadow-sm border rounded-full overflow-hidden transition-all duration-300 focus-within:shadow-md"
                    style={{
                      backgroundColor: "var(--flavor-card-bg, #fffbf5)",
                      borderColor:
                        "color-mix(in srgb, var(--flavor-color, #a7f3d0) 30%, transparent)",
                    }}
                  >
                    <div className="h-12 flex items-center">
                      <Search />
                    </div>
                  </div>
                </div>
              </div>
              {/* ACTIONS (Icons + Login Button) */}
              <div className="flex items-center justify-end shrink-0 gap-4">
                <div className="relative" ref={coinDesktopRef}>
                  <button
                    id="coin-balance-anchor"
                    type="button"
                    onClick={() => handleCoinButtonClick("desktop")}
                    className="relative group px-2.5 py-1.5 rounded-lg border transition-all duration-200 hover:shadow-sm hover:scale-[1.02]"
                    aria-label="Coins"
                    title={coinTooltip}
                    style={{
                      backgroundColor:
                        "color-mix(in srgb, var(--flavor-color, #f5c16c) 14%, var(--flavor-card-bg, #fffbf5))",
                      borderColor:
                        "color-mix(in srgb, var(--flavor-color, #f5c16c) 36%, transparent)",
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-[22px] leading-none">🪙</span>
                      <span className="text-[15px] font-bold text-amber-700 min-w-8 text-left leading-none">
                        {coinLoading && isLoggedIn
                          ? "..."
                          : coinCount > 9999
                            ? "9999+"
                            : coinCount}
                      </span>
                    </div>
                    <span
                      className="absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-1 text-xs font-medium text-gray-700 backdrop-blur-lg rounded-md shadow-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap pointer-events-none"
                      style={{
                        backgroundColor:
                          "color-mix(in srgb, var(--flavor-card-bg, #fffbf5) 90%, transparent)",
                        border:
                          "1px solid color-mix(in srgb, var(--flavor-color, #a7f3d0) 20%, transparent)",
                      }}
                    >
                      {coinTooltip}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={handleCoinInfoClick}
                    className="absolute -right-1 -top-0.5 p-0.5 rounded-full bg-white/90 border border-gray-200 text-gray-500 hover:text-[var(--flavor-color)]"
                    aria-label="Coin info"
                    title="Coin info"
                  >
                    <MdInfoOutline size={12} />
                  </button>
                  {isCoinPanelOpen && coinPanelAnchor === "desktop" && isLoggedIn
                    ? renderCoinDropdown("desktop")
                    : null}
                </div>
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
                      className="absolute -top-1.5 -right-1.5 bg-[#EF4444] text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full shadow-sm"
                      style={{
                        boxShadow: "0 0 0 2px var(--flavor-card-bg, #fffbf5)",
                      }}
                    >
                      {cartCount > 99 ? "99+" : cartCount}
                    </div>
                  )}
                  <IoCartOutline
                    size={26}
                    className="text-gray-700 group-hover:text-[var(--flavor-color)] transition-colors"
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
                      className="hover:text-[var(--flavor-color)] transition-colors"
                    >
                      Login
                    </Link>
                    <span className="text-gray-300 mx-1.5">|</span>
                    <Link
                      href="/register"
                      className="hover:text-[var(--flavor-color)] transition-colors"
                    >
                      Register
                    </Link>
                  </div>
                ) : (
                  <div className="relative">
                    <button
                      onClick={handleClick}
                      className="hidden md:flex items-center gap-2.5 px-4 py-2 rounded-full border hover:shadow-md transition-all duration-200 group"
                      style={{ background: `linear-gradient(to right, color-mix(in srgb, var(--flavor-color) 10%, transparent), color-mix(in srgb, var(--flavor-hover) 10%, transparent))`, borderColor: `color-mix(in srgb, var(--flavor-color) 30%, transparent)` }}
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
                        className={`flex items-center justify-center w-8 h-8 rounded-full text-white ${userPhoto ? "hidden" : "flex"}`}
                        style={{ background: `linear-gradient(to bottom right, var(--flavor-color), var(--flavor-hover))` }}
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

                    {/* Menu */}
                    {open && (
                      <>
                        <div
                          className="fixed inset-0 z-30"
                          onClick={handleClose}
                        />
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
                              className="flex items-center gap-3 px-4 py-2.5 text-gray-700 hover:bg-gray-50 hover:text-[var(--flavor-color)] transition-colors group"
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
                              className="flex items-center gap-3 px-4 py-2.5 text-gray-700 hover:bg-gray-50 hover:text-[var(--flavor-color)] transition-colors group"
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
                              className="flex items-center gap-3 px-4 py-2.5 text-gray-700 hover:bg-gray-50 hover:text-[var(--flavor-color)] transition-colors group"
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
                              className="flex items-center gap-3 px-4 py-2.5 text-gray-700 hover:bg-gray-50 hover:text-[var(--flavor-color)] transition-colors group"
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
          className={`md:hidden px-3 sm:px-4 pb-1.5 ${scrolled ? "pt-3" : "pt-1.5"}`}
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
          className={`md:hidden fixed inset-0 bg-black/40 backdrop-blur-[2px] transition-opacity duration-300 ${mobileMenuOpen
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
            }`}
          style={{ zIndex: 9997 }}
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />

        {/* Dropdown Panel - Mobile only */}
        <div
          className={`md:hidden fixed left-0 right-0 transition-all duration-300 ease-out ${mobileMenuOpen
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
              {mobileNavItems.map((item) => {
                const isActive =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`flex items-center gap-3 mx-2 px-4 py-3 rounded-xl text-[15px] font-semibold transition-all duration-200 ${isActive
                      ? "text-[var(--flavor-color)] bg-[var(--flavor-glass)]"
                      : "text-gray-700 hover:bg-[var(--flavor-glass)] hover:text-[var(--flavor-color)] active:bg-[var(--flavor-glass)]"
                      }`}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <span className="text-lg w-6 text-center">{item.icon}</span>
                    <span>{item.name}</span>
                  </Link>
                );
              })}

              <button
                type="button"
                className="w-[calc(100%-1rem)] mx-2 mt-1 flex items-center justify-between px-4 py-3 rounded-xl text-[15px] font-semibold text-gray-700 hover:bg-[var(--flavor-glass)] hover:text-[var(--flavor-color)] active:bg-[var(--flavor-glass)] transition-all duration-200"
                style={{
                  border: "1px solid color-mix(in srgb, var(--flavor-color, #f5c16c) 24%, transparent)",
                  background:
                    "color-mix(in srgb, var(--flavor-color, #f5c16c) 8%, var(--flavor-card-bg, #fffbf5))",
                }}
                onClick={() => {
                  setMobileMenuOpen(false);
                  if (!isLoggedIn) {
                    router.push("/login");
                    return;
                  }
                  router.push("/coin-history");
                }}
                ref={coinMobileRef}
                id="coin-balance-anchor-mobile"
                aria-label="Coin wallet"
                title={coinTooltip}
              >
                <span className="inline-flex items-center gap-3">
                  <span className="text-lg w-6 text-center">🪙</span>
                  <span>Coin Wallet</span>
                </span>
                <span className="text-[14px] font-bold text-amber-700">
                  {coinLoading && isLoggedIn
                    ? "..."
                    : coinCount > 999
                      ? "999+"
                      : coinCount}
                </span>
              </button>
            </nav>

            {/* Divider */}
            <div className="mx-4 border-t border-gray-200/60" />

            {/* Auth Section */}
            <div className="p-3">
              {!isLoggedIn ? (
                <div className="flex gap-2">
                  <Link
                    href="/login"
                    className="flex-1 py-2.5 text-center text-[14px] font-bold rounded-xl active:scale-[0.98] transition-all duration-200"
                    style={{ color: 'var(--flavor-color)', border: '2px solid var(--flavor-color)' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--flavor-color)'; e.currentTarget.style.color = 'white'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--flavor-color)'; }}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Login
                  </Link>
                  <Link
                    href="/register"
                    className="flex-1 py-2.5 text-center text-[14px] font-bold text-white rounded-xl active:scale-[0.98] transition-all duration-200"
                    style={{
                      background:
                        "linear-gradient(135deg, var(--flavor-color) 0%, var(--flavor-hover) 100%)",
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
                      className="w-10 h-10 rounded-full object-cover ring-2"
                      style={{ '--tw-ring-color': 'color-mix(in srgb, var(--flavor-color) 30%, transparent)' }}
                    />
                  ) : (
                    <div
                      className="flex items-center justify-center w-10 h-10 rounded-full text-white"
                      style={{
                        background:
                          "linear-gradient(135deg, var(--flavor-color) 0%, var(--flavor-hover) 100%)",
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
                    className="px-3 py-1.5 text-xs font-bold rounded-lg transition-all"
                    style={{ color: 'var(--flavor-color)', border: '1px solid color-mix(in srgb, var(--flavor-color) 50%, transparent)' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--flavor-color)'; e.currentTarget.style.color = 'white'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--flavor-color)'; }}
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

      {coinInfoOpen && (
        <div className="fixed inset-0 z-[120]">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
            onClick={() => setCoinInfoOpen(false)}
          />
          <div className="absolute inset-0 flex items-center justify-center px-4">
            <div
              className="w-full max-w-md rounded-2xl border shadow-2xl p-5"
              style={{
                backgroundColor: "var(--flavor-card-bg, #fffbf5)",
                borderColor:
                  "color-mix(in srgb, var(--flavor-color, #a7f3d0) 30%, transparent)",
              }}
            >
              <div className="flex items-start justify-between gap-4">
                <h3 className="text-lg font-bold text-gray-900">
                  Coin System Rules
                </h3>
                <button
                  type="button"
                  onClick={() => setCoinInfoOpen(false)}
                  className="text-gray-500 hover:text-gray-700"
                  aria-label="Close coin info"
                >
                  <IoCloseOutline size={22} />
                </button>
              </div>
              <div className="mt-4 space-y-3 text-sm text-gray-700">
                <p>
                  You earn{" "}
                  <span className="font-semibold">
                    {Number(coinSettings.coinsPerRupee || 0).toFixed(2)}
                  </span>{" "}
                  coins for every ₹1 order value.
                </p>
                <p>
                  Redeem value is{" "}
                  <span className="font-semibold">
                    ₹{Number(coinSettings.redeemRate || 0).toFixed(2)}
                  </span>{" "}
                  per coin.
                </p>
                <p>
                  Coins can only be redeemed on membership subscriptions.
                </p>
                <p>
                  Coins expire after{" "}
                  <span className="font-semibold">
                    {Math.max(Math.floor(Number(coinSettings.expiryDays || 0)), 0)}
                  </span>{" "}
                  days.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCoinInfoOpen(false)}
                className="mt-5 w-full rounded-xl py-2.5 text-sm font-semibold text-white hover:brightness-110 transition"
                style={{
                  background:
                    "linear-gradient(135deg, var(--flavor-color), var(--flavor-hover))",
                }}
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Search Bar - Shows when header is hidden */}
      <div
        className={`fixed left-0 right-0 z-50 transition-all duration-300 ${hideHeader
          ? "translate-y-0 opacity-100"
          : "-translate-y-full opacity-0 pointer-events-none"
          }`}
        style={{ top: 0 }}
      >
        <div className="backdrop-blur-xl bg-white/95 shadow-lg border-b border-gray-200/50 px-3 sm:px-4 md:px-6 py-2.5">
          <div className="max-w-2xl mx-auto">
            <div
              className="rounded-full border overflow-hidden"
              style={{
                backgroundColor: "#fff",
                borderColor: "#e5e5e5",
              }}
            >
              <div className="h-10 flex items-center">
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
