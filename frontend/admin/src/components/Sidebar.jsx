"use client";
import { useAdmin } from "@/context/AdminContext";
import { fetchUnresolvedSupportCount } from "@/services/supportApi";
import { hasAdminPermission } from "@/utils/adminPermissions";
import { withAdminBasePath } from "@/utils/basePath";
import { Button } from "@mui/material";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { FiX } from "react-icons/fi";
import { IoIosLogOut } from "react-icons/io";
import { IoBagCheckOutline } from "react-icons/io5";
import { LiaImageSolid } from "react-icons/lia";
import {
  MdInfoOutline,
  MdInsights,
  MdKey,
  MdMailOutline,
  MdNotificationsActive,
  MdOutlineArticle,
  MdOutlineCategory,
  MdOutlineHub,
  MdOutlineInventory2,
  MdOutlineLocalOffer,
  MdOutlinePictureAsPdf,
  MdOutlinePolicy,
  MdSettings,
  MdSupportAgent,
} from "react-icons/md";
import { PiImageSquare } from "react-icons/pi";
import { RiCoupon2Line, RiVipCrownLine } from "react-icons/ri";
import { RxDashboard } from "react-icons/rx";
import { TbBrandProducthunt, TbShare, TbUsers } from "react-icons/tb";

const Sidebar = ({ isOpen = false, onClose }) => {
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
      name: "Behavior",
      icon: <MdInsights size={22} />,
      href: "/behavior-analytics",
      requiredPermission: "view_analytics",
    },
    {
      name: "Analytics",
      icon: <MdInsights size={22} />,
      href: "/analytics",
      requiredPermission: "view_analytics",
    },
    {
      name: "Sales Analytics",
      icon: <MdInsights size={22} />,
      href: "/sales-analytics",
      requiredPermission: "view_analytics",
    },
    {
      name: "Home Slides",
      icon: <LiaImageSolid size={20} />,
      href: "/home-slides",
      requiredPermission: "manage_settings",
    },
    {
      name: "Category",
      icon: <MdOutlineCategory size={22} />,
      href: "/category-list",
      requiredPermission: "manage_settings",
    },
    {
      name: "Products",
      icon: <TbBrandProducthunt size={22} />,
      href: "/products-list",
      requiredPermission: "manage_settings",
    },
    {
      name: "Low Stock",
      icon: <MdOutlineInventory2 size={22} />,
      href: "/products-list?lowStock=true",
      requiredPermission: "manage_settings",
    },
    {
      name: "Users",
      icon: <TbUsers size={22} />,
      href: "/users",
      requiredPermission: "manage_users",
    },
    {
      name: "Orders",
      icon: <IoBagCheckOutline size={22} />,
      href: "/orders",
      requiredPermission: "manage_shipping",
    },
    {
      name: "Customer Care",
      icon: <MdSupportAgent size={22} />,
      href: "/customer-care",
      badgeCount: openTicketCount,
      requiredPermission: "manage_crm",
    },
    {
      name: "CRM",
      icon: <MdOutlineHub size={22} />,
      href: "/crm",
      requiredPermission: "manage_crm",
    },
    {
      name: "Coupons",
      icon: <RiCoupon2Line size={22} />,
      href: "/coupons",
      requiredPermission: "manage_settings",
    },
    {
      name: "Influencers",
      icon: <TbShare size={22} />,
      href: "/influencers",
      requiredPermission: "manage_settings",
    },
    {
      name: "Notifications",
      icon: <MdNotificationsActive size={22} />,
      href: "/notifications",
      requiredPermission: "manage_crm",
    },
    {
      name: "Newsletter",
      icon: <MdMailOutline size={22} />,
      href: "/newsletter",
      requiredPermission: "manage_crm",
    },
    {
      name: "Email Templates",
      icon: <MdMailOutline size={22} />,
      href: "/email-templates",
      requiredPermission: "manage_crm",
    },
    {
      name: "API PDFs",
      icon: <MdOutlinePictureAsPdf size={22} />,
      href: "/api-docs",
      requiredPermission: "manage_settings",
    },
    {
      name: "Partner API",
      icon: <MdKey size={22} />,
      href: "/partner-api",
      requiredPermission: "manage_settings",
    },
    {
      name: "Banners",
      icon: <PiImageSquare size={22} />,
      href: "/banners",
      requiredPermission: "manage_settings",
    },
    {
      name: "Blogs",
      icon: <MdOutlineArticle size={22} />,
      href: "/blogs",
      requiredPermission: "manage_settings",
    },
    {
      name: "Membership",
      icon: <RiVipCrownLine size={22} />,
      href: "/membership",
      requiredPermission: "manage_membership",
      children: [
        { name: "Settings", href: "/membership" },
        { name: "Members", href: "/membership/members" },
        { name: "Analytics", href: "/membership/analytics" },
        { name: "Coins", href: "/coins" },
      ],
    },
    {
      name: "Combos",
      icon: <MdOutlineLocalOffer size={22} />,
      href: "/combos",
      requiredPermission: "manage_settings",
      children: [
        { name: "Management", href: "/combos" },
        { name: "Analytics", href: "/combos/analytics" },
      ],
    },
    {
      name: "Cancellation & Return",
      icon: <MdOutlinePolicy size={22} />,
      href: "/cancellation-policy",
      requiredPermission: "manage_settings",
    },
    {
      name: "Terms & Conditions",
      icon: <MdOutlinePolicy size={22} />,
      href: "/terms-and-conditions",
      requiredPermission: "manage_settings",
    },
    {
      name: "About Us",
      icon: <MdInfoOutline size={22} />,
      href: "/about-page",
      requiredPermission: "manage_settings",
    },
    {
      name: "Settings",
      icon: <MdSettings size={22} />,
      href: "/settings",
      requiredPermission: "manage_settings",
    },
  ];

  const visibleSidebarTabs = sidebarTabs.filter((tab) => {
    if (!tab.requiredPermission) return true;
    return hasAdminPermission(admin, tab.requiredPermission);
  });

  const isActive = (href) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  const isChildActive = (href) => {
    if (href === "/membership") return pathname === "/membership";
    return pathname.startsWith(href);
  };

  const handleAdminHomeRefresh = () => {
    router.push("/");
    router.refresh();
  };

  const handleNavClick = () => {
    if (onClose) {
      onClose();
    }
  };

  return (
    <aside
      className={`w-[250px] bg-white shadow-md h-screen fixed top-0 left-0 z-40 flex flex-col transform transition-transform duration-200 ${
        isOpen ? "translate-x-0" : "-translate-x-full"
      } lg:translate-x-0`}
    >
      {/* Logo */}
      <div className="p-4 border-b border-gray-100 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <img
            src={withAdminBasePath("/logo.png")}
            alt="Logo"
            className="h-10 w-auto"
            width={140}
            height={40}
            loading="eager"
          />
        </Link>
        <button
          type="button"
          onClick={onClose}
          className="lg:hidden text-gray-500 hover:text-gray-900"
          aria-label="Close navigation"
        >
          <FiX size={22} />
        </button>
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
          {admin?.name || admin?.userName || "Admin"}
        </p>
        <p className="text-xs text-gray-500 truncate">{admin?.email || ""}</p>
      </div>

      {/* Navigation */}
      <div className="flex flex-col gap-1 mt-4 px-3 flex-1 overflow-y-auto">
        {visibleSidebarTabs.map((tab) => {
          const visibleChildren = Array.isArray(tab.children)
            ? tab.children.filter((child) => {
                if (!child.requiredPermission) return true;
                return hasAdminPermission(admin, child.requiredPermission);
              })
            : [];

          const childActive = visibleChildren.length
            ? visibleChildren.some((child) => isChildActive(child.href))
            : false;
          const tabActive = isActive(tab.href) || childActive;

          return (
            <div key={tab.name}>
              <Link
                href={tab.href}
                onClick={handleNavClick}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                  tabActive
                    ? "bg-blue-50 text-blue-600 font-semibold"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                }`}
              >
                <span className={tabActive ? "text-blue-600" : "text-gray-500"}>
                  {tab.icon}
                </span>
                <span className="font-medium">{tab.name}</span>
                {tab.badgeCount > 0 && (
                  <span className="ml-auto min-w-[24px] h-[24px] px-2 rounded-full bg-red-100 text-red-700 text-[11px] font-semibold flex items-center justify-center">
                    {tab.badgeCount > 99 ? "99+" : tab.badgeCount}
                  </span>
                )}
              </Link>

              {visibleChildren.length > 0 && (
                <div className="ml-11 mt-1 mb-2 flex flex-col gap-1">
                  {visibleChildren.map((child) => {
                    const childIsActive = isChildActive(child.href);
                    return (
                      <Link
                        key={child.href}
                        href={child.href}
                        onClick={handleNavClick}
                        className={`px-3 py-1.5 rounded-md text-sm transition-all ${
                          childIsActive
                            ? "text-blue-700 bg-blue-100 font-semibold"
                            : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                        }`}
                      >
                        {child.name}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
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
