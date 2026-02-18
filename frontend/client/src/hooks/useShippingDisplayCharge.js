"use client";

import { API_BASE_URL } from "@/utils/api";

import { useEffect, useMemo, useState } from "react";
import { getDisplayShippingCharge } from "@/utils/shippingDisplay";

const API_URL = API_BASE_URL;

const CACHE_TTL_MS = 5 * 60 * 1000;
const DEFAULT_METRICS = Object.freeze({
  markupPercent: 30,
  maxLocalBaseCharge: 0,
  maxIndiaBaseCharge: 0,
  maxLocalDisplayCharge: 0,
  maxIndiaDisplayCharge: 0,
});

let cachedMetrics = null;
let cachedAt = 0;

const getCachedMetrics = () => {
  if (!cachedMetrics) return null;
  if (Date.now() - cachedAt > CACHE_TTL_MS) return null;
  return cachedMetrics;
};

/**
 * Shared hook for display-only shipping strike-through values.
 */
export const useShippingDisplayCharge = ({ isRajasthan = false } = {}) => {
  const [metrics, setMetrics] = useState(getCachedMetrics() || DEFAULT_METRICS);

  useEffect(() => {
    let cancelled = false;
    const cache = getCachedMetrics();
    if (cache) {
      return () => {
        cancelled = true;
      };
    }

    const fetchMetrics = async () => {
      try {
        const response = await fetch(`${API_URL}/api/shipping/display-metrics`, {
          method: "GET",
        });
        if (!response.ok) return;

        const payload = await response.json();
        if (!payload?.success || !payload?.data) return;

        const nextMetrics = {
          ...DEFAULT_METRICS,
          ...payload.data,
        };

        cachedMetrics = nextMetrics;
        cachedAt = Date.now();

        if (!cancelled) {
          setMetrics(nextMetrics);
        }
      } catch (_error) {
        // Display fallback remains safe (0 strike charge).
      }
    };

    fetchMetrics();

    return () => {
      cancelled = true;
    };
  }, []);

  const displayShippingCharge = useMemo(
    () =>
      getDisplayShippingCharge({
        isRajasthan,
        metrics,
      }),
    [isRajasthan, metrics],
  );

  return {
    displayShippingCharge,
    metrics,
  };
};

export default useShippingDisplayCharge;
