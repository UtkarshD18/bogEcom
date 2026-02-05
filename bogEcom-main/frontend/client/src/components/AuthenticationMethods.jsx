"use client";
import cookies from "js-cookie";
import { useEffect, useState } from "react";
import { FcGoogle } from "react-icons/fc";
import { MdEmail, MdSecurity, MdVerifiedUser } from "react-icons/md";

const AuthenticationMethods = () => {
  const [authMethods, setAuthMethods] = useState({
    hasEmail: false,
    hasGoogle: false,
    hasBackupPassword: false,
  });

  useEffect(() => {
    const userEmail = cookies.get("userEmail");
    const userPhoto = cookies.get("userPhoto");

    setAuthMethods({
      hasEmail: !!userEmail,
      hasGoogle: !!userPhoto, // Presence of photo indicates Google auth
      hasBackupPassword: false, // This would come from backend in real app
    });
  }, []);

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
                {cookies.get("userEmail") || "No email set"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {authMethods.hasEmail && (
              <MdVerifiedUser className="text-green-500" />
            )}
            <span
              className={`text-sm px-2 py-1 rounded ${
                authMethods.hasEmail
                  ? "bg-green-100 text-green-700"
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
              className={`text-sm px-2 py-1 rounded ${
                authMethods.hasGoogle
                  ? "bg-green-100 text-green-700"
                  : "bg-gray-100 text-gray-500"
              }`}
            >
              {authMethods.hasGoogle ? "Connected" : "Not Connected"}
            </span>
          </div>
        </div>
      </div>

      {/* Security Recommendations */}
      {authMethods.hasGoogle && !authMethods.hasBackupPassword && (
        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-start gap-2">
            <MdSecurity className="text-yellow-600 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-yellow-800">
                Security Recommendation
              </p>
              <p className="text-sm text-yellow-700">
                Set a backup password to secure your account if Google login
                becomes unavailable.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuthenticationMethods;
