"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "membershipPageTheme";
const DEFAULT_THEME = "mint-glass";
const SUPPORTED_THEMES = [
  "sky-glass",
  "mint-glass",
  "aurora-glass",
  "lavender-glass",
  "sunset-glass",
  "midnight-glass",
];

const THEME_ALIAS = {
  sky: "sky-glass",
  mint: "mint-glass",
  aurora: "aurora-glass",
  lavender: "lavender-glass",
  sunset: "sunset-glass",
  midnight: "midnight-glass",
};

const normalizeTheme = (value) => {
  const rawTheme = String(value || "").trim().toLowerCase();
  if (SUPPORTED_THEMES.includes(rawTheme)) return rawTheme;
  if (THEME_ALIAS[rawTheme]) return THEME_ALIAS[rawTheme];
  return DEFAULT_THEME;
};

const ThemeContext = createContext(null);

export const ThemeProvider = ({ children }) => {
  const [theme, setThemeState] = useState(DEFAULT_THEME);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const storedTheme = normalizeTheme(localStorage.getItem(STORAGE_KEY));
    setThemeState(storedTheme);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const normalizedTheme = normalizeTheme(theme);
    document.documentElement.setAttribute("data-theme", normalizedTheme);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, normalizedTheme);
    }
  }, [theme]);

  const setTheme = useCallback((nextTheme) => {
    setThemeState(normalizeTheme(nextTheme));
  }, []);

  const value = useMemo(
    () => ({
      theme: normalizeTheme(theme),
      setTheme,
    }),
    [theme, setTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
};

export default ThemeProvider;
