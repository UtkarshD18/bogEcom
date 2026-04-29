"use client";
import {
  hasAdminPermission,
  normalizeManagerPermissions,
} from "@/utils/adminPermissions";
import { getData, postData } from "@/utils/api";
import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

const AdminContext = createContext();
const isProduction = process.env.NODE_ENV === "production";
// Dev-only logging to avoid leaking auth details in production
const debugLog = (...args) => {
  if (!isProduction) {
    console.log(...args);
  }
};
const debugWarn = (...args) => {
  if (!isProduction) {
    console.warn(...args);
  }
};

const PRIVILEGED_ADMIN_ROLES = new Set(["admin", "manager"]);
const isPrivilegedAdminRole = (role) =>
  PRIVILEGED_ADMIN_ROLES.has(
    String(role || "")
      .trim()
      .toLowerCase(),
  );

const normalizeAdminPayload = (input) => {
  if (!input || typeof input !== "object") return null;
  const email = String(input.email || input.userEmail || "").trim();
  const explicitName = String(
    input.name || input.userName || input.username || input.fullName || "",
  ).trim();
  const fallbackName = email ? email.split("@")[0] : "Admin";
  return {
    ...input,
    email,
    userEmail: email,
    name: explicitName || fallbackName,
    managerPermissions: normalizeManagerPermissions(input.managerPermissions),
  };
};

export const AdminProvider = ({ children }) => {
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(null);
  const router = useRouter();

  const updateAdminProfile = useCallback((updates = {}) => {
    setAdmin((prev) => {
      const normalized = normalizeAdminPayload({
        ...(prev || {}),
        ...(updates || {}),
      });
      if (normalized) {
        localStorage.setItem("adminUser", JSON.stringify(normalized));
      }
      return normalized;
    });
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("adminToken");
    localStorage.removeItem("adminUser");
    setAdmin(null);
    setToken(null);
    router.push("/login");
  }, [router]);

  const checkAdminSession = useCallback(async () => {
    try {
      const storedToken = localStorage.getItem("adminToken");
      const storedAdmin = localStorage.getItem("adminUser");

      debugLog("AdminContext checkAdminSession:", {
        hasStoredToken: !!storedToken,
        tokenType: typeof storedToken,
        tokenLength: storedToken ? storedToken.length : 0,
      });

      if (!storedToken && !storedAdmin) {
        return;
      }

      let adminData = null;
      if (storedAdmin) {
        try {
          adminData = normalizeAdminPayload(JSON.parse(storedAdmin));
        } catch (parseError) {
          console.error("Error parsing admin data:", parseError);
          logout();
          return;
        }
      }

      if (adminData) {
        setAdmin(adminData);
      }

      if (storedToken) {
        setToken(storedToken);

        debugLog("Token and admin restored from localStorage:", {
          tokenLength: storedToken.length,
          hasAdmin: !!adminData,
        });

        try {
          const response = await getData("/api/user/user-details", storedToken);
          if (
            response.error === false &&
            isPrivilegedAdminRole(response.data?.role) &&
            adminData
          ) {
            const mergedProfile = normalizeAdminPayload({
              ...adminData,
              _id: response.data?._id || adminData?._id,
              userId: response.data?._id || adminData?.userId,
              name: response.data?.name || adminData?.name,
              email: response.data?.email || adminData?.email,
              userEmail: response.data?.email || adminData?.userEmail,
              role: response.data?.role || adminData?.role,
              avatar: response.data?.avatar || adminData?.avatar,
              managerPermissions:
                response.data?.managerPermissions ||
                adminData?.managerPermissions,
            });

            if (mergedProfile) {
              setAdmin(mergedProfile);
              localStorage.setItem("adminUser", JSON.stringify(mergedProfile));
            }

            debugLog("Token verified successfully with server");
          } else {
            debugWarn(
              "Token verification returned error, but keeping token available",
            );
          }
        } catch (verifyError) {
          debugWarn(
            "Token verification failed, but keeping token available:",
            verifyError.message,
          );
        }
        return;
      }

      if (adminData) {
        try {
          const response = await postData("/api/user/refresh-token", {});
          const refreshedToken = response?.data?.accessToken || null;
          if (refreshedToken) {
            setToken(refreshedToken);
            localStorage.setItem("adminToken", refreshedToken);
            debugLog("Refreshed missing admin token from existing session");
            return;
          }
        } catch (refreshError) {
          debugWarn(
            "Could not refresh admin token from session:",
            refreshError?.message,
          );
        }

        debugWarn("Admin profile exists but no valid token could be restored.");
      }
    } catch (error) {
      console.error("Session check error:", error);
    } finally {
      setLoading(false);
    }
  }, [logout]);

  useEffect(() => {
    // Check for existing session on mount
    checkAdminSession();
  }, [checkAdminSession]);

  useEffect(() => {
    const handleTokenRefreshed = (event) => {
      const nextToken = event?.detail;
      if (typeof nextToken === "string" && nextToken.trim()) {
        setToken(nextToken);
        return;
      }
      setToken(null);
    };

    window.addEventListener("adminTokenRefreshed", handleTokenRefreshed);
    return () =>
      window.removeEventListener("adminTokenRefreshed", handleTokenRefreshed);
  }, []);

  const login = useCallback(async (email, password) => {
    try {
      const response = await postData("/api/admin/login", { email, password });

      if (response.error === false) {
        const { data } = response;
        const normalizedAdmin = normalizeAdminPayload(data) || data;

        // Check if user is an admin
        if (!isPrivilegedAdminRole(data?.role)) {
          return {
            error: true,
            message: "Access denied. Admin or Manager privileges required.",
          };
        }

        // Store token and admin data
        const accessToken = data.accessToken;
        debugLog("Login successful, storing token:", {
          tokenType: typeof accessToken,
          tokenLength: accessToken ? accessToken.length : 0,
          isString: typeof accessToken === "string",
        });
        debugLog("Full response data:", {
          id: data?._id,
          email: data?.email,
          role: data?.role,
        });

        if (typeof accessToken !== "string") {
          console.error("ERROR: accessToken is not a string!", {
            tokenType: typeof accessToken,
            tokenKeys: Object.keys(accessToken),
          });
        }

        localStorage.setItem("adminToken", accessToken);
        localStorage.setItem("adminUser", JSON.stringify(normalizedAdmin));

        setAdmin(normalizedAdmin);
        setToken(accessToken);

        return { error: false, message: "Login successful" };
      }

      return response;
    } catch (error) {
      console.error("Login error:", error);
      return { error: true, message: "Login failed. Please try again." };
    }
  }, []);

  const value = useMemo(
    () => ({
      admin,
      token,
      loading,
      login,
      logout,
      updateAdminProfile,
      hasPermission: (permission) => hasAdminPermission(admin, permission),
      isAuthenticated: !!admin,
    }),
    [admin, token, loading, login, logout, updateAdminProfile],
  );

  return (
    <AdminContext.Provider value={value}>{children}</AdminContext.Provider>
  );
};

export const useAdmin = () => {
  const context = useContext(AdminContext);
  if (!context) {
    throw new Error("useAdmin must be used within an AdminProvider");
  }
  return context;
};

export default AdminContext;
