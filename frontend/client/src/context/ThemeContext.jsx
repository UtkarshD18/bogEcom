"use client";

import { API_BASE_URL } from "@/utils/api";
import Cookies from "js-cookie";
import { useRouter } from "next/navigation";
import { createContext, useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";

export const MyContext = createContext();

// Enhanced flavor palettes with background, accent, hover, and light variants
export const FLAVORS = {
  creamy: {
    name: "Creamy",
    color: "#F5C16C",
    hover: "#E5A84D",
    light: "#FDF5E6",
    glass: "rgba(245,193,108,0.15)",
    gradient: "linear-gradient(135deg, #FDF5E6 0%, #FFF8ED 50%, #FFFFFF 100%)",
    cardBg: "#FFFBF5",
    badge: "#D4A84B",
  },
  chocolate: {
    name: "Chocolate",
    color: "#A0694B",
    hover: "#8B5A3C",
    light: "#FBF3EE",
    glass: "rgba(160,105,75,0.15)",
    gradient: "linear-gradient(135deg, #FBF3EE 0%, #FDF8F5 50%, #FFFFFF 100%)",
    cardBg: "#FDF8F5",
    badge: "#8B5A3C",
  },
  millets: {
    name: "Millets",
    color: "#6B8E23",
    hover: "#556B2F",
    light: "#F5F8EC",
    glass: "rgba(107,142,35,0.15)",
    gradient: "linear-gradient(135deg, #F5F8EC 0%, #FAFCF5 50%, #FFFFFF 100%)",
    cardBg: "#FAFCF7",
    badge: "#7A9E32",
  },
  nutty: {
    name: "Nutty",
    color: "#D9A066",
    hover: "#C48B4F",
    light: "#FDF7F0",
    glass: "rgba(217,160,102,0.15)",
    gradient: "linear-gradient(135deg, #FDF7F0 0%, #FFF9F3 50%, #FFFFFF 100%)",
    cardBg: "#FFFAF5",
    badge: "#C9904D",
  },
};

// Default flavor is Creamy
const DEFAULT_FLAVOR = FLAVORS.creamy;
const resolveInitialFlavor = () => {
  if (typeof window === "undefined") {
    return DEFAULT_FLAVOR;
  }

  const savedFlavor = localStorage.getItem("selectedFlavor");
  if (!savedFlavor) {
    return DEFAULT_FLAVOR;
  }

  try {
    const parsed = JSON.parse(savedFlavor);
    const flavorKey = Object.keys(FLAVORS).find(
      (key) => FLAVORS[key].name === parsed.name,
    );
    return flavorKey ? FLAVORS[flavorKey] : DEFAULT_FLAVOR;
  } catch {
    return DEFAULT_FLAVOR;
  }
};
const getStoredAccessToken = () => {
  if (typeof window === "undefined") return Cookies.get("accessToken") || "";
  return (
    Cookies.get("accessToken") ||
    localStorage.getItem("accessToken") ||
    localStorage.getItem("token") ||
    ""
  );
};
const decodeJwtPayload = (token) => {
  try {
    const tokenPart = String(token || "").split(".")[1];
    if (!tokenPart) return null;
    const normalized = tokenPart
      .replace(/-/g, "+")
      .replace(/_/g, "/")
      .padEnd(Math.ceil(tokenPart.length / 4) * 4, "=");
    return JSON.parse(atob(normalized));
  } catch {
    return null;
  }
};

const ThemeProvider = ({ children }) => {
  const [isOpenAddressBox, setIsOpenAddressBox] = useState(false);
  const [isLogin, setIsLogin] = useState(false);
  const [user, setUser] = useState({
    email: "",
    Password: "",
  });
  const [flavor, setFlavor] = useState(resolveInitialFlavor);

  const router = useRouter();
  const applyThemeToDOM = useCallback((themeColor) => {
    if (typeof window === "undefined") return;

    const root = document.documentElement;

    // Set CSS variables for global theming
    root.style.setProperty("--flavor-color", themeColor.color);
    root.style.setProperty("--flavor-hover", themeColor.hover);
    root.style.setProperty("--flavor-light", themeColor.light);
    root.style.setProperty("--flavor-glass", themeColor.glass);
    root.style.setProperty("--flavor-card-bg", themeColor.cardBg);
    root.style.setProperty("--flavor-badge", themeColor.badge);
    root.style.setProperty("--flavor-gradient", themeColor.gradient);
    root.style.setProperty("--flavor-surface", themeColor.cardBg);
    root.style.setProperty(
      "--flavor-page-bg",
      `linear-gradient(180deg, ${themeColor.light} 0%, #FFFFFF 100%)`,
    );
    root.style.setProperty("--primary", themeColor.color);
    root.style.setProperty("--color-primary", themeColor.color);

    // Update body background
    document.body.style.background = `linear-gradient(180deg, ${themeColor.light} 0%, #FFFFFF 100%)`;
  }, []);

  // Initialize theme + auth state from persisted storage on mount.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (typeof window !== "undefined") {
      if (!localStorage.getItem("selectedFlavor")) {
        localStorage.setItem("selectedFlavor", JSON.stringify(flavor));
      }
      applyThemeToDOM(flavor);
    }
    const token = getStoredAccessToken();
    let tokenValid = false;
    if (token) {
      const payload = decodeJwtPayload(token);
      tokenValid = Boolean(payload?.exp && payload.exp * 1000 > Date.now());
    }
    if (tokenValid) {
      Cookies.remove("actionType");
      setIsLogin(true);
      setUser({
        name:
          Cookies.get("userName") ||
          (typeof window !== "undefined"
            ? localStorage.getItem("userName")
            : ""),
        email:
          Cookies.get("userEmail") ||
          (typeof window !== "undefined"
            ? localStorage.getItem("userEmail")
            : ""),
      });
    } else if (token) {
      // Token expired — try refreshing before giving up
      const refreshToken =
        Cookies.get("refreshToken") ||
        (typeof window !== "undefined"
          ? localStorage.getItem("refreshToken")
          : "");
      if (refreshToken) {
        fetch(
          `${API_BASE_URL}/api/user/refresh-token`,
          {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refreshToken }),
          },
        )
          .then((r) => (r.ok ? r.json() : null))
          .then((data) => {
            const newToken = data?.data?.accessToken;
            if (newToken) {
              Cookies.set("accessToken", newToken, { expires: 7 });
              if (typeof window !== "undefined") {
                localStorage.setItem("accessToken", newToken);
                localStorage.setItem("token", newToken);
              }
              setIsLogin(true);
              setUser({
                name:
                  Cookies.get("userName") ||
                  (typeof window !== "undefined"
                    ? localStorage.getItem("userName")
                    : ""),
                email:
                  Cookies.get("userEmail") ||
                  (typeof window !== "undefined"
                    ? localStorage.getItem("userEmail")
                    : ""),
              });
            } else {
              // Refresh failed — clear stale cookies
              Cookies.remove("accessToken");
              Cookies.remove("refreshToken");
              Cookies.remove("userName");
              Cookies.remove("userEmail");
              Cookies.remove("userPhoto");
              if (typeof window !== "undefined") {
                localStorage.removeItem("accessToken");
                localStorage.removeItem("token");
                localStorage.removeItem("refreshToken");
                localStorage.removeItem("userName");
                localStorage.removeItem("userEmail");
                localStorage.removeItem("userPhoto");
              }
              setIsLogin(false);
            }
          })
          .catch(() => {
            Cookies.remove("accessToken");
            Cookies.remove("refreshToken");
            Cookies.remove("userName");
            Cookies.remove("userEmail");
            Cookies.remove("userPhoto");
            if (typeof window !== "undefined") {
              localStorage.removeItem("accessToken");
              localStorage.removeItem("token");
              localStorage.removeItem("refreshToken");
              localStorage.removeItem("userName");
              localStorage.removeItem("userEmail");
              localStorage.removeItem("userPhoto");
            }
            setIsLogin(false);
          });
      } else {
        // No refresh token — clear stale cookies
        Cookies.remove("accessToken");
        Cookies.remove("userName");
        Cookies.remove("userEmail");
        Cookies.remove("userPhoto");
        if (typeof window !== "undefined") {
          localStorage.removeItem("accessToken");
          localStorage.removeItem("token");
          localStorage.removeItem("refreshToken");
          localStorage.removeItem("userName");
          localStorage.removeItem("userEmail");
          localStorage.removeItem("userPhoto");
        }
        setIsLogin(false);
      }
    }
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Listen for flavor changes from FlavorSwitcherBar
  useEffect(() => {
    const handleFlavorChange = (event) => {
      const newFlavor = event.detail;
      // Match with our FLAVORS object to get full palette
      const flavorKey = Object.keys(FLAVORS).find(
        (key) => FLAVORS[key].name === newFlavor.name,
      );
      const fullFlavor = flavorKey ? FLAVORS[flavorKey] : newFlavor;
      setFlavor(fullFlavor);
      applyThemeToDOM(fullFlavor);
    };

    window.addEventListener("themeChange", handleFlavorChange);
    return () => window.removeEventListener("themeChange", handleFlavorChange);
  }, []);

  const setSelectedFlavor = (newFlavor) => {
    setFlavor(newFlavor);
    localStorage.setItem("selectedFlavor", JSON.stringify(newFlavor));
    applyThemeToDOM(newFlavor);
  };

  const isOpenAddressPanel = () => {
    setIsOpenAddressBox(!isOpenAddressBox);
  };

  const alertBox = (type, msg) => {
    if (type === "success") {
      toast.success(msg);
    } else {
      toast.error(msg);
    }
  };

  const values = {
    setIsOpenAddressBox,
    isOpenAddressBox,
    isOpenAddressPanel,
    alertBox,
    setIsLogin,
    isLogin,
    setUser,
    user,
    flavor,
    setSelectedFlavor,
    FLAVORS,
  };

  return <MyContext.Provider value={values}>{children}</MyContext.Provider>;
};
export default ThemeProvider;
