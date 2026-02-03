"use client";
import { getData, postData } from "@/utils/api";
import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

const AdminContext = createContext();

export const AdminProvider = ({ children }) => {
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(null);
  const router = useRouter();

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

      console.log("AdminContext checkAdminSession:", {
        hasStoredToken: !!storedToken,
        tokenType: typeof storedToken,
        tokenLength: storedToken ? storedToken.length : 0,
      });

      if (storedToken && storedAdmin) {
        try {
          const adminData = JSON.parse(storedAdmin);

          // ALWAYS set token and admin from localStorage
          // Don't wait for verification - token should be immediately available
          setToken(storedToken);
          setAdmin(adminData);

          console.log("Token and admin set from localStorage:", {
            tokenLength: storedToken.length,
            hasAdmin: !!adminData,
          });

          // Verify token is still valid, but don't clear it if verification fails
          // (verification might fail due to network issues or server problems)
          try {
            const response = await getData(
              "/api/user/user-details",
              storedToken,
            );
            if (response.error === false && response.data?.role === "Admin") {
              console.log("Token verified successfully with server");
            } else {
              console.warn(
                "Token verification returned error, but keeping token available",
              );
            }
          } catch (verifyError) {
            // Log error but don't logout - network might be temporarily down
            console.warn(
              "Token verification failed, but keeping token available:",
              verifyError.message,
            );
          }
        } catch (parseError) {
          console.error("Error parsing admin data:", parseError);
          logout();
        }
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

  const login = async (email, password) => {
    try {
      const response = await postData("/api/user/login", { email, password });

      if (response.error === false) {
        const { data } = response;

        // Check if user is an admin
        if (data.role !== "Admin") {
          return {
            error: true,
            message: "Access denied. Admin privileges required.",
          };
        }

        // Store token and admin data
        const accessToken = data.accessToken;
        console.log("Login successful, storing token:", {
          tokenType: typeof accessToken,
          tokenLength: accessToken ? accessToken.length : 0,
          tokenValue:
            typeof accessToken === "string"
              ? accessToken.substring(0, 30)
              : String(accessToken).substring(0, 30),
          isString: typeof accessToken === "string",
        });
        console.log("Full response data:", data);

        if (typeof accessToken !== "string") {
          console.error("ERROR: accessToken is not a string!", {
            tokenType: typeof accessToken,
            tokenKeys: Object.keys(accessToken),
          });
        }

        localStorage.setItem("adminToken", accessToken);
        localStorage.setItem("adminUser", JSON.stringify(data));

        setAdmin(data);
        setToken(accessToken);

        return { error: false, message: "Login successful" };
      }

      return response;
    } catch (error) {
      console.error("Login error:", error);
      return { error: true, message: "Login failed. Please try again." };
    }
  };

  const value = {
    admin,
    token,
    loading,
    login,
    logout,
    isAuthenticated: !!admin,
  };

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
