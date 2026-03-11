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

const CONSENT_MAIN =
  "We use Google Maps to fetch your current location to autofill your address.";

const toErrorDetails = (err) => {
  if (err instanceof Error) {
    return {
      name: err.name,
      message: err.message,
      stack: err.stack,
      code: err.code,
      cause: err.cause,
    };
  }

  if (!err || typeof err !== "object") return err;

  const details = { type: err?.constructor?.name };
  for (const key of Object.getOwnPropertyNames(err)) {
    try {
      details[key] = err[key];
    } catch {
      details[key] = "[unavailable]";
    }
  }
  return details;
};

const getErrorMessage = (err) => {
  const code = err?.code;
  if (code === 1) {
    return "Location permission denied. Please allow location access and try again.";
  }
  if (code === 2) {
    return "Location unavailable. Please enable location services and try again.";
  }
  if (code === 3) {
    return "Location request timed out. Please try again.";
  }

  const message = err?.message;
  if (typeof message === "string" && message.trim()) return message.trim();

  return "Failed to fetch";
};

const GOOGLE_MAPS_API_KEY = (process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "")
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
      script.onerror = () =>
        reject(new Error("Failed to load Google Maps script"));
      document.head.appendChild(script);
    });

    return promise;
  };
})();

const toCoordsAccuracy = (position) => {
  const accuracy = Number(position?.coords?.accuracy);
  return Number.isFinite(accuracy) ? accuracy : Number.POSITIVE_INFINITY;
};

const getCurrentPosition = () =>
  new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported by this browser."));
      return;
    }

    let settled = false;
    let bestPosition = null;
    let timeoutId = null;
    let watchId = null;

    const cleanup = () => {
      if (timeoutId) window.clearTimeout(timeoutId);
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    };

    const finishWithPosition = (position) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(position);
    };

    const finishWithError = (err) => {
      if (settled) return;
      settled = true;
      cleanup();
      const error = new Error(getErrorMessage(err));
      error.name = "GeolocationError";
      error.code = err?.code;
      error.cause = err;
      reject(error);
    };

    const considerPosition = (position) => {
      if (
        !bestPosition ||
        toCoordsAccuracy(position) < toCoordsAccuracy(bestPosition)
      ) {
        bestPosition = position;
      }

      if (toCoordsAccuracy(position) <= 12) {
        finishWithPosition(position);
      }
    };

    watchId = navigator.geolocation.watchPosition(
      considerPosition,
      (err) => {
        if (bestPosition) {
          finishWithPosition(bestPosition);
          return;
        }
        finishWithError(err);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      },
    );

    timeoutId = window.setTimeout(() => {
      if (bestPosition) {
        finishWithPosition(bestPosition);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        finishWithPosition,
        finishWithError,
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
        },
      );
    }, 4500);
  });

const pickComponent = (components, type) =>
  components?.find((c) => Array.isArray(c.types) && c.types.includes(type))
    ?.long_name || "";

const toResultsArray = (value) =>
  Array.isArray(value) ? value.filter(Boolean) : value ? [value] : [];

const pickComponentFromResults = (results, ...types) => {
  for (const type of types) {
    for (const result of toResultsArray(results)) {
      const value = pickComponent(result?.address_components || [], type);
      if (value) return value;
    }
  }
  return "";
};

const hasAnyType = (result, types = []) =>
  Array.isArray(result?.types) &&
  types.some((type) => result.types.includes(type));

const getComponentFromResult = (result, type) =>
  pickComponent(result?.address_components || [], type);

const scoreResult = (result) => {
  if (!result) return -1;

  let score = 0;
  const locationType = String(result?.geometry?.location_type || "").toUpperCase();
  if (locationType === "ROOFTOP") score += 30;
  if (locationType === "RANGE_INTERPOLATED") score += 18;
  if (locationType === "GEOMETRIC_CENTER") score += 8;
  if (locationType === "APPROXIMATE") score += 2;

  if (hasAnyType(result, ["street_address"])) score += 20;
  if (hasAnyType(result, ["premise", "subpremise"])) score += 12;
  if (hasAnyType(result, ["route", "intersection"])) score += 8;
  if (hasAnyType(result, ["plus_code"])) score += 1;

  if (getComponentFromResult(result, "route")) score += 10;
  if (getComponentFromResult(result, "street_number")) score += 8;
  if (
    getComponentFromResult(result, "sublocality_level_1") ||
    getComponentFromResult(result, "sublocality")
  ) {
    score += 8;
  }
  if (getComponentFromResult(result, "sublocality_level_2")) score += 6;
  if (getComponentFromResult(result, "sublocality_level_3")) score += 4;
  if (getComponentFromResult(result, "sublocality_level_4")) score += 3;
  if (getComponentFromResult(result, "neighborhood")) score += 2;

  return score;
};

const pickDetailedResult = (results) =>
  toResultsArray(results).reduce((best, current) => {
    if (!best) return current;
    return scoreResult(current) > scoreResult(best) ? current : best;
  }, null);

const uniqueParts = (parts = []) => {
  const seen = new Set();
  return parts
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .filter((part) => {
      const key = part.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

const parseGeocodeResult = (result) => {
  const results = toResultsArray(result);
  const detailedResult = pickDetailedResult(results);
  const detailedComponents = detailedResult?.address_components || [];
  const streetNumber =
    pickComponent(detailedComponents, "street_number") ||
    pickComponentFromResults(results, "street_number");
  const route =
    pickComponent(detailedComponents, "route") ||
    pickComponentFromResults(results, "route");
  const neighborhood =
    pickComponent(detailedComponents, "neighborhood") ||
    pickComponentFromResults(results, "neighborhood");
  const sublocality =
    pickComponent(detailedComponents, "sublocality") ||
    pickComponentFromResults(results, "sublocality");
  const sublocalityLevel1 =
    pickComponent(detailedComponents, "sublocality_level_1") ||
    sublocality ||
    pickComponentFromResults(results, "sublocality_level_1", "sublocality");
  const sublocalityLevel2 = pickComponent(
    detailedComponents,
    "sublocality_level_2",
  ) || pickComponentFromResults(results, "sublocality_level_2");
  const sublocalityLevel3 = pickComponent(
    detailedComponents,
    "sublocality_level_3",
  ) || pickComponentFromResults(results, "sublocality_level_3");
  const sublocalityLevel4 = pickComponent(
    detailedComponents,
    "sublocality_level_4",
  ) || pickComponentFromResults(results, "sublocality_level_4");
  const locality = pickComponentFromResults(results, "locality");
  const adminArea2 = pickComponentFromResults(
    results,
    "administrative_area_level_2",
  );
  const state = pickComponentFromResults(
    results,
    "administrative_area_level_1",
  );
  const pincode = pickComponentFromResults(results, "postal_code");
  const country = pickComponentFromResults(results, "country");

  const street = String(route || "").trim();
  const areaParts = uniqueParts([
    sublocalityLevel2,
    sublocalityLevel1,
    sublocality,
  ]);
  const area = areaParts.join(", ") || neighborhood;
  const sector = uniqueParts([
    sublocalityLevel4,
    sublocalityLevel3,
    neighborhood && !areaParts.includes(neighborhood) ? neighborhood : "",
  ]).join(", ");
  const city = (locality || adminArea2 || "").trim();

  return {
    formattedAddress: String(
      detailedResult?.formatted_address || results[0]?.formatted_address || "",
    ).trim(),
    street,
    streetNumber: String(streetNumber || "").trim(),
    area,
    sector,
    city,
    state: String(state || "").trim(),
    district: String(adminArea2 || "").trim(),
    pincode: String(pincode || "").trim(),
    country: String(country || "").trim(),
    locationType: String(detailedResult?.geometry?.location_type || "").trim(),
  };
};

const geocodeLatLng = ({ lat, lng }) =>
  new Promise((resolve, reject) => {
    if (!window.google?.maps?.Geocoder) {
      reject(new Error("Google Maps is not loaded"));
      return;
    }

    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ location: { lat, lng }, region: "IN" }, (results, status) => {
      if (status !== "OK" || !results || results.length === 0) {
        reject(
          new Error(
            `Unable to resolve address from location (status: ${status || "UNKNOWN"})`,
          ),
        );
        return;
      }
      resolve(results);
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

      const results = await geocodeLatLng({ lat, lng });
      const parsed = parseGeocodeResult(results);
      const countryValue = String(parsed.country || "").trim().toLowerCase();
      const isIndia =
        !countryValue ||
        countryValue === "india" ||
        countryValue === "bharat" ||
        countryValue === "in";
      if (!isIndia) {
        throw new Error(
          "Location appears outside India. Please enter your address manually.",
        );
      }
      const pincodeValue = String(parsed.pincode || "").trim();
      if (pincodeValue && pincodeValue.length !== 6) {
        throw new Error(
          "Could not detect a valid 6-digit pincode. Please enter manually.",
        );
      }
      if (!pincodeValue) {
        throw new Error(
          "Could not detect a pincode for your location. Please enter manually.",
        );
      }

      onResolved?.({
        latitude: lat,
        longitude: lng,
        accuracy: toCoordsAccuracy(pos),
        formattedAddress: parsed.formattedAddress,
        street: parsed.street,
        streetNumber: parsed.streetNumber,
        area: parsed.area,
        sector: parsed.sector,
        city: parsed.city,
        state: parsed.state,
        district: parsed.district,
        pincode: pincodeValue,
        country: parsed.country || "India",
        locationType: parsed.locationType,
        source: "google_maps",
      });

      setConsentOpen(false);
    } catch (err) {
      const message = getErrorMessage(err);
      const details = toErrorDetails(err);
      const isPermissionDenied =
        err?.code === 1 ||
        err?.cause?.code === 1 ||
        err?.name === "NotAllowedError";

      (isPermissionDenied ? console.warn : console.error)(
        "UseCurrentLocationGoogleMaps error:",
        details,
      );
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
          <p className="text-sm text-gray-700">{CONSENT_MAIN}</p>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => setConsentOpen(false)}
            sx={{ textTransform: "none" }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={loading}
            sx={{
              textTransform: "none",
              backgroundColor: "var(--primary)",
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
