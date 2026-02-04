"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const Nav = () => {
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Navigation items - can be fetched from API/admin in production
  const navItems = [
    { name: "Home", link: "/" },
    { name: "Products", link: "/products" },
    { name: "Membership", link: "/membership" },
    { name: "Blogs", link: "/blogs" },
    { name: "About Us", link: "/about-us" },
  ];

  return (
    <nav
      className={`top-0 z-30 w-full transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] ${
        scrolled
          ? "py-3 backdrop-blur-2xl backdrop-saturate-150 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border-b"
          : "py-4 bg-transparent backdrop-blur-sm border-b border-transparent"
      }`}
      style={{
        backgroundColor: scrolled
          ? `color-mix(in srgb, var(--flavor-card-bg, #fffbf5) 80%, transparent)`
          : "transparent",
        borderColor: scrolled
          ? `color-mix(in srgb, var(--flavor-color, #f5c16c) 20%, transparent)`
          : "transparent",
      }}
    >
      <div className="container mx-auto flex items-center justify-center">
        <ul className="flex items-center gap-2 px-2">
          {navItems.map((item) => {
            const isActive =
              item.link === "/"
                ? pathname === "/"
                : pathname.startsWith(item.link);
            return (
              <li key={item.name}>
                <Link
                  href={item.link}
                  className={`relative px-5 py-2.5 text-[14px] font-medium rounded-full transition-all duration-300 ease-out active:scale-95
                    ${
                      isActive
                        ? "bg-[#059669]/15 text-[#059669] font-bold shadow-sm"
                        : "text-neutral-600 hover:bg-[#059669] hover:text-white hover:shadow-lg"
                    }
                  `}
                >
                  {item.name}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
};

export default Nav;
