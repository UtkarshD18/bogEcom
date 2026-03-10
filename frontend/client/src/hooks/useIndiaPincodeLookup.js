"use client";

import { useCallback, useRef, useState } from "react";
import { API_BASE_URL } from "@/utils/api";
import { normalizePincode } from "@/utils/addressForm";

const API_URL = API_BASE_URL.endsWith("/api")
  ? API_BASE_URL.slice(0, -4)
  : API_BASE_URL;

const EMPTY_LOOKUP_STATE = {
  status: "idle",
  message: "",
  requestedPincode: "",
  data: null,
  areaSuggestions: [],
};

const cache = new Map();

const getLookupErrorMessage = (error) => {
  const rawMessage = String(error?.message || "").trim();
  const normalized = rawMessage.toLowerCase();

  if (
    error?.name === "TypeError" ||
    normalized === "failed to fetch" ||
    normalized.includes("networkerror") ||
    normalized.includes("load failed")
  ) {
    return "Unable to reach pincode lookup service right now.";
  }

  return rawMessage || "Failed to lookup pincode";
};

export default function useIndiaPincodeLookup({
  onResolved,
  onError,
} = {}) {
  const requestIdRef = useRef(0);
  const [lookup, setLookup] = useState(EMPTY_LOOKUP_STATE);

  const resetLookup = useCallback(() => {
    requestIdRef.current += 1;
    setLookup(EMPTY_LOOKUP_STATE);
  }, []);

  const lookupPincode = useCallback(
    async (rawPincode) => {
      const pincode = normalizePincode(rawPincode);
      if (pincode.length !== 6) {
        resetLookup();
        return null;
      }

      if (cache.has(pincode)) {
        const data = cache.get(pincode);
        const nextState = {
          status: data?.status === "empty" ? "empty" : "success",
          message:
            data?.status === "empty"
              ? "No India Post matches found for this pincode."
              : "Pincode details resolved.",
          requestedPincode: pincode,
          data,
          areaSuggestions: Array.isArray(data?.areaSuggestions)
            ? data.areaSuggestions
            : [],
        };
        setLookup(nextState);
        onResolved?.(data);
        return data;
      }

      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;
      setLookup({
        status: "loading",
        message: "Resolving pincode details...",
        requestedPincode: pincode,
        data: null,
        areaSuggestions: [],
      });

      try {
        const response = await fetch(
          `${API_URL}/api/address/lookup/pincode/${pincode}`,
          {
            credentials: "include",
          },
        );
        const payload = await response.json().catch(() => ({}));
        if (requestIdRef.current !== requestId) return null;

        if (!response.ok || !payload?.success) {
          throw new Error(payload?.message || "Failed to lookup pincode");
        }

        const data = payload?.data || {};
        cache.set(pincode, data);
        const nextState = {
          status: data?.status === "empty" ? "empty" : "success",
          message:
            data?.status === "empty"
              ? "No India Post matches found for this pincode."
              : "Pincode details resolved.",
          requestedPincode: pincode,
          data,
          areaSuggestions: Array.isArray(data?.areaSuggestions)
            ? data.areaSuggestions
            : [],
        };
        setLookup(nextState);
        onResolved?.(data);
        return data;
      } catch (error) {
        if (requestIdRef.current !== requestId) return null;

        const message = getLookupErrorMessage(error);
        setLookup({
          status: "error",
          message,
          requestedPincode: pincode,
          data: null,
          areaSuggestions: [],
        });
        onError?.(message);
        return null;
      }
    },
    [onError, onResolved, resetLookup],
  );

  return {
    lookup,
    lookupPincode,
    resetLookup,
  };
}
