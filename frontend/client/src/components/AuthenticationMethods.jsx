"use client";
import cookies from "js-cookie";
import { useEffect, useState } from "react";
import { FcGoogle } from "react-icons/fc";
import { MdEmail, MdSecurity, MdVerifiedUser } from "react-icons/md";

const normalizeIdentity = (value) => String(value || "").trim().toLowerCase();
const getPhotoStorageKey = (emailValue) => {
  const normalizedEmail = normalizeIdentity(emailValue);
  return normalizedEmail ? `userPhoto:${normalizedEmail}` : "";
};
const getPhotoRemovedKey = (emailValue) => {
  const normalizedEmail = normalizeIdentity(emailValue);
  return normalizedEmail ? `userPhotoRemoved:${normalizedEmail}` : "";
};

const getClientSnapshot = () => {
  const userEmail = cookies.get("userEmail") || "";
  if (typeof window === "undefined") {
    return {
      userEmail,
      userPhoto: "",
    };
  }

  const removedKey = getPhotoRemovedKey(userEmail);
  const isRemoved = removedKey ? localStorage.getItem(removedKey) === "1" : false;
  const localPhotoKey = getPhotoStorageKey(userEmail);
  const storedPhoto = localPhotoKey ? localStorage.getItem(localPhotoKey) || "" : "";
  const userPhoto = isRemoved ? "" : cookies.get("userPhoto") || storedPhoto || "";

  return {
    userEmail,
    userPhoto,
  };
};

const AuthenticationMethods = () => {
  const [authSnapshot, setAuthSnapshot] = useState({
    userEmail: "",
    userPhoto: "",
  });

  useEffect(() => {
    const syncAuthSnapshot = () => {
      const nextSnapshot = getClientSnapshot();
      setAuthSnapshot((prevSnapshot) => {
        if (
          prevSnapshot.userEmail === nextSnapshot.userEmail &&
          prevSnapshot.userPhoto === nextSnapshot.userPhoto
        ) {
          return prevSnapshot;
        }
        return nextSnapshot;
      });
    };

    syncAuthSnapshot();
    window.addEventListener("loginSuccess", syncAuthSnapshot);
    window.addEventListener("focus", syncAuthSnapshot);
    window.addEventListener("storage", syncAuthSnapshot);

    return () => {
      window.removeEventListener("loginSuccess", syncAuthSnapshot);
      window.removeEventListener("focus", syncAuthSnapshot);
      window.removeEventListener("storage", syncAuthSnapshot);
    };
  }, []);

  const { userEmail, userPhoto } = authSnapshot;
  const authMethods = {
    hasEmail: !!userEmail,
    hasGoogle: !!userPhoto, // Presence of photo indicates Google auth
  };

  return (
    <div
      className="rounded-lg shadow-md p-6 mb-6"
      style={{ backgroundColor: "var(--flavor-card-bg, #fffbf5)" }}
    >
      <div className="flex items-center gap-3 mb-4">
        <MdSecurity className="text-green-500 text-2xl" />
        <div>
          <h3 className="text-lg font-semibold text-gray-800">
            Authentication Methods
          </h3>
          <p className="text-sm text-gray-600">Your current login methods</p>
        </div>
      </div>

      <div className="space-y-3">
        {/* Email Authentication */}
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-3">
            <MdEmail className="text-blue-500 text-xl" />
            <div>
              <span className="font-medium">Email & Password</span>
              <p className="text-sm text-gray-600">
                {userEmail || "No email set"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {authMethods.hasEmail && (
              <MdVerifiedUser className="text-green-500" />
            )}
            <span
              className={`text-sm px-2 py-1 rounded ${authMethods.hasEmail
                  ? "bg-[var(--flavor-glass)] text-primary"
                  : "bg-gray-100 text-gray-500"
                }`}
            >
              {authMethods.hasEmail ? "Active" : "Not Set"}
            </span>
          </div>
        </div>

        {/* Google Authentication */}
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-3">
            <FcGoogle className="text-xl" />
            <div>
              <span className="font-medium">Google Account</span>
              <p className="text-sm text-gray-600">
                {authMethods.hasGoogle
                  ? "Connected via Google"
                  : "Not connected"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {authMethods.hasGoogle && (
              <MdVerifiedUser className="text-green-500" />
            )}
            <span
              className={`text-sm px-2 py-1 rounded ${authMethods.hasGoogle
                  ? "bg-[var(--flavor-glass)] text-primary"
                  : "bg-gray-100 text-gray-500"
                }`}
            >
              {authMethods.hasGoogle ? "Connected" : "Not Connected"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthenticationMethods;
