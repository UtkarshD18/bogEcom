"use client";
import { postData } from "@/utils/api";
import { Button } from "@mui/material";
import cookies from "js-cookie";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import { BsBagCheck } from "react-icons/bs";
import { FaRegHeart, FaRegUser } from "react-icons/fa6";
import { FiCamera, FiMapPin, FiSettings } from "react-icons/fi";
import { IoMdLogOut } from "react-icons/io";

const AccountSidebar = () => {
  const router = useRouter();
  const pathname = usePathname();
  const fileInputRef = useRef(null);
  const API_URL =
    (
      process.env.NEXT_PUBLIC_APP_API_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      "http://localhost:8000"
    ).replace(/\/+$/, "");

  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [userName, setUserName] = useState("User");
  const [userEmail, setUserEmail] = useState("");
  const [userPhoto, setUserPhoto] = useState("");
  const [userPhone, setUserPhone] = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const syncFromCookies = () => {
    const name = cookies.get("userName") || "User";
    const email = cookies.get("userEmail") || "";
    const photo = cookies.get("userPhoto") || "";
    setUserName(name);
    setUserEmail(email);
    setUserPhoto(photo);
  };

  const formatPhone = (value) => {
    const digits = String(value || "").replace(/\D/g, "");
    if (!digits) return "";
    if (digits.startsWith("91") && digits.length > 10) {
      return `+${digits}`;
    }
    return `+91 ${digits}`;
  };

  const fetchProfile = async () => {
    const token = cookies.get("accessToken");
    if (!token) return;
    try {
      const response = await fetch(`${API_URL}/api/user/user-details`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      });
      const data = await response.json();
      if (data.success && data.data) {
        const name = data.data?.name || "User";
        const email = data.data?.email || "";
        setUserName(name);
        setUserEmail(email);
        cookies.set("userName", name, { expires: 7 });
        cookies.set("userEmail", email, { expires: 7 });
      }
    } catch (error) {
      // Silent fallback to cookies
    }
  };

  const fetchPrimaryPhone = async () => {
    const token = cookies.get("accessToken");
    if (!token) return;
    try {
      const response = await fetch(`${API_URL}/api/address`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      });
      const data = await response.json();
      if (data.success && Array.isArray(data.data)) {
        const preferred =
          data.data.find((addr) => addr.selected) || data.data[0];
        const phone = preferred?.mobile ? formatPhone(preferred.mobile) : "";
        setUserPhone(phone);
      }
    } catch (error) {
      // Silent failure for phone display
    }
  };

  // Load user data from cookies + API
  useEffect(() => {
    const handleAuthChange = () => {
      syncFromCookies();
      fetchProfile();
      fetchPrimaryPhone();
    };

    handleAuthChange();
    window.addEventListener("loginSuccess", handleAuthChange);
    window.addEventListener("focus", handleAuthChange);

    return () => {
      window.removeEventListener("loginSuccess", handleAuthChange);
      window.removeEventListener("focus", handleAuthChange);
    };
  }, []);

  const Navinks = [
    {
      name: "My Profile",
      href: "/my-account",
      icon: <FaRegUser size={20} />,
    },
    {
      name: "Address",
      href: "/address",
      icon: <FiMapPin size={20} />,
    },
    {
      name: "My Wishlist",
      href: "/my-list",
      icon: <FaRegHeart size={20} />,
    },
    {
      name: "My Orders",
      href: "/my-orders",
      icon: <BsBagCheck size={20} />,
    },
    {
      name: "Settings",
      href: "/settings",
      icon: <FiSettings size={20} />,
    },
  ];

  // Handle profile photo change
  const handlePhotoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image size should be less than 5MB");
      return;
    }

    setUploadingPhoto(true);

    try {
      // Create FormData for upload
      const formData = new FormData();
      formData.append("image", file);

      const token = cookies.get("accessToken");
      const API_URL =
        process.env.NEXT_PUBLIC_APP_API_URL || "http://localhost:8000";

      const response = await fetch(`${API_URL}/api/user/upload-photo`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await response.json();

      if (data.success && data.data?.photo) {
        setUserPhoto(data.data.photo);
        cookies.set("userPhoto", data.data.photo, { expires: 7 });
        toast.success("Profile photo updated!");
        // Trigger header refresh
        window.dispatchEvent(new Event("loginSuccess"));
      } else {
        // For now, use local preview since API might not exist
        const reader = new FileReader();
        reader.onload = (e) => {
          const photoUrl = e.target?.result;
          setUserPhoto(photoUrl);
          // Store in localStorage as fallback
          localStorage.setItem("userPhoto", photoUrl);
          toast.success("Profile photo updated locally!");
        };
        reader.readAsDataURL(file);
      }
    } catch (error) {
      console.error("Error uploading photo:", error);
      // Fallback: Use local preview
      const reader = new FileReader();
      reader.onload = (e) => {
        const photoUrl = e.target?.result;
        setUserPhoto(photoUrl);
        localStorage.setItem("userPhoto", photoUrl);
        toast.success("Profile photo updated!");
      };
      reader.readAsDataURL(file);
    } finally {
      setUploadingPhoto(false);
    }
  };

  // Load photo from localStorage on mount
  useEffect(() => {
    const savedPhoto = localStorage.getItem("userPhoto");
    if (savedPhoto && !userPhoto) {
      setUserPhoto(savedPhoto);
    }
  }, []);

  // Handle logout
  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await postData("/api/user/logout", {});
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      // Clear cookies regardless of API response
      cookies.remove("accessToken");
      cookies.remove("refreshToken");
      cookies.remove("userEmail");
      cookies.remove("userName");
      cookies.remove("userPhoto");
      localStorage.removeItem("userPhoto");

      toast.success("Logged out successfully");
      setIsLoggingOut(false);

      // Trigger header refresh and redirect
      window.dispatchEvent(new Event("loginSuccess"));
      router.push("/logout-confirmation");
    }
  };

  // Get initials for avatar fallback
  const getInitials = (name) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <aside
      className="accountSidebar w-[100%] shadow-md rounded-md"
      style={{ backgroundColor: "var(--flavor-card-bg, #fffbf5)" }}
    >
      <div className="profileSection py-5 pb-0">
        {/* Profile Image with Upload */}
        <div className="profileImg w-[100px] h-[100px] rounded-full overflow-hidden m-auto relative group cursor-pointer">
          {userPhoto ? (
            <img
              src={userPhoto}
              alt="profile"
              className="w-full h-full object-cover"
              onError={(e) => {
                e.target.style.display = "none";
                e.target.nextElementSibling.style.display = "flex";
              }}
            />
          ) : null}
          <div
            className={`w-full h-full bg-gradient-to-br from-primary to-[var(--flavor-hover)] flex items-center justify-center text-white text-2xl font-bold ${userPhoto ? "hidden" : "flex"}`}
          >
            {getInitials(userName)}
          </div>

          {/* Upload Overlay */}
          <div
            className="overlay w-full h-full rounded-full bg-[rgba(0,0,0,0.6)] absolute top-0 left-0 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            {uploadingPhoto ? (
              <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <FiCamera size={24} className="text-white" />
                <span className="text-white text-xs mt-1">Change</span>
              </>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handlePhotoChange}
            className="hidden"
          />
        </div>

        <div className="text-center mt-3">
          <h4 className="text-[18px] font-[600] text-gray-700">{userName}</h4>
          <p className="text-[14px] text-gray-600">{userEmail}</p>
          {userPhone && (
            <p className="text-[13px] text-gray-500 mt-0.5">{userPhone}</p>
          )}
        </div>

        <div className="bg-[#f1f1f1] mt-4 flex flex-col gap-[2px] py-2 myAcc">
          {Navinks?.map((item, index) => {
            const isActive = pathname === item.href;
            return (
              <Link href={item.href} className="flex" key={index}>
                <Button
                  className={`!text-gray-600 !capitalize !w-full !justify-start !px-5 !py-[8px] gap-2 !text-[15px] !font-[600] ${isActive === true && "active"
                    }`}
                >
                  {item.icon} {item.name}
                </Button>
              </Link>
            );
          })}

          <Button
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="!text-red-600 !capitalize !w-full !justify-start !px-5 !py-[8px] gap-2 !text-[15px] !font-[600] hover:!bg-red-50"
          >
            <IoMdLogOut size={20} />
            {isLoggingOut ? "Logging out..." : "Logout"}
          </Button>
        </div>
      </div>
    </aside>
  );
};
export default AccountSidebar;
