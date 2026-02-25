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
    color: "#F6E6C9",
    hover: "#EBD5AE",
    text: "#6B4F2A",
    light: "#FFF7E9",
    glass: "rgba(246,230,201,0.35)",
    gradient: "linear-gradient(135deg, #FFF7E9 0%, #FFFDF7 50%, #FFFFFF 100%)",
    cardBg: "#FFFDF7",
    badge: "#D2BB92",
  },
  chocolate: {
    name: "Cholocate",
    color: "#5A3A2E",
    hover: "#472C23",
    text: "#FFFFFF",
    light: "#F7F1EF",
    glass: "rgba(90,58,46,0.24)",
    gradient: "linear-gradient(135deg, #F7F1EF 0%, #FCF8F6 50%, #FFFFFF 100%)",
    cardBg: "#FCF8F6",
    badge: "#472C23",
  },
  millets: {
    name: "Daizu",
    color: "#8FAE5D",
    hover: "#7C984C",
    text: "#2F3E1F",
    light: "#F2F8E9",
    glass: "rgba(143,174,93,0.22)",
    gradient: "linear-gradient(135deg, #F2F8E9 0%, #F8FBEF 50%, #FFFFFF 100%)",
    cardBg: "#F8FBEF",
    badge: "#7C984C",
  },
  nutty: {
    name: "Low-calorie",
    color: "#CFEFE8",
    hover: "#B6E4DA",
    text: "#1F4D46",
    light: "#F0FAF7",
    glass: "rgba(207,239,232,0.45)",
    gradient: "linear-gradient(135deg, #F0FAF7 0%, #F7FCFA 50%, #FFFFFF 100%)",
    cardBg: "#F7FCFA",
    badge: "#8DC7BA",
  },
};

// Default flavor is Creamy
const DEFAULT_FLAVOR = FLAVORS.creamy;
const resolveStoredFlavor = () => {
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
  const [flavor, setFlavor] = useState(DEFAULT_FLAVOR);

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
    root.style.setProperty("--flavor-text", themeColor.text || "#111111");
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
      const storedFlavor = resolveStoredFlavor();
      setFlavor(storedFlavor);
      localStorage.setItem("selectedFlavor", JSON.stringify(storedFlavor));
      applyThemeToDOM(storedFlavor);
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
