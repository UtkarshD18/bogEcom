"use client";
import { useOrderNotifications } from "@/hooks/useOrderNotifications";
import { Avatar, Badge, Button, Menu, MenuItem, Tooltip } from "@mui/material";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AiOutlineUser } from "react-icons/ai";
import { FiSettings } from "react-icons/fi";
import { IoMdNotifications } from "react-icons/io";
import { MdLogout } from "react-icons/md";

const Header = () => {
  const [anchorEl, setAnchorEl] = useState(null);
  const [notificationAnchor, setNotificationAnchor] = useState(null);
  const { notificationCount, orders, markOrderAsSeen, clearAllNotifications } =
    useOrderNotifications();
  const router = useRouter();

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
    // Add logout logic here
    router.push("/login");
  };

  return (
    <header className="w-full h-[60px] bg-white shadow-md flex items-center justify-end px-5 sticky top-0 z-50">
      <Tooltip title="Notifications">
        <Badge badgeContent={notificationCount} color="error">
          <Button onClick={handleNotificationClick}>
            <IoMdNotifications size={24} />
          </Button>
        </Badge>
      </Tooltip>
      <Button onClick={handleProfileClick}>
        <Avatar src="/profile.png" />
      </Button>
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
                    Order #{order.id}
                  </div>
                  <div
                    style={{
                      fontSize: "12px",
                      color: "#666",
                      marginBottom: "4px",
                    }}
                  >
                    Total: ₹{order.total?.toFixed(2)}
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
