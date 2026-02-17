"use client";
import { API_BASE_URL, postData } from "@/utils/api";
import MemberBadge from "@/components/MemberBadge";
import { Button } from "@mui/material";
import cookies from "js-cookie";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import { BsBagCheck } from "react-icons/bs";
import { FaRegHeart, FaRegUser } from "react-icons/fa6";
import { FiCamera, FiMapPin, FiSettings, FiTrash2 } from "react-icons/fi";
import { IoMdLogOut } from "react-icons/io";

const AccountSidebar = () => {
  const router = useRouter();
  const pathname = usePathname();
  const fileInputRef = useRef(null);
  const API_URL = (
    process.env.NEXT_PUBLIC_APP_API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "http://localhost:8000"
  )
    .replace(/\/+$/, "")
    .replace(/\/api$/i, "");

  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [userName, setUserName] = useState("User");
  const [userEmail, setUserEmail] = useState("");
  const [isMember, setIsMember] = useState(false);
  const [userPhoto, setUserPhoto] = useState("");
  const [userPhone, setUserPhone] = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const getAuthToken = () =>
    cookies.get("accessToken") ||
    (typeof window !== "undefined"
      ? localStorage.getItem("accessToken") || localStorage.getItem("token")
      : null);

  const normalizeIdentity = (value) => String(value || "").trim().toLowerCase();
  const getPhotoStorageKey = (emailValue) => {
    const normalizedEmail = normalizeIdentity(emailValue);
    return normalizedEmail ? `userPhoto:${normalizedEmail}` : "";
  };
  const getPhotoRemovedKey = (emailValue) => {
    const normalizedEmail = normalizeIdentity(emailValue);
    return normalizedEmail ? `userPhotoRemoved:${normalizedEmail}` : "";
  };
  const getStoredPhotoForUser = (emailValue) => {
    const key = getPhotoStorageKey(emailValue);
    if (!key) return "";
    return localStorage.getItem(key) || "";
  };
  const isPhotoRemovalOverride = (emailValue) => {
    const key = getPhotoRemovedKey(emailValue);
    if (!key) return false;
    return localStorage.getItem(key) === "1";
  };
  const setPhotoRemovalOverride = (emailValue, removed) => {
    const key = getPhotoRemovedKey(emailValue);
    if (!key) return;
    if (removed) {
      localStorage.setItem(key, "1");
    } else {
      localStorage.removeItem(key);
    }
  };
  const clearStoredPhotoForUser = (emailValue) => {
    const key = getPhotoStorageKey(emailValue);
    const removedKey = getPhotoRemovedKey(emailValue);
    if (key) localStorage.removeItem(key);
    if (removedKey) localStorage.removeItem(removedKey);
    // Cleanup old global key to prevent cross-account leakage.
    localStorage.removeItem("userPhoto");
  };

  const resolveImageUrl = (value) => {
    const photo = String(value || "").trim();
    if (!photo) return "";
    if (photo.startsWith("data:")) return photo;
    if (photo.startsWith("http://") || photo.startsWith("https://")) {
      return photo;
    }
    if (photo.startsWith("/uploads/")) return `${API_URL}${photo}`;
    if (photo.startsWith("uploads/")) return `${API_URL}/${photo}`;
    if (photo.startsWith("/")) return photo;
    return photo;
  };

  const setPhotoEverywhere = (
    photoValue,
    {
      persistCookie = true,
      emailOverride = "",
      emitEvent = true,
      markRemoved = false,
    } = {},
  ) => {
    const effectiveEmail =
      emailOverride || userEmail || cookies.get("userEmail") || "";
    const resolved = resolveImageUrl(photoValue);
    setUserPhoto(resolved);
    if (photoValue) {
      if (persistCookie) {
        cookies.set("userPhoto", photoValue, { expires: 7 });
      } else {
        cookies.remove("userPhoto");
      }
      const storageKey = getPhotoStorageKey(effectiveEmail);
      if (storageKey) localStorage.setItem(storageKey, photoValue);
      localStorage.removeItem("userPhoto");
      setPhotoRemovalOverride(effectiveEmail, false);
    } else {
      cookies.remove("userPhoto");
      clearStoredPhotoForUser(effectiveEmail);
      if (markRemoved) {
        setPhotoRemovalOverride(effectiveEmail, true);
      }
    }
    if (emitEvent) {
      window.dispatchEvent(new Event("loginSuccess"));
    }
  };

  const applyLocalPhotoFallback = (file, successMessage) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const photoUrl = event.target?.result;
      setPhotoEverywhere(photoUrl, { persistCookie: false });
      toast.success(successMessage);
    };
    reader.readAsDataURL(file);
  };

  const normalizeIdentity = (value) => String(value || "").trim().toLowerCase();
  const getPhotoStorageKey = (emailValue) => {
    const normalizedEmail = normalizeIdentity(emailValue);
    return normalizedEmail ? `userPhoto:${normalizedEmail}` : "";
  };
  const getPhotoRemovedKey = (emailValue) => {
    const normalizedEmail = normalizeIdentity(emailValue);
    return normalizedEmail ? `userPhotoRemoved:${normalizedEmail}` : "";
  };
  const getStoredPhotoForUser = (emailValue) => {
    const key = getPhotoStorageKey(emailValue);
    if (!key) return "";
    return localStorage.getItem(key) || "";
  };
  const isPhotoRemovalOverride = (emailValue) => {
    const key = getPhotoRemovedKey(emailValue);
    if (!key) return false;
    return localStorage.getItem(key) === "1";
  };
  const setPhotoRemovalOverride = (emailValue, removed) => {
    const key = getPhotoRemovedKey(emailValue);
    if (!key) return;
    if (removed) {
      localStorage.setItem(key, "1");
    } else {
      localStorage.removeItem(key);
    }
  };
  const clearStoredPhotoForUser = (emailValue) => {
    const key = getPhotoStorageKey(emailValue);
    const removedKey = getPhotoRemovedKey(emailValue);
    if (key) localStorage.removeItem(key);
    if (removedKey) localStorage.removeItem(removedKey);
    // Cleanup old global key to prevent cross-account leakage.
    localStorage.removeItem("userPhoto");
  };

  const resolveImageUrl = (value) => {
    const photo = String(value || "").trim();
    if (!photo) return "";
    if (photo.startsWith("data:")) return photo;
    if (photo.startsWith("http://") || photo.startsWith("https://")) {
      return photo;
    }
    if (photo.startsWith("/uploads/")) return `${API_URL}${photo}`;
    if (photo.startsWith("uploads/")) return `${API_URL}/${photo}`;
    if (photo.startsWith("/")) return photo;
    return photo;
  };

  const setPhotoEverywhere = (
    photoValue,
    {
      persistCookie = true,
      emailOverride = "",
      emitEvent = true,
      markRemoved = false,
    } = {},
  ) => {
    const effectiveEmail =
      emailOverride || userEmail || cookies.get("userEmail") || "";
    const resolved = resolveImageUrl(photoValue);
    setUserPhoto(resolved);
    if (photoValue) {
      if (persistCookie) {
        cookies.set("userPhoto", photoValue, { expires: 7 });
      } else {
        cookies.remove("userPhoto");
      }
      const storageKey = getPhotoStorageKey(effectiveEmail);
      if (storageKey) localStorage.setItem(storageKey, photoValue);
      localStorage.removeItem("userPhoto");
      setPhotoRemovalOverride(effectiveEmail, false);
    } else {
      cookies.remove("userPhoto");
      clearStoredPhotoForUser(effectiveEmail);
      if (markRemoved) {
        setPhotoRemovalOverride(effectiveEmail, true);
      }
    }
    if (emitEvent) {
      window.dispatchEvent(new Event("loginSuccess"));
    }
  };

  const applyLocalPhotoFallback = (file, successMessage) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const photoUrl = event.target?.result;
      setPhotoEverywhere(photoUrl, { persistCookie: false });
      toast.success(successMessage);
    };
    reader.readAsDataURL(file);
  };

  const syncFromCookies = () => {
    const name = cookies.get("userName") || "User";
    const email = cookies.get("userEmail") || "";
    const photo = isPhotoRemovalOverride(email)
      ? ""
      : cookies.get("userPhoto") || getStoredPhotoForUser(email) || "";
    setUserName(name);
    setUserEmail(email);
    setUserPhoto(resolveImageUrl(photo));
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
    const token = getAuthToken();
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
        const avatar = data.data?.avatar || "";
        setUserName(name);
        setUserEmail(email);
        setIsMember(
          Boolean(data.data?.isMember) &&
            (!expiry || !Number.isNaN(expiry.getTime()) && expiry > new Date()),
        );
        cookies.set("userName", name, { expires: 7 });
        cookies.set("userEmail", email, { expires: 7 });
        const removalOverride = isPhotoRemovalOverride(email);
        if (avatar && !removalOverride) {
          setPhotoEverywhere(avatar, {
            persistCookie: true,
            emailOverride: email,
            emitEvent: false,
          });
        } else {
          cookies.remove("userPhoto");
          if (!avatar) {
            setPhotoRemovalOverride(email, false);
          }
          setUserPhoto(resolveImageUrl(getStoredPhotoForUser(email)));
        }
      }
    } catch (error) {
      // Silent fallback to cookies
    }
  };

  const fetchPrimaryPhone = async () => {
    const token = getAuthToken();
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
      if (!token) {
        applyLocalPhotoFallback(file, "Profile photo updated locally!");
        return;
      }

      const response = await fetch(`${API_URL}/api/user/upload-photo`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${fallbackToken}`,
        },
        credentials: "include",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Photo upload failed with status ${response.status}`);
      }

      const data = await response.json();
      const uploadedPhoto = data?.data?.photo || data?.data?.avatar || "";

      if (data.success && uploadedPhoto) {
        setPhotoEverywhere(uploadedPhoto, { persistCookie: true });
        toast.success("Profile photo updated!");
      } else {
        applyLocalPhotoFallback(file, "Profile photo updated locally!");
      }
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("Profile photo upload failed, using local fallback");
      }
      applyLocalPhotoFallback(file, "Profile photo updated locally!");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleRemovePhoto = async () => {
    if (!userPhoto) return;

    setUploadingPhoto(true);
    try {
      const token = cookies.get("accessToken");
      if (!token) {
        setPhotoEverywhere("", { persistCookie: false, markRemoved: true });
        toast.success("Profile photo removed!");
        return;
      }

      const attempts = [
        {
          url: `${API_URL}/api/user/remove-photo`,
          method: "DELETE",
        },
        {
          url: `${API_URL}/api/user/remove-photo`,
          method: "POST",
        },
        {
          url: `${API_URL}/api/user/profile`,
          method: "PUT",
          body: { avatar: "" },
        },
      ];

      let backendUpdated = false;
      for (const attempt of attempts) {
        const response = await fetch(attempt.url, {
          method: attempt.method,
          headers: {
            Authorization: `Bearer ${token}`,
            ...(attempt.body ? { "Content-Type": "application/json" } : {}),
          },
          credentials: "include",
          ...(attempt.body ? { body: JSON.stringify(attempt.body) } : {}),
        });

        const data = await response.json().catch(() => null);
        if (response.ok && data?.success !== false) {
          backendUpdated = true;
          break;
        }
      }

      setPhotoEverywhere("", { persistCookie: false, markRemoved: true });
      if (backendUpdated) {
        toast.success("Profile photo removed!");
      } else {
        toast.success("Profile photo removed locally");
      }
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("Profile photo remove failed");
      }
      setPhotoEverywhere("", { persistCookie: false, markRemoved: true });
      toast.success("Profile photo removed locally");
    } finally {
      setUploadingPhoto(false);
    }
  };

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
      clearStoredPhotoForUser(userEmail || cookies.get("userEmail"));

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
      className="accountSidebar w-full shadow-md rounded-md sticky top-[80px]"
      style={{ backgroundColor: "var(--flavor-card-bg, #fffbf5)" }}
    >
      <div className="profileSection py-5 pb-0">
        {/* Profile Image with Upload */}
        <div className="flex flex-row lg:flex-col items-center gap-4 px-4 lg:px-0">
          <div className="profileImg w-[60px] h-[60px] lg:w-[100px] lg:h-[100px] rounded-full overflow-hidden relative group cursor-pointer shrink-0">
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
              className={`w-full h-full bg-gradient-to-br from-primary to-[var(--flavor-hover)] flex items-center justify-center text-white text-xl lg:text-2xl font-bold ${userPhoto ? "hidden" : "flex"}`}
            >
              {getInitials(userName)}
            </div>

            {/* Upload Overlay */}
            <div
              className="overlay w-full h-full rounded-full bg-[rgba(0,0,0,0.6)] absolute top-0 left-0 flex flex-col items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-all"
            >
              {uploadingPhoto ? (
                <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1 text-white text-xs bg-white/15 hover:bg-white/25 px-2 py-1 rounded-md"
                  >
                    <FiCamera size={14} className="text-white" />
                    Change
                  </button>
                  {userPhoto && (
                    <button
                      type="button"
                      onClick={handleRemovePhoto}
                      className="flex items-center gap-1 text-white text-xs bg-red-500/70 hover:bg-red-500/90 px-2 py-1 rounded-md"
                    >
                      <FiTrash2 size={14} className="text-white" />
                      Remove
                    </button>
                  )}
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

          <div className="text-left lg:text-center shrink-0">
            <div className="flex items-center gap-2 lg:justify-center">
              <h4 className="text-[16px] lg:text-[18px] font-[600] text-gray-700">{userName}</h4>
              <MemberBadge isMember={isMember} className="text-[9px]" />
            </div>
            <p className="text-[13px] lg:text-[14px] text-gray-600">{userEmail}</p>
            {userPhone && (
              <p className="text-[12px] lg:text-[13px] text-gray-500 mt-0.5">{userPhone}</p>
            )}
          </div>
        </div>

        {/* Navigation Links */}
        <div className="bg-[#f1f1f1] mt-4 flex flex-row lg:flex-col gap-2 p-2 lg:py-2 myAcc overflow-x-auto scrollbar-hide scroll-smooth snap-x snap-mandatory">
          {Navinks?.map((item, index) => {
            const isActive = pathname === item.href;
            return (
              <Link href={item.href} className="flex shrink-0 min-w-fit snap-start" key={index}>
                <Button
                  className={`!capitalize !w-auto lg:!w-full !justify-center lg:!justify-start !px-4 lg:!px-5 !py-[8px] gap-2 !text-[14px] lg:!text-[15px] !font-[600] rounded-full lg:rounded-md transition-all whitespace-nowrap ${isActive
                    ? "!bg-white lg:!bg-transparent !text-[var(--primary)] !shadow-sm lg:!shadow-none border border-gray-200 lg:border-none active"
                    : "!text-gray-600 hover:!bg-white/50"
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
            className="!text-red-600 !capitalize !w-auto lg:!w-full !justify-center lg:!justify-start !px-4 lg:!px-5 !py-[8px] gap-2 !text-[14px] lg:!text-[15px] !font-[600] rounded-full lg:rounded-md shrink-0 whitespace-nowrap snap-start hover:!bg-red-50"
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
