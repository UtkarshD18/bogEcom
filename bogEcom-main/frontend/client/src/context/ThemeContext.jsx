"use client";
import Cookies from "js-cookie";
import { useRouter } from "next/navigation";
import { createContext, useEffect, useState } from "react";
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
    color: "#4B2E2B",
    hover: "#3A2321",
    light: "#F5EFED",
    glass: "rgba(75,46,43,0.15)",
    gradient: "linear-gradient(135deg, #F5EFED 0%, #FAF7F6 50%, #FFFFFF 100%)",
    cardBg: "#FBF8F7",
    badge: "#6B4A47",
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

const ThemeProvider = ({ children }) => {
  const [isOpenAddressBox, setIsOpenAddressBox] = useState(false);
  const [isLogin, setIsLogin] = useState(false);
  const [user, setUser] = useState({
    email: "",
    Password: "",
  });
  const [flavor, setFlavor] = useState(DEFAULT_FLAVOR);
  const [mounted, setMounted] = useState(false);

  const router = useRouter();

  // Initialize theme from localStorage on mount
  useEffect(() => {
    const savedFlavor = localStorage.getItem("selectedFlavor");
    if (savedFlavor) {
      try {
        const parsed = JSON.parse(savedFlavor);
        // Match with our FLAVORS object to get full palette
        const flavorKey = Object.keys(FLAVORS).find(
          (key) => FLAVORS[key].name === parsed.name,
        );
        const resolvedFlavor = flavorKey ? FLAVORS[flavorKey] : DEFAULT_FLAVOR;
        setFlavor(resolvedFlavor);
        applyThemeToDOM(resolvedFlavor);
      } catch {
        setFlavor(DEFAULT_FLAVOR);
        applyThemeToDOM(DEFAULT_FLAVOR);
      }
    } else {
      // Set default flavor in localStorage on first visit
      localStorage.setItem("selectedFlavor", JSON.stringify(DEFAULT_FLAVOR));
      applyThemeToDOM(DEFAULT_FLAVOR);
    }
    setMounted(true);

    const token = Cookies.get("accessToken");
    if (token !== undefined && token !== null && token !== "") {
      Cookies.remove("actionType");
      setIsLogin(true);
      setUser({
        name: Cookies.get("userName"),
        email: Cookies.get("userEmail"),
      });
      router.push("/");
    }
  }, []);

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

  const applyThemeToDOM = (themeColor) => {
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

    // Update body background
    document.body.style.background = `linear-gradient(180deg, ${themeColor.light} 0%, #FFFFFF 100%)`;
  };

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
    flavor: mounted ? flavor : DEFAULT_FLAVOR,
    setSelectedFlavor,
    FLAVORS,
  };

  return <MyContext.Provider value={values}>{children}</MyContext.Provider>;
};
export default ThemeProvider;
