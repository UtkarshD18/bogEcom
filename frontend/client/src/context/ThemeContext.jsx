"use client";
import Cookies from "js-cookie";
import { useRouter } from "next/navigation";
import { createContext, useEffect, useState } from "react";
import toast from "react-hot-toast";

export const MyContext = createContext();

const FLAVORS = {
  chocolate: {
    name: "Chocolate",
    color: "#4B2E2B",
    glass: "rgba(75,46,43,0.6)",
  },
  creamy: { name: "Creamy", color: "#F5C16C", glass: "rgba(245,193,108,0.6)" },
  millets: {
    name: "Millets",
    color: "#A3C16C",
    glass: "rgba(163,193,108,0.6)",
  },
  nutty: { name: "Nutty", color: "#D9A066", glass: "rgba(217,160,102,0.6)" },
};

const DEFAULT_FLAVOR = FLAVORS.chocolate;

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
        setFlavor(JSON.parse(savedFlavor));
      } catch {
        setFlavor(DEFAULT_FLAVOR);
      }
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
      setFlavor(newFlavor);
      applyThemeToDOM(newFlavor);
    };

    window.addEventListener("themeChange", handleFlavorChange);
    return () => window.removeEventListener("themeChange", handleFlavorChange);
  }, []);

  const applyThemeToDOM = (themeColor) => {
    if (typeof window === "undefined") return;

    // Update body background
    document.body.style.background = `linear-gradient(135deg, ${themeColor.color} 0%, #fff 100%)`;

    // Update main wrapper sections
    const wrappers = document.querySelectorAll(
      ".sliderWrapper, .catSlider, .banners, .mainWrapper",
    );
    wrappers.forEach((el) => {
      el.style.background = `linear-gradient(135deg, ${themeColor.color} 0%, #fff 100%)`;
    });

    // Update themed sections
    const themedSections = document.querySelectorAll("[data-theme-color]");
    themedSections.forEach((el) => {
      el.style.background = `linear-gradient(135deg, ${themeColor.color} 0%, #fff 100%)`;
    });
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
