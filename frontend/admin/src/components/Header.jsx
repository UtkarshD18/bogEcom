"use client";
import { useAdmin } from "@/context/AdminContext";
import { useAdminRealtime } from "@/hooks/useAdminRealtime";
import { useOrderNotifications } from "@/hooks/useOrderNotifications";
import { Avatar, Badge, Button, Menu, MenuItem, Tooltip } from "@mui/material";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AiOutlineUser } from "react-icons/ai";
import { FiMenu, FiSettings } from "react-icons/fi";
import { IoMdNotifications } from "react-icons/io";
import { MdLogout } from "react-icons/md";

const Header = ({ onMenuClick }) => {
  const [anchorEl, setAnchorEl] = useState(null);
  const [notificationAnchor, setNotificationAnchor] = useState(null);
  const { notificationCount, orders, markOrderAsSeen, clearAllNotifications } =
    useOrderNotifications();
  const { logout, token } = useAdmin();
  const router = useRouter();
  const { status: socketStatus } = useAdminRealtime({ token });
  const liveConnected = socketStatus === "connected";

  const open = Boolean(anchorEl);
  const notificationOpen = Boolean(notificationAnchor);

  const handleProfileClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleProfileClose = () => {
    setAnchorEl(null);
  };

  const handleNotificationClick = (event) => {
    setNotificationAnchor(event.currentTarget);
  };

  const handleNotificationClose = () => {
    setNotificationAnchor(null);
  };

  const handleProfileMenu = () => {
    handleProfileClose();
    router.push("/profile");
  };

  const handleSettingsMenu = () => {
    handleProfileClose();
    router.push("/settings");
  };

  const handleLogout = () => {
    handleProfileClose();
    logout();
  };

  return (
    <header className="w-full h-[60px] bg-white shadow-md flex items-center justify-between px-4 sm:px-5 sticky top-0 z-50">
      <div className="flex items-center gap-3">
        <Button
          onClick={onMenuClick}
          className="!min-w-0 !p-2 lg:!hidden"
          aria-label="Open navigation"
        >
          <FiMenu size={22} />
        </Button>
        <span
          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${
            liveConnected
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-amber-200 bg-amber-50 text-amber-700"
          }`}
        >
          <span
            className={`h-2 w-2 rounded-full ${
              liveConnected ? "bg-emerald-500" : "bg-amber-500"
            }`}
          />
          {liveConnected ? "Live updates on" : "Live updates offline"}
        </span>
      </div>

      <div className="flex items-center gap-1">
        <Tooltip title="Notifications">
          <Badge badgeContent={notificationCount} color="error">
            <Button onClick={handleNotificationClick}>
              <IoMdNotifications size={24} />
            </Button>
          </Badge>
        </Tooltip>
        <Button onClick={handleProfileClick}>
          <Avatar src="/placeholder.png" />
        </Button>
      </div>

      <Menu anchorEl={anchorEl} open={open} onClose={handleProfileClose}>
        <MenuItem onClick={handleProfileMenu}>
          <AiOutlineUser /> Profile
        </MenuItem>
        <MenuItem onClick={handleSettingsMenu}>
          <FiSettings /> Settings
        </MenuItem>
        <MenuItem onClick={handleLogout}>
          <MdLogout /> Logout
        </MenuItem>
      </Menu>
      <Menu
        anchorEl={notificationAnchor}
        open={notificationOpen}
        onClose={handleNotificationClose}
        slotProps={{
          paper: {
            style: {
              maxWidth: "400px",
              maxHeight: "500px",
            },
          },
        }}
      >
        {orders.length === 0 ? (
          <MenuItem disabled>No new orders</MenuItem>
        ) : (
          <>
            <MenuItem disabled style={{ fontWeight: "bold", color: "#c1591c" }}>
              New Orders ({orders.length})
            </MenuItem>
            {orders.map((order) => (
              <MenuItem
                key={order.id}
                onClick={() => {
                  markOrderAsSeen(order.id);
                  router.push("/orders");
                }}
                style={{
                  borderBottom: "1px solid #eee",
                  padding: "12px 16px",
                  whiteSpace: "normal",
                }}
              >
                <div style={{ width: "100%" }}>
                  <div style={{ fontWeight: "bold", marginBottom: "4px" }}>
                    {order.displayId || `Order #${order.id}`}
                  </div>
                  <div
                    style={{
                      fontSize: "12px",
                      color: "#666",
                      marginBottom: "4px",
                    }}
                  >
                    Total: ₹{Number(order.total || 0).toFixed(2)}
                    {order.status ? ` • ${order.status}` : ""}
                  </div>
                  <div style={{ fontSize: "12px", color: "#999" }}>
                    {new Date(order.createdAt).toLocaleDateString()}
                  </div>
                </div>
              </MenuItem>
            ))}
            <MenuItem
              onClick={() => {
                clearAllNotifications();
                handleNotificationClose();
              }}
              style={{
                color: "#c1591c",
                fontWeight: "bold",
                marginTop: "8px",
              }}
            >
              Mark all as read
            </MenuItem>
          </>
        )}
      </Menu>
    </header>
  );
};

export default Header;
