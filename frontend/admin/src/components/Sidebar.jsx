"use client";
import { useAdmin } from "@/context/AdminContext";
import { fetchUnresolvedSupportCount } from "@/services/supportApi";
import { Button } from "@mui/material";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { IoIosLogOut } from "react-icons/io";
import { IoBagCheckOutline } from "react-icons/io5";
import { LiaImageSolid } from "react-icons/lia";
import {
  MdInfoOutline,
  MdLocalShipping,
  MdMailOutline,
  MdNotificationsActive,
  MdOutlineArticle,
  MdOutlineCategory,
  MdOutlineInventory2,
  MdOutlinePolicy,
  MdSettings,
  MdSupportAgent,
} from "react-icons/md";
import { PiImageSquare } from "react-icons/pi";
import { RiCoupon2Line, RiVipCrownLine } from "react-icons/ri";
import { RxDashboard } from "react-icons/rx";
import { TbBrandProducthunt, TbShare, TbUsers } from "react-icons/tb";

const Sidebar = () => {
  const { logout, admin, token } = useAdmin();
  const pathname = usePathname();
  const router = useRouter();
  const [openTicketCount, setOpenTicketCount] = useState(0);

  useEffect(() => {
    let active = true;
    let intervalId = null;

    const loadUnresolvedCount = async () => {
      if (!token) {
        if (active) setOpenTicketCount(0);
        return;
      }

      try {
        const response = await fetchUnresolvedSupportCount(token);
        if (active && response?.success) {
          setOpenTicketCount(Number(response.data?.count || 0));
        }
      } catch (error) {
        if (active) {
          setOpenTicketCount(0);
        }
      }
    };

    loadUnresolvedCount();
    intervalId = setInterval(loadUnresolvedCount, 60000);

    return () => {
      active = false;
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [token]);

  const sidebarTabs = [
    {
      name: "Dashboard",
      icon: <RxDashboard size={20} />,
      href: "/",
    },
    {
      name: "Home Slides",
      icon: <LiaImageSolid size={20} />,
      href: "/home-slides",
    },
    {
      name: "Category",
      icon: <MdOutlineCategory size={22} />,
      href: "/category-list",
    },
    {
      name: "Products",
      icon: <TbBrandProducthunt size={22} />,
      href: "/products-list",
    },
    {
      name: "Low Stock",
      icon: <MdOutlineInventory2 size={22} />,
      href: "/products-list?lowStock=true",
    },
    {
      name: "Users",
      icon: <TbUsers size={22} />,
      href: "/users",
    },
    {
      name: "Orders",
      icon: <IoBagCheckOutline size={22} />,
      href: "/orders",
    },
    {
      name: "Customer Care",
      icon: <MdSupportAgent size={22} />,
      href: "/customer-care",
      badgeCount: openTicketCount,
    },
    {
      name: "Shipping",
      icon: <MdLocalShipping size={22} />,
      href: "/shipping",
    },
    {
      name: "Coupons",
      icon: <RiCoupon2Line size={22} />,
      href: "/coupons",
    },
    {
      name: "Influencers",
      icon: <TbShare size={22} />,
      href: "/influencers",
    },
    {
      name: "Notifications",
      icon: <MdNotificationsActive size={22} />,
      href: "/notifications",
    },
    {
      name: "Newsletter",
      icon: <MdMailOutline size={22} />,
      href: "/newsletter",
    },
    {
      name: "Banners",
      icon: <PiImageSquare size={22} />,
      href: "/banners",
    },
    {
      name: "Blogs",
      icon: <MdOutlineArticle size={22} />,
      href: "/blogs",
    },
    {
      name: "Membership",
      icon: <RiVipCrownLine size={22} />,
      href: "/membership",
    },
    {
      name: "Coins",
      icon: <RiCoupon2Line size={22} />,
      href: "/coins",
    },
    {
      name: "Cancellation & Return",
      icon: <MdOutlinePolicy size={22} />,
      href: "/cancellation-policy",
    },
    {
      name: "Terms & Conditions",
      icon: <MdOutlinePolicy size={22} />,
      href: "/terms-and-conditions",
    },
    {
      name: "About Us",
      icon: <MdInfoOutline size={22} />,
      href: "/about-page",
    },
    {
      name: "Settings",
      icon: <MdSettings size={22} />,
      href: "/settings",
    },
  ];

  const isActive = (href) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  const handleAdminHomeRefresh = () => {
    router.push("/");
    router.refresh();
  };

  return (
    <aside className="w-[250px] bg-white shadow-md h-screen fixed top-0 left-0 z-40 flex flex-col">
      {/* Logo */}
      <div className="p-4 border-b border-gray-100">
        <Link href="/" className="flex items-center gap-2">
          <img src="/logo.jpeg" alt="Logo" className="h-10" />
        </Link>
      </div>

      {/* Admin Info */}
      <div className="px-4 py-3 border-b border-gray-100">
        <button
          type="button"
          onClick={handleAdminHomeRefresh}
          className="w-full text-left"
          title="Go to admin home and refresh"
        >
          <p className="text-base font-semibold text-gray-900 hover:text-blue-700 transition-colors">
            Admin Panel
          </p>
        </button>
        <p className="text-sm font-medium text-gray-800 truncate">
          {admin?.name || "Admin"}
        </p>
        <p className="text-xs text-gray-500 truncate">{admin?.email || ""}</p>
      </div>

      {/* Navigation */}
      <div className="flex flex-col gap-1 mt-4 px-3 flex-1 overflow-y-auto">
        {sidebarTabs.map((tab) => (
          <Link
            key={tab.name}
            href={tab.href}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${isActive(tab.href)
                ? "bg-blue-50 text-blue-600 font-semibold"
                : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              }`}
          >
            <span
              className={isActive(tab.href) ? "text-blue-600" : "text-gray-500"}
            >
              {tab.icon}
            </span>
            <span className="font-medium">{tab.name}</span>
            {tab.badgeCount > 0 && (
              <span className="ml-auto min-w-[24px] h-[24px] px-2 rounded-full bg-red-100 text-red-700 text-[11px] font-semibold flex items-center justify-center">
                {tab.badgeCount > 99 ? "99+" : tab.badgeCount}
              </span>
            )}
          </Link>
        ))}
      </div>

      {/* Logout Button */}
      <div className="mt-auto mb-4 px-4">
        <Button
          onClick={logout}
          startIcon={<IoIosLogOut />}
          fullWidth
          variant="outlined"
          color="error"
          className="!py-2"
        >
          Logout
        </Button>
      </div>
    </aside>
  );
};

export default Sidebar;
