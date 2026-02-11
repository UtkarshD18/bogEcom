"use client";

import { useCart } from "@/context/CartContext";
import { MyContext } from "@/context/ThemeProvider";
import { useWishlist } from "@/context/WishlistContext";
import { postData } from "@/utils/api";
import cookies from "js-cookie";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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
    const router = useRouter();
    const context = useContext(MyContext);
    const { cartCount, setIsDrawerOpen } = useCart();
    const { wishlistCount } = useWishlist();

    const open = Boolean(anchorEl);

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
        const accessToken = cookies.get("accessToken");
        const userEmailCookie = cookies.get("userEmail");
        const userNameCookie = cookies.get("userName");
        const userPhotoCookie = cookies.get("userPhoto");

        let tokenValid = false;
        if (accessToken) {
            try {
                const payload = JSON.parse(atob(accessToken.split(".")[1]));
                tokenValid = payload.exp * 1000 > Date.now();
            } catch { }
        }

        if (tokenValid) {
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
            context?.setUser?.({});
            setIsLoggedIn(false);
            setAnchorEl(null);
            context?.alertBox("success", "Logged out successfully");
            router.push("/logout-confirmation");
        } catch (error) {
            console.error("Logout error:", error);
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

    const navItems = [
        { name: "Home", href: "/" },
        { name: "Products", href: "/products" },
        { name: "Membership", href: "/membership" },
        { name: "Blogs", href: "/blogs" },
        { name: "About Us", href: "/about-us" },
    ];

    const mobileNavItems = [
        { name: "Home", href: "/", icon: "🏠" },
        { name: "Products", href: "/products", icon: "🛍️" },
        { name: "Membership", href: "/membership", icon: "💎" },
        { name: "Blogs", href: "/blogs", icon: "📝" },
        { name: "About Us", href: "/about-us", icon: "✨" },
    ];

    return (
        <>
            {/* ============ MAIN HEADER ============ */}
            <div
                className={`fixed top-0 left-0 right-0 w-full z-50 transition-all duration-500 ${hideHeader ? "-translate-y-full" : "translate-y-0"
                    }`}
                style={{
                    backdropFilter: "blur(24px) saturate(180%)",
                    WebkitBackdropFilter: "blur(24px) saturate(180%)",
                    backgroundColor: scrolled
                        ? "rgba(255, 255, 255, 0.82)"
                        : "rgba(255, 255, 255, 0.65)",
                    borderBottom: scrolled
                        ? "1px solid rgba(0, 0, 0, 0.06)"
                        : "1px solid transparent",
                    boxShadow: scrolled
                        ? "0 4px 30px rgba(0, 0, 0, 0.04)"
                        : "none",
                }}
            >
                {/* ============ TOP HEADER ============ */}
                <div
                    className={`w-full transition-all duration-400 overflow-hidden md:overflow-visible ${scrolled
                        ? "max-h-0 opacity-0 -mt-2 md:max-h-[220px] md:opacity-100 md:mt-0"
                        : "max-h-[220px] opacity-100 mt-0"
                        }`}
                >
                    <div className="w-full px-3 sm:px-4 md:px-6 py-1.5">
                        <div className="flex items-center justify-between gap-4 md:gap-6">
                            {/* Mobile Menu Button */}
                            <button
                                className="md:hidden p-2 rounded-xl text-gray-600 hover:text-primary hover:bg-[var(--flavor-glass)] transition-all duration-300 active:scale-95"
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
                                    <div className="relative transition-transform duration-500 group-hover:scale-105 flex items-center">
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

                            {/* NAVIGATION + SEARCH */}
                            <div className="hidden md:flex flex-1 items-center gap-8 px-4">
                                {/* Pill-shaped navigation container */}
                                <nav
                                    className="flex items-center gap-1 px-1.5 py-1 rounded-full"
                                    style={{
                                        background: "rgba(0, 0, 0, 0.03)",
                                    }}
                                >
                                    {navItems.map((item) => {
                                        const isActive =
                                            item.href === "/"
                                                ? pathname === "/"
                                                : pathname.startsWith(item.href);
                                        return (
                                            <Link
                                                key={item.name}
                                                href={item.href}
                                                className={`relative font-semibold text-[13px] px-4 py-2 rounded-full transition-all duration-300 ${isActive
                                                    ? "text-white"
                                                    : "text-gray-500 hover:text-gray-900"
                                                    }`}
                                                style={
                                                    isActive
                                                        ? {
                                                            background: "linear-gradient(135deg, var(--primary), var(--flavor-hover))",
                                                            boxShadow: "0 2px 12px rgba(0, 216, 158, 0.25)",
                                                        }
                                                        : {}
                                                }
                                            >
                                                {item.name}
                                            </Link>
                                        );
                                    })}
                                </nav>

                                {/* Search Bar */}
                                <div className="w-full max-w-2xl relative group transition-all duration-500">
                                    <div
                                        className="relative overflow-hidden transition-all duration-300 focus-within:shadow-lg rounded-full"
                                        style={{
                                            background: "rgba(0, 0, 0, 0.03)",
                                            border: "1px solid rgba(0, 0, 0, 0.04)",
                                        }}
                                    >
                                        <div className="h-14 flex items-center">
                                            <Search placeholder="Search our premium peanut butter collections..." />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* ACTION ICONS */}
                            <div className="flex items-center justify-end shrink-0 gap-3">
                                {/* Wishlist Icon */}
                                <Link
                                    href="/my-list"
                                    className="relative group p-2.5 rounded-full transition-all duration-300 hover:bg-[#ff4757]/8 hover:scale-110 active:scale-95"
                                    aria-label="Wishlist"
                                >
                                    {wishlistCount > 0 && (
                                        <div
                                            className="absolute -top-0.5 -right-0.5 text-white text-[9px] font-bold w-[18px] h-[18px] flex items-center justify-center rounded-full animate-bounceIn"
                                            style={{
                                                background: "linear-gradient(135deg, #ff4757, #ff6b9d)",
                                                boxShadow: "0 2px 8px rgba(255, 71, 87, 0.4), 0 0 0 2px white",
                                            }}
                                        >
                                            {wishlistCount > 99 ? "99+" : wishlistCount}
                                        </div>
                                    )}
                                    <FaRegHeart
                                        size={20}
                                        className="text-gray-500 group-hover:text-[#ff4757] transition-colors duration-300"
                                    />
                                </Link>

                                {/* Cart Icon */}
                                <button
                                    type="button"
                                    className="relative group p-2.5 rounded-full transition-all duration-300 hover:bg-[var(--flavor-glass)] hover:scale-110 active:scale-95"
                                    aria-label="Cart"
                                    onClick={() => setIsDrawerOpen(true)}
                                >
                                    {cartCount > 0 && (
                                        <div
                                            className="absolute -top-0.5 -right-0.5 text-white text-[9px] font-bold w-[18px] h-[18px] flex items-center justify-center rounded-full animate-bounceIn"
                                            style={{
                                                background: "linear-gradient(135deg, var(--primary), var(--flavor-hover))",
                                                boxShadow: "0 2px 8px rgba(0, 216, 158, 0.4), 0 0 0 2px white",
                                            }}
                                        >
                                            {cartCount > 99 ? "99+" : cartCount}
                                        </div>
                                    )}
                                    <IoCartOutline
                                        size={24}
                                        className="text-gray-600 group-hover:text-primary transition-colors duration-300"
                                    />
                                </button>

                                {/* Login / Register OR User Profile */}
                                {!isMounted ? (
                                    <div className="hidden md:flex items-center gap-1 text-sm font-semibold text-neutral-400 px-5 py-2.5 rounded-full bg-gray-50">
                                        <span>...</span>
                                    </div>
                                ) : !isLoggedIn ? (
                                    <div
                                        className="hidden md:flex items-center gap-1.5 text-sm font-bold px-5 py-2.5 rounded-full transition-all duration-300 hover:shadow-lg active:scale-95"
                                        style={{
                                            background: "linear-gradient(135deg, var(--primary), var(--flavor-hover))",
                                            color: "#FFFFFF",
                                            boxShadow: "0 2px 12px rgba(0, 216, 158, 0.2)",
                                        }}
                                    >
                                        <Link href="/login" className="transition-colors">
                                            Login
                                        </Link>
                                        <span className="text-[#0a0a0a]/30 mx-1">|</span>
                                        <Link href="/register" className="transition-colors">
                                            Register
                                        </Link>
                                    </div>
                                ) : (
                                    <div className="relative">
                                        <button
                                            onClick={handleClick}
                                            className="hidden md:flex items-center gap-2.5 px-3 py-1.5 rounded-full transition-all duration-300 hover:shadow-lg active:scale-95 group"
                                            style={{
                                                background: "rgba(0, 0, 0, 0.03)",
                                                border: "1px solid rgba(0, 0, 0, 0.04)",
                                            }}
                                        >
                                            {userPhoto ? (
                                                <img
                                                    src={userPhoto}
                                                    alt="Profile"
                                                    className="w-8 h-8 rounded-full object-cover ring-2 ring-primary/30"
                                                    onError={(e) => {
                                                        e.target.style.display = "none";
                                                        e.target.nextElementSibling.style.display = "flex";
                                                    }}
                                                />
                                            ) : null}
                                            <div
                                                className={`flex items-center justify-center w-8 h-8 rounded-full text-white ${userPhoto ? "hidden" : "flex"
                                                    }`}
                                                style={{
                                                    background: "linear-gradient(135deg, var(--primary), var(--flavor-hover))",
                                                }}
                                            >
                                                <FaUser size={13} />
                                            </div>
                                            <div className="flex flex-col items-start">
                                                <span className="text-[10px] font-medium text-gray-400 leading-none">
                                                    Hey 👋
                                                </span>
                                                <span className="text-sm font-bold text-gray-800 truncate max-w-25">
                                                    {userName}
                                                </span>
                                            </div>
                                        </button>

                                        {/* Dropdown Menu */}
                                        {open && (
                                            <>
                                                <div
                                                    className="fixed inset-0 z-30"
                                                    onClick={handleClose}
                                                />
                                                <div
                                                    className="absolute right-0 mt-3 w-64 rounded-2xl py-2 z-40 animate-slideDown"
                                                    style={{
                                                        backgroundColor: "rgba(255, 255, 255, 0.92)",
                                                        backdropFilter: "blur(24px) saturate(180%)",
                                                        WebkitBackdropFilter: "blur(24px) saturate(180%)",
                                                        border: "1px solid rgba(0, 0, 0, 0.06)",
                                                        boxShadow: "0 20px 60px rgba(0, 0, 0, 0.12), 0 4px 16px rgba(0, 0, 0, 0.04)",
                                                    }}
                                                >
                                                    {/* User Info Header */}
                                                    <div className="px-4 py-3 border-b border-gray-100/60">
                                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.15em]">
                                                            Account
                                                        </p>
                                                        <p className="text-sm font-bold text-gray-900 truncate mt-1">
                                                            {userName}
                                                        </p>
                                                        <p className="text-xs text-gray-500 truncate">
                                                            {userEmail}
                                                        </p>
                                                    </div>

                                                    {/* Menu Items */}
                                                    <div className="py-1.5">
                                                        {[
                                                            { href: "/my-account", icon: <FaUser size={15} />, label: "My Account" },
                                                            { href: "/my-orders", icon: <MdOutlineShoppingBag size={17} />, label: "My Orders" },
                                                            { href: "/address", icon: <MdOutlineLocationOn size={17} />, label: "Addresses" },
                                                            { href: "/settings", icon: <MdOutlineSettings size={17} />, label: "Settings" },
                                                        ].map((item) => (
                                                            <Link
                                                                key={item.href}
                                                                href={item.href}
                                                                className="flex items-center gap-3 mx-2 px-3 py-2.5 rounded-xl text-gray-600 hover:bg-[var(--flavor-glass)] hover:text-primary transition-all duration-200 group"
                                                                onClick={handleClose}
                                                            >
                                                                <span className="group-hover:scale-110 transition-transform duration-300">
                                                                    {item.icon}
                                                                </span>
                                                                <span className="font-semibold text-sm">{item.label}</span>
                                                            </Link>
                                                        ))}
                                                    </div>

                                                    <div className="mx-3 border-t border-gray-100/60 my-1" />

                                                    {/* Logout */}
                                                    <button
                                                        onClick={handleLogout}
                                                        disabled={isLoggingOut}
                                                        className="w-full flex items-center gap-3 mx-2 px-3 py-2.5 rounded-xl text-red-500 hover:bg-red-50 hover:cursor-pointer transition-all duration-200 group font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                                        style={{ width: "calc(100% - 16px)" }}
                                                    >
                                                        <MdLogout
                                                            size={17}
                                                            className="group-hover:scale-110 transition-transform"
                                                        />
                                                        <span>{isLoggingOut ? "Logging out..." : "Logout"}</span>
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

                {/* Mobile Search */}
                <div className={`md:hidden px-3 sm:px-4 pb-2 ${scrolled ? "pt-2" : "pt-0"}`}>
                    <div
                        className="rounded-full overflow-hidden h-10 flex items-center"
                        style={{
                            backgroundColor: "rgba(0, 0, 0, 0.03)",
                            border: "1px solid rgba(0, 0, 0, 0.04)",
                        }}
                    >
                        <Search />
                    </div>
                </div>

                {/* ============ MOBILE DRAWER ============ */}
                <div
                    className={`md:hidden fixed inset-0 bg-black/30 backdrop-blur-sm transition-opacity duration-300 ${mobileMenuOpen
                        ? "opacity-100 pointer-events-auto"
                        : "opacity-0 pointer-events-none"
                        }`}
                    style={{ zIndex: 9997 }}
                    onClick={() => setMobileMenuOpen(false)}
                />

                <div
                    className={`md:hidden fixed left-0 right-0 transition-all duration-400 ease-out ${mobileMenuOpen
                        ? "translate-y-0 opacity-100 pointer-events-auto"
                        : "-translate-y-4 opacity-0 pointer-events-none"
                        }`}
                    style={{
                        top: "calc(var(--header-height, 100px) - 8px)",
                        zIndex: 9998,
                    }}
                >
                    <div
                        className="mx-3 rounded-3xl overflow-hidden"
                        style={{
                            backgroundColor: "rgba(255, 255, 255, 0.92)",
                            backdropFilter: "blur(24px) saturate(180%)",
                            WebkitBackdropFilter: "blur(24px) saturate(180%)",
                            border: "1px solid rgba(0, 0, 0, 0.06)",
                            boxShadow: "0 20px 60px rgba(0, 0, 0, 0.12), 0 4px 16px rgba(0, 0, 0, 0.04)",
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
                                        className={`flex items-center gap-3.5 mx-2 px-4 py-3 rounded-2xl text-[15px] font-bold transition-all duration-300 ${isActive
                                            ? "text-white"
                                            : "text-gray-500 hover:text-gray-900 hover:bg-gray-50 active:scale-[0.98]"
                                            }`}
                                        style={
                                            isActive
                                                ? {
                                                    background: "linear-gradient(135deg, rgba(0, 216, 158, 0.12), rgba(52, 255, 198, 0.08))",
                                                }
                                                : {}
                                        }
                                        onClick={() => setMobileMenuOpen(false)}
                                    >
                                        <span className="text-lg w-7 text-center">{item.icon}</span>
                                        <span>{item.name}</span>
                                        {isActive && (
                                            <span
                                                className="ml-auto w-2 h-2 rounded-full"
                                                style={{
                                                    background: "linear-gradient(135deg, var(--primary), var(--flavor-hover))",
                                                    boxShadow: "0 0 8px rgba(0, 216, 158, 0.4)",
                                                }}
                                            />
                                        )}
                                    </Link>
                                );
                            })}
                        </nav>

                        <div className="mx-4 border-t border-gray-100/60" />

                        {/* Auth Section */}
                        <div className="p-3">
                            {!isLoggedIn ? (
                                <div className="flex gap-2">
                                    <Link
                                        href="/login"
                                        className="flex-1 py-2.5 text-center text-[13px] font-bold text-primary border-2 border-primary rounded-2xl hover:bg-primary hover:text-[#0a0a0a] active:scale-[0.97] transition-all duration-300"
                                        onClick={() => setMobileMenuOpen(false)}
                                    >
                                        Login
                                    </Link>
                                    <Link
                                        href="/register"
                                        className="flex-1 py-2.5 text-center text-[13px] font-bold text-[#0a0a0a] rounded-2xl active:scale-[0.97] transition-all duration-300"
                                        style={{
                                            background: "linear-gradient(135deg, var(--primary), var(--flavor-hover))",
                                            boxShadow: "0 4px 16px rgba(0, 216, 158, 0.25)",
                                        }}
                                        onClick={() => setMobileMenuOpen(false)}
                                    >
                                        Register
                                    </Link>
                                </div>
                            ) : (
                                <div className="flex items-center gap-3 p-3 rounded-2xl bg-gray-50/60">
                                    {userPhoto ? (
                                        <img
                                            src={userPhoto}
                                            alt="Profile"
                                            className="w-10 h-10 rounded-full object-cover ring-2 ring-primary/30"
                                        />
                                    ) : (
                                        <div
                                            className="flex items-center justify-center w-10 h-10 rounded-full text-white"
                                            style={{
                                                background: "linear-gradient(135deg, var(--primary), var(--flavor-hover))",
                                            }}
                                        >
                                            <FaUser size={14} />
                                        </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[14px] font-bold text-gray-900 truncate">
                                            {userName}
                                        </p>
                                        <p className="text-xs text-gray-400 truncate">{userEmail}</p>
                                    </div>
                                    <Link
                                        href="/my-account"
                                        className="px-3.5 py-1.5 text-xs font-bold text-white rounded-full transition-all duration-300"
                                        style={{
                                            background: "linear-gradient(135deg, var(--primary), var(--flavor-hover))",
                                        }}
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
                className={`fixed left-0 right-0 z-50 transition-all duration-400 ${hideHeader
                    ? "translate-y-0 opacity-100"
                    : "-translate-y-full opacity-0 pointer-events-none"
                    }`}
                style={{ top: 0 }}
            >
                <div
                    className="px-3 sm:px-4 md:px-6 py-2.5"
                    style={{
                        backdropFilter: "blur(24px) saturate(180%)",
                        WebkitBackdropFilter: "blur(24px) saturate(180%)",
                        backgroundColor: "rgba(255, 255, 255, 0.88)",
                        borderBottom: "1px solid rgba(0, 0, 0, 0.06)",
                        boxShadow: "0 4px 30px rgba(0, 0, 0, 0.06)",
                    }}
                >
                    <div className="max-w-2xl mx-auto">
                        <div
                            className="rounded-full overflow-hidden"
                            style={{
                                background: "rgba(0, 0, 0, 0.03)",
                                border: "1px solid rgba(0, 0, 0, 0.04)",
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
