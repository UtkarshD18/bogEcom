"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "hog_admin_live_refresh_ms";
const DEFAULT_REFRESH_MS = 1000;
const ALLOWED_REFRESH_MS = [1000, 5000, 10000];

const normalizeInterval = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_REFRESH_MS;
  if (!ALLOWED_REFRESH_MS.includes(parsed)) return DEFAULT_REFRESH_MS;
  return parsed;
};

export const LIVE_REFRESH_OPTIONS = [
  { label: "1s", value: 1000 },
  { label: "5s", value: 5000 },
  { label: "10s", value: 10000 },
];

export const getStoredLiveRefreshInterval = () => {
  if (typeof window === "undefined") return DEFAULT_REFRESH_MS;
  return normalizeInterval(localStorage.getItem(STORAGE_KEY));
};

export const useLiveRefreshSetting = () => {
  const [intervalMs, setIntervalMs] = useState(DEFAULT_REFRESH_MS);

  useEffect(() => {
    setIntervalMs(getStoredLiveRefreshInterval());
  }, []);

  const updateInterval = useCallback((nextValue) => {
    if (typeof window === "undefined") return;
    const normalized = normalizeInterval(nextValue);
    localStorage.setItem(STORAGE_KEY, String(normalized));
    setIntervalMs(normalized);
    window.dispatchEvent(
      new CustomEvent("adminLiveRefreshChanged", { detail: normalized }),
    );
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const handleChange = (event) => {
      const nextValue =
        event?.detail !== undefined
          ? event.detail
          : localStorage.getItem(STORAGE_KEY);
      setIntervalMs(normalizeInterval(nextValue));
    };

    window.addEventListener("adminLiveRefreshChanged", handleChange);
    window.addEventListener("storage", handleChange);
    return () => {
      window.removeEventListener("adminLiveRefreshChanged", handleChange);
      window.removeEventListener("storage", handleChange);
    };
  }, []);

  const options = useMemo(() => LIVE_REFRESH_OPTIONS, []);

  return { intervalMs, setIntervalMs: updateInterval, options };
};

export default useLiveRefreshSetting;
