"use client";

import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
} from "@mui/material";
import { useCallback, useMemo, useState } from "react";
import { FiMapPin } from "react-icons/fi";

const CONSENT_TEXT =
  "We use Google Maps to fetch your current location to autofill your address.\nYour location data is stored securely for order processing and support purposes for up to 90 days.";

const GOOGLE_MAPS_API_KEY = (
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ""
)
  .trim()
  .replace(/^\"|\"$/g, "");

const loadGoogleMaps = (() => {
  let promise = null;
  return () => {
    if (typeof window === "undefined") return Promise.reject(new Error("SSR"));
    if (window.google?.maps?.Geocoder) return Promise.resolve();
    if (promise) return promise;

    if (!GOOGLE_MAPS_API_KEY) {
      return Promise.reject(
        new Error("Missing NEXT_PUBLIC_GOOGLE_MAPS_API_KEY"),
      );
    }

    promise = new Promise((resolve, reject) => {
      const existing = document.querySelector("script[data-google-maps]");
      if (existing) {
        existing.addEventListener("load", () => resolve());
        existing.addEventListener("error", () =>
          reject(new Error("Failed to load Google Maps script")),
        );
        return;
      }

      const script = document.createElement("script");
      script.setAttribute("data-google-maps", "true");
      script.async = true;
      script.defer = true;
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
        GOOGLE_MAPS_API_KEY,
      )}`;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Failed to load Google Maps script"));
      document.head.appendChild(script);
    });

    return promise;
  };
})();

const getCurrentPosition = () =>
  new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported by this browser."));
      return;
    }

    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0,
    });
  });

const pickComponent = (components, type) =>
  components?.find((c) => Array.isArray(c.types) && c.types.includes(type))
    ?.long_name || "";

const parseGeocodeResult = (result) => {
  const components = result?.address_components || [];
  const streetNumber = pickComponent(components, "street_number");
  const route = pickComponent(components, "route");
  const sublocality =
    pickComponent(components, "sublocality_level_1") ||
    pickComponent(components, "sublocality");
  const locality = pickComponent(components, "locality");
  const adminArea2 = pickComponent(components, "administrative_area_level_2");
  const state = pickComponent(components, "administrative_area_level_1");
  const pincode = pickComponent(components, "postal_code");
  const country = pickComponent(components, "country");

  const streetParts = [streetNumber, route, sublocality].filter(Boolean);
  const street = streetParts.join(", ").trim();
  const city = (locality || adminArea2 || "").trim();

  return {
    formattedAddress: String(result?.formatted_address || "").trim(),
    street,
    city,
    state: String(state || "").trim(),
    pincode: String(pincode || "").trim(),
    country: String(country || "").trim(),
  };
};

const geocodeLatLng = ({ lat, lng }) =>
  new Promise((resolve, reject) => {
    if (!window.google?.maps?.Geocoder) {
      reject(new Error("Google Maps is not loaded"));
      return;
    }

    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ location: { lat, lng } }, (results, status) => {
      if (status !== "OK" || !results || results.length === 0) {
        reject(new Error("Unable to resolve address from location"));
        return;
      }
      resolve(results[0]);
    });
  });

export default function UseCurrentLocationGoogleMaps({
  onResolved,
  onError,
  buttonText = "Use Current Location (Google Maps)",
  variant = "outlined",
  size = "small",
  disabled = false,
}) {
  const [consentOpen, setConsentOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const canUse = useMemo(() => !disabled && !loading, [disabled, loading]);

  const handleConfirm = useCallback(async () => {
    try {
      setLoading(true);

      await loadGoogleMaps();
      const pos = await getCurrentPosition();

      const lat = Number(pos?.coords?.latitude);
      const lng = Number(pos?.coords?.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        throw new Error("Invalid location coordinates");
      }

      const result = await geocodeLatLng({ lat, lng });
      const parsed = parseGeocodeResult(result);

      onResolved?.({
        latitude: lat,
        longitude: lng,
        formattedAddress: parsed.formattedAddress,
        street: parsed.street,
        city: parsed.city,
        state: parsed.state,
        pincode: parsed.pincode,
        country: parsed.country || "India",
        source: "google_maps",
      });

      setConsentOpen(false);
    } catch (err) {
      const message = err?.message || "Failed to fetch location";
      console.error("UseCurrentLocationGoogleMaps error:", err);
      onError?.(message);
      setConsentOpen(false);
    } finally {
      setLoading(false);
    }
  }, [onResolved, onError]);

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={() => setConsentOpen(true)}
        disabled={!canUse}
        startIcon={loading ? <CircularProgress size={16} /> : <FiMapPin />}
        sx={{ textTransform: "none", borderRadius: "10px" }}
      >
        {buttonText}
      </Button>

      <Dialog open={consentOpen} onClose={() => setConsentOpen(false)}>
        <DialogTitle>Use Current Location</DialogTitle>
        <DialogContent>
          <div className="text-sm text-gray-700 whitespace-pre-line">
            {CONSENT_TEXT}
          </div>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setConsentOpen(false)} sx={{ textTransform: "none" }}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={loading}
            sx={{
              textTransform: "none",
              backgroundColor: "#059669",
              color: "white",
              "&:hover": { backgroundColor: "#047857" },
              "&:disabled": { backgroundColor: "#cbd5e1", color: "white" },
            }}
          >
            {loading ? <CircularProgress size={16} color="inherit" /> : "Allow"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

