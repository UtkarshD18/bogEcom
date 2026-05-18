"use client";

import { trackEvent } from "@/utils/analyticsTracker";
import { API_BASE_URL } from "@/utils/api";

import { useSettings } from "@/context/SettingsContext";
import { round2 } from "@/utils/gst";
import {
  getResponseErrorMessage,
  parseJsonSafely,
} from "@/utils/safeJsonFetch";
import Cookies from "js-cookie";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { toast } from "react-hot-toast";

/**
 * Cart Context
 *
 * Production-ready cart management with:
 * - Local storage persistence for guests
 * - API sync for logged-in users
 * - Session ID for guest carts
 */

const CartContext = createContext();
const API_URL = String(API_BASE_URL || "")
  .trim()
  .replace(/\/+$/, "")
  .replace(/\/api$/i, "");
const LOCAL_API_FALLBACKS = [
  "http://127.0.0.1:8000",
  "http://127.0.0.1:8001",
  "http://localhost:8000",
  "http://localhost:8001",
];

const buildApiUrlCandidates = (path) => {
  const normalizedPath = String(path || "").startsWith("/")
    ? String(path)
    : `/${String(path || "")}`;
  const apiPath = normalizedPath.startsWith("/api/")
    ? normalizedPath
    : `/api${normalizedPath}`;

  const candidates = [];

  if (typeof window !== "undefined") {
    const hostname = String(window.location.hostname || "").toLowerCase();
    const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1";
    if (isLocalhost) {
      LOCAL_API_FALLBACKS.forEach((base) => {
        const normalizedBase = String(base || "")
          .trim()
          .replace(/\/+$/, "");
        if (normalizedBase) {
          candidates.push(`${normalizedBase}${apiPath}`);
        }
      });
    }
  }

  if (API_URL) {
    candidates.push(`${API_URL}${apiPath}`);
  }

  candidates.push(apiPath);

  return [...new Set(candidates)];
};

const fetchWithApiFallback = async (path, requestInit) => {
  const candidates = buildApiUrlCandidates(path);
  let lastError = null;
  let lastResponse = null;

  for (let index = 0; index < candidates.length; index += 1) {
    const url = candidates[index];
    const isLastCandidate = index === candidates.length - 1;
    try {
      const response = await fetch(url, requestInit);
      if (response.ok) {
        return response;
      }

      lastResponse = response;
      const status = Number(response.status || 0);
      const shouldTryNext =
        !isLastCandidate &&
        (status === 404 || status === 401 || status >= 500 || status === 0);
      if (shouldTryNext) {
        continue;
      }

      return response;
    } catch (error) {
      lastError = error;
    }
  }

  if (lastResponse) {
    return lastResponse;
  }

  throw lastError || new Error("Request failed");
};

const resolveCartErrorMessage = (message, fallback) => {
  const normalized = String(message || "").trim();
  if (/an unexpected error occurred/i.test(normalized)) {
    return fallback;
  }
  return normalized || fallback;
};

const isComboPayload = (value) =>
  Boolean(
    value?.itemType === "combo" ||
    value?.comboId ||
    value?.combo?._id ||
    value?.combo?.id ||
    value?.comboSnapshot?.comboId,
  );

const resolveComboId = (value) => {
  if (!value) return "";
  return (
    value.comboId ||
    value.combo?._id ||
    value.combo?.id ||
    value.comboSnapshot?.comboId ||
    value._id ||
    value.id ||
    ""
  ).toString();
};

const resolveComboLabel = (value) =>
  String(
    value?.comboName ||
      value?.name ||
      value?.combo?.name ||
      value?.comboSnapshot?.comboName ||
      "",
  ).trim();

const resolveComboSlug = (value) =>
  String(
    value?.comboSlug ||
      value?.slug ||
      value?.combo?.slug ||
      value?.comboSnapshot?.comboSlug ||
      "",
  ).trim();

const resolveComboType = (value) =>
  String(
    value?.comboType ||
      value?.combo?.comboType ||
      value?.comboSnapshot?.comboType ||
      value?.combo?.type ||
      "",
  ).trim();

const resolveComboPrice = (value) => {
  const explicitComboPrice = Number(
    value?.comboPrice ??
      value?.combo?.comboPrice ??
      value?.comboSnapshot?.comboPrice ??
      0,
  );
  if (Number.isFinite(explicitComboPrice) && explicitComboPrice > 0) {
    return explicitComboPrice;
  }

  const legacyPrice = Number(value?.price ?? value?.combo?.price ?? 0);
  if (Number.isFinite(legacyPrice) && legacyPrice > 0) {
    return legacyPrice;
  }

  const pricingType = String(
    value?.pricing?.type || value?.combo?.pricing?.type || "",
  )
    .trim()
    .toLowerCase();
  const pricingValue = Number(
    value?.pricing?.value ?? value?.combo?.pricing?.value ?? 0,
  );
  const comboItems = Array.isArray(value?.items)
    ? value.items
    : Array.isArray(value?.combo?.items)
      ? value.combo.items
      : [];
  const baseTotal = comboItems.reduce(
    (sum, item) =>
      sum +
      Number(item?.price || 0) *
        Math.max(Number(item?.quantity || item?.quantityRequired || 1), 1),
    0,
  );

  if (baseTotal > 0 && Number.isFinite(pricingValue) && pricingValue > 0) {
    if (pricingType === "fixed_price") {
      return Math.min(pricingValue, baseTotal);
    }
    if (pricingType === "percent_discount") {
      return Math.max(baseTotal * (1 - pricingValue / 100), 0);
    }
    if (pricingType === "fixed_discount") {
      return Math.max(baseTotal - pricingValue, 0);
    }
  }

  return 0;
};

const resolveProductId = (value) => {
  if (!value) return "";

  const candidate =
    value.parentProductId ||
    value.productId ||
    value.product?._id ||
    value.product?.id ||
    value.product ||
    value._id ||
    value.id ||
    "";

  return String(candidate || "").trim();
};

const buildComboCartPayload = (combo, quantity = 1) => {
  const comboId = resolveComboId(combo);
  const name = resolveComboLabel(combo) || "Combo Bundle";
  const price = resolveComboPrice(combo);
  const image =
    combo?.comboThumbnail ||
    combo?.thumbnail ||
    combo?.image ||
    combo?.comboImages?.[0] ||
    "/product_1.webp";
  const items = (Array.isArray(combo?.items) ? combo.items : []).map(
    (item) => ({
      productId: String(item?.productId || item?.product || "").trim(),
      variantId:
        String(item?.variantId || item?.variant || "").trim() || undefined,
      quantity: Math.max(
        Number(item?.quantity || item?.quantityRequired || 1),
        1,
      ),
    }),
  );

  return {
    type: "combo",
    itemType: "combo",
    comboId,
    name,
    price,
    quantity: Math.max(Number(quantity || 1), 1),
    image,
    items: items.filter((item) => item.productId),
  };
};

const isComboCartItem = (item) =>
  item?.itemType === "combo" ||
  Boolean(item?.combo || item?.comboSnapshot?.comboId);

const normalizeCartItems = (rawItems) => {
  if (!Array.isArray(rawItems)) return [];

  return rawItems
    .filter((item) => item && typeof item === "object")
    .map((item) => {
      const quantity = Number(item.quantity);
      return {
        ...item,
        quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
      };
    });
};

const parseStoredCart = (savedCart) => {
  const parsed = JSON.parse(savedCart);

  if (Array.isArray(parsed)) {
    return normalizeCartItems(parsed);
  }

  if (parsed && typeof parsed === "object") {
    return normalizeCartItems(parsed.items);
  }

  return [];
};

const SUPPRESSED_CART_FETCH_TOAST_PATHS = [
  "/checkout",
  "/payment/paytm",
  "/payment/phonepe",
  "/membership/checkout",
];

const shouldShowCartFetchErrorToast = () => {
  if (typeof window === "undefined") return false;

  const pathname = String(window.location?.pathname || "").toLowerCase();
  return !SUPPRESSED_CART_FETCH_TOAST_PATHS.some((prefix) =>
    pathname.startsWith(prefix),
  );
};

const isLocalDevBrowser = () => {
  if (typeof window === "undefined") return false;
  const hostname = String(window.location?.hostname || "").toLowerCase();
  return hostname === "localhost" || hostname === "127.0.0.1";
};

// Generate or get session ID for guest carts
const getSessionId = () => {
  if (typeof window === "undefined") return null;

  let sessionId = localStorage.getItem("cartSessionId");
  if (!sessionId) {
    sessionId = `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem("cartSessionId", sessionId);
  }
  if (sessionId) {
    document.cookie = `sessionId=${encodeURIComponent(sessionId)}; path=/; max-age=31536000; samesite=lax`;
  }
  return sessionId;
};

const getStoredCartItemsSafely = () => {
  if (typeof window === "undefined") return [];

  try {
    const savedCart = localStorage.getItem("cart");
    return savedCart ? parseStoredCart(savedCart) : [];
  } catch {
    return [];
  }
};

const buildCartLineKey = (item) => {
  if (isComboCartItem(item)) {
    const comboId = String(resolveComboId(item) || "").trim();
    return comboId ? `combo:${comboId}` : "";
  }

  const productId = String(resolveProductId(item) || "").trim();
  const variantId = String(
    (item?.variant?._id ||
      item?.variant?.id ||
      item?.variantId ||
      (typeof item?.variant === "string" ? item.variant : null) ||
      item?.selectedVariant?._id ||
      item?.selectedVariant?.id ||
      "") || "",
  ).trim();
  return productId ? `product:${productId}:${variantId}` : "";
};

const getCartLineQuantity = (item) =>
  Math.max(Number(item?.quantity || 0), 0);

const firstFiniteNumber = (...values) => {
  for (const value of values) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

const getLocalCartAvailableQuantity = (product) => {
  if (!product || typeof product !== "object") return 0;
  if (product.track_inventory === false || product.trackInventory === false) {
    return Number.MAX_SAFE_INTEGER;
  }

  if (isComboPayload(product)) {
    const comboAvailable = firstFiniteNumber(
      product.available_quantity,
      product.available_stock,
      product.availableStock,
      product.availableStockQuantity,
      product.stockQuantity,
      product.stock,
    );
    return comboAvailable === null
      ? Number.MAX_SAFE_INTEGER
      : Math.max(comboAvailable, 0);
  }

  const variantId = String(
    product?.variantId ||
      product?.selectedVariant?._id ||
      product?.selectedVariant?.id ||
      product?.variant?._id ||
      product?.variant?.id ||
      "",
  ).trim();
  const selectedVariant =
    product?.selectedVariant ||
    product?.variant ||
    (variantId && Array.isArray(product?.variants)
      ? product.variants.find(
          (variant) =>
            String(variant?._id || variant?.id || "") === variantId,
        )
      : null);
  const source = selectedVariant || product;
  const explicitAvailable = firstFiniteNumber(
    source?.available_quantity,
    source?.available_stock,
    source?.availableStock,
  );
  if (explicitAvailable !== null) {
    return Math.max(explicitAvailable, 0);
  }

  const stock = firstFiniteNumber(source?.stock_quantity, source?.stock);
  if (stock === null) return Number.MAX_SAFE_INTEGER;

  const reserved = firstFiniteNumber(source?.reserved_quantity) || 0;
  return Math.max(stock - reserved, 0);
};

const buildCartSyncSignature = (items = []) =>
  JSON.stringify(
    (Array.isArray(items) ? items : [])
      .map((item) => ({
        key: buildCartLineKey(item),
        quantity: getCartLineQuantity(item),
      }))
      .filter((entry) => entry.key && entry.quantity > 0)
      .sort((a, b) => a.key.localeCompare(b.key)),
  );

export const CartProvider = ({ children }) => {
  const [cartItems, setCartItems] = useState([]);
  const [cartCount, setCartCount] = useState(0);
  const [cartTotal, setCartTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [orderNote, setOrderNote] = useState("");
  const mergedGuestSessionRef = useRef("");
  const syncedStoredCartRef = useRef("");
  const { calculateShipping } = useSettings();

  // Get user token if logged in
  const getToken = () => {
    if (typeof window === "undefined") return null;
    return Cookies.get("accessToken") || localStorage.getItem("token");
  };

  const shouldUseLocalDevFallback = () => isLocalDevBrowser();

  const resolveVariantId = (item) => {
    if (isComboCartItem(item)) return null;
    const rawVariant =
      item?.variant?._id ||
      item?.variant?.id ||
      item?.variantId ||
      (typeof item?.variant === "string" ? item.variant : null) ||
      item?.selectedVariant?._id ||
      item?.selectedVariant?.id ||
      null;
    if (rawVariant === undefined || rawVariant === null || rawVariant === "") {
      return null;
    }
    return String(rawVariant);
  };

  const buildRequestHeaders = (token, sessionId) => {
    const headers = {
      "Content-Type": "application/json",
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    if (sessionId) {
      headers["X-Session-Id"] = sessionId;
    }

    return headers;
  };

  const applyServerCartPayload = (payload) => {
    const safeItems = Array.isArray(payload?.items) ? payload.items : [];
    const safeItemCount =
      Number(payload?.itemCount) ||
      safeItems.reduce(
        (sum, item) => sum + Math.max(Number(item?.quantity || 1), 1),
        0,
      );
    const safeSubtotal = Number.isFinite(Number(payload?.subtotal))
      ? Number(payload?.subtotal)
      : safeItems.reduce((sum, item) => {
          const quantity = Math.max(Number(item?.quantity || 1), 1);
          const price =
            Number(item?.price) ||
            Number(item?.product?.price) ||
            Number(item?.productData?.price) ||
            0;
          return sum + price * quantity;
        }, 0);

    setCartItems(safeItems);
    setCartCount(safeItemCount);
    setCartTotal(round2(safeSubtotal));

    return safeItems;
  };

  const resolvePendingStoredCartLines = (storedItems = [], serverItems = []) => {
    const serverIndex = new Map();

    for (const item of serverItems) {
      const key = buildCartLineKey(item);
      if (!key) continue;
      serverIndex.set(key, getCartLineQuantity(item));
    }

    return storedItems
      .map((item) => {
        const key = buildCartLineKey(item);
        if (!key) return null;

        const localQuantity = getCartLineQuantity(item);
        const serverQuantity = Number(serverIndex.get(key) || 0);
        const quantityToSync = Math.max(localQuantity - serverQuantity, 0);

        return quantityToSync > 0
          ? {
              item,
              quantity: quantityToSync,
            }
          : null;
      })
      .filter(Boolean);
  };

  const buildStoredCartSyncPayload = (item, quantity) => {
    const normalizedQuantity = Math.max(Number(quantity || 1), 1);
    if (isComboCartItem(item)) {
      const comboPayload = buildComboCartPayload(item, normalizedQuantity);
      return comboPayload?.comboId ? comboPayload : null;
    }

    const product = item?.productData || item?.product || item;
    const productId = resolveProductId(item);
    if (!productId) return null;

    const variantId = resolveVariantId(item);
    const variantName = String(
      item?.variantName ||
        item?.selectedVariant?.name ||
        product?.variantName ||
        product?.selectedVariant?.name ||
        product?.variant?.name ||
        "",
    )
      .trim()
      .slice(0, 120);

    return {
      productId,
      quantity: normalizedQuantity,
      price: Number(item?.price ?? product?.price ?? 0),
      originalPrice: Number(
        item?.originalPrice ??
          product?.originalPrice ??
          product?.oldPrice ??
          product?.price ??
          0,
      ),
      variantId: variantId || undefined,
      variantName: variantName || undefined,
    };
  };

  const mergeGuestSessionCart = async (token, sessionId) => {
    if (!token || !sessionId) return;

    const mergeKey = `${String(token)}::${String(sessionId)}`;
    if (mergedGuestSessionRef.current === mergeKey) {
      return;
    }

    const headers = buildRequestHeaders(token, sessionId);
    const response = await fetchWithApiFallback("/cart/merge", {
      method: "POST",
      headers,
      credentials: "include",
      body: JSON.stringify({ sessionId }),
    });
    const data = await parseJsonSafely(response);

    if (response.ok && data?.success) {
      mergedGuestSessionRef.current = mergeKey;
    }
  };

  const syncStoredCartToServer = async (token, sessionId, serverPayload) => {
    if (!token) return null;

    const storedItems = getStoredCartItemsSafely();
    if (storedItems.length === 0) return null;

    const serverItems = Array.isArray(serverPayload?.items)
      ? serverPayload.items
      : [];
    const syncSignature = `${String(token)}::${buildCartSyncSignature(storedItems)}`;
    const pendingLines = resolvePendingStoredCartLines(storedItems, serverItems);

    if (pendingLines.length === 0) {
      if (typeof window !== "undefined") {
        localStorage.removeItem("cart");
      }
      syncedStoredCartRef.current = syncSignature;
      return null;
    }

    if (syncedStoredCartRef.current === syncSignature) {
      return null;
    }

    const headers = buildRequestHeaders(token, sessionId);
    let latestPayload = null;
    let latestItems = serverItems;

    for (const pendingLine of pendingLines) {
      const payload = buildStoredCartSyncPayload(
        pendingLine.item,
        pendingLine.quantity,
      );
      if (!payload) continue;

      const response = await fetchWithApiFallback("/cart/add", {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const data = await parseJsonSafely(response);

      if (data?.success && data?.data) {
        latestPayload = data.data;
        latestItems = Array.isArray(data.data.items) ? data.data.items : latestItems;
      }
    }

    const remainingLines = resolvePendingStoredCartLines(storedItems, latestItems);
    if (remainingLines.length === 0) {
      if (typeof window !== "undefined") {
        localStorage.removeItem("cart");
      }
      syncedStoredCartRef.current = syncSignature;
    }

    return latestPayload;
  };

  // Fetch cart from API or local storage
  const fetchCart = async () => {
    try {
      setLoading(true);
      const token = getToken();
      const sessionId = getSessionId();
      const headers = buildRequestHeaders(token, sessionId);

      if (token && sessionId) {
        try {
          await mergeGuestSessionCart(token, sessionId);
        } catch (mergeError) {
          console.warn("Unable to merge guest cart into account cart:", mergeError);
        }
      }

      const response = await fetchWithApiFallback("/cart", {
        method: "GET",
        headers,
        credentials: "include",
      });

      const data = await parseJsonSafely(response);

      if (data?.success && data?.data) {
        let finalPayload = data.data;

        if (token) {
          try {
            const syncedPayload = await syncStoredCartToServer(
              token,
              sessionId,
              finalPayload,
            );
            if (syncedPayload?.items) {
              finalPayload = syncedPayload;
            }
          } catch (syncError) {
            console.warn("Unable to sync stored cart into account cart:", syncError);
          }
        }

        const apiItems = applyServerCartPayload(finalPayload);
        return {
          success: true,
          source: "api",
          items: apiItems,
        };
      } else {
        // For authenticated users, never replace server cart with local fallback.
        if (token) {
          if (shouldUseLocalDevFallback()) {
            const restored = loadFromLocalStorage();
            return {
              success: restored,
              source: "local-dev-fallback",
              items: restored
                ? parseStoredCart(localStorage.getItem("cart") || "{}")
                : [],
            };
          }
          if (shouldShowCartFetchErrorToast()) {
            toast.error("Unable to sync cart right now. Please refresh.");
          }
          return {
            success: false,
            source: "api",
            items: Array.isArray(cartItems) ? cartItems : [],
          };
        }

        // Guest fallback to local storage
        const restored = loadFromLocalStorage();
        return {
          success: restored,
          source: "local",
          items: restored
            ? parseStoredCart(localStorage.getItem("cart") || "{}")
            : [],
        };
      }
    } catch (error) {
      console.warn("Error fetching cart:", error);

      const token = getToken();
      if (token) {
        if (shouldUseLocalDevFallback()) {
          const restoredFromLocal = loadFromLocalStorage();
          return {
            success: restoredFromLocal,
            source: "local-dev-error-fallback",
            items: restoredFromLocal
              ? parseStoredCart(localStorage.getItem("cart") || "{}")
              : [],
          };
        }
        if (shouldShowCartFetchErrorToast()) {
          toast.error("Unable to sync cart right now. Please refresh.");
        }
        return {
          success: false,
          source: "api-error",
          items: Array.isArray(cartItems) ? cartItems : [],
        };
      }

      const restoredFromLocal = loadFromLocalStorage();
      if (!restoredFromLocal && shouldShowCartFetchErrorToast()) {
        toast.error("Unable to sync cart right now. Please refresh.");
      }
      return {
        success: restoredFromLocal,
        source: "local-error",
        items: restoredFromLocal
          ? parseStoredCart(localStorage.getItem("cart") || "{}")
          : [],
      };
    } finally {
      setLoading(false);
      setIsInitialized(true);
    }
  };

  // Load cart from local storage (fallback)
  const loadFromLocalStorage = () => {
    if (typeof window === "undefined") return false;

    const savedCart = localStorage.getItem("cart");
    if (!savedCart) {
      setCartItems([]);
      setCartCount(0);
      setCartTotal(0);
      return false;
    }

    try {
      const items = parseStoredCart(savedCart);
      setCartItems(items);
      calculateTotals(items);
      saveToLocalStorage(items);
      return items.length > 0;
    } catch (e) {
      console.error("Error parsing cart from localStorage:", e);
      localStorage.removeItem("cart");
      setCartItems([]);
      setCartCount(0);
      setCartTotal(0);
      return false;
    }
  };

  // Save to local storage
  const saveToLocalStorage = (items) => {
    if (typeof window === "undefined") return;
    localStorage.setItem("cart", JSON.stringify({ items }));
  };

  // Add to cart
  const addToCart = async (product, quantity = 1) => {
    try {
      setLoading(true);
      const token = getToken();
      const sessionId = getSessionId();
      const isComboRequest = isComboPayload(product);
      const comboId = isComboRequest ? resolveComboId(product) : "";
      const comboPayload = isComboRequest
        ? buildComboCartPayload(product, quantity)
        : null;

      if (isComboRequest && !comboId) {
        toast.error("Combo is unavailable right now.");
        return { success: false, message: "Combo unavailable" };
      }
      const resolvedProductId = !isComboRequest
        ? resolveProductId(product)
        : "";

      const headers = buildRequestHeaders(token, sessionId);

      const response = await fetchWithApiFallback("/cart/add", {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify(
          isComboRequest
            ? comboPayload
            : {
                productId: resolvedProductId,
                quantity,
                price: product.price,
                originalPrice: product.originalPrice || product.oldPrice,
                variantId: resolveVariantId(product) || undefined,
                variantName:
                  product.variantName ||
                  product.selectedVariant?.name ||
                  product?.variant?.name ||
                  undefined,
              },
        ),
      });

      const data = await parseJsonSafely(response);
      const errorMessage = resolveCartErrorMessage(
        getResponseErrorMessage(
          data,
          isComboRequest ? "Unable to add combo right now." : "Cannot add item",
        ),
        isComboRequest
          ? "Unable to add combo right now. Please refresh and try again."
          : "Cannot add item",
      );

      if (data?.success) {
        setCartItems(data.data.items || []);
        setCartCount(data.data.itemCount || 0);
        setCartTotal(round2(data.data.subtotal || 0));
        if (token && typeof window !== "undefined") {
          localStorage.removeItem("cart");
        }

        if (isComboRequest) {
          trackEvent("combo_add_to_cart", {
            comboId: String(comboId || ""),
            comboName: resolveComboLabel(product),
            comboSlug: resolveComboSlug(product),
            comboType: resolveComboType(product),
            comboPrice: resolveComboPrice(product),
            quantity: Number(quantity || 1),
          });
        } else {
          const trackedProductId = resolveProductId(product);
          trackEvent("add_to_cart", {
            productId: String(trackedProductId || ""),
            quantity: Number(quantity || 1),
            price: Number(product.price || 0),
            variantId: String(resolveVariantId(product) || ""),
          });
        }

        // Auto-open drawer only if it was the first item added
        if (cartItems.length === 0) {
          setIsDrawerOpen(true);
        }
        return { success: true };
      } else {
        if (isComboRequest) {
          if (response.status >= 400 && response.status < 500) {
            toast.error(errorMessage);
            return { success: false, message: errorMessage };
          }
          toast.error(errorMessage);
          return { success: false, message: errorMessage };
        }

        // If server says "Only X items available", SHOW ERROR and DO NOT FALLBACK
        if (
          response.status === 400 &&
          typeof errorMessage === "string" &&
          errorMessage.includes("items available")
        ) {
          toast.error(errorMessage);
          return { success: false, message: errorMessage };
        }

        // Do not fallback to local cart for any client-side rejection (400-499),
        // including membership/auth/business-rule errors returned by backend.
        if (response.status >= 400 && response.status < 500) {
          toast.error(errorMessage);
          return { success: false, message: errorMessage };
        }

        if (shouldUseLocalDevFallback()) {
          const addedLocally = addToCartLocal(product, quantity);
          if (!addedLocally) {
            return { success: false, message: "Insufficient stock" };
          }
          if (cartItems.length === 0) {
            setIsDrawerOpen(true);
          }
          return { success: true, source: "local-dev-fallback" };
        }

        if (token) {
          toast.error(errorMessage);
          return { success: false, message: errorMessage };
        }

        const addedLocally = addToCartLocal(product, quantity);
        if (!addedLocally) {
          return { success: false, message: "Insufficient stock" };
        }
        const trackedProductId = resolveProductId(product);
        trackEvent("add_to_cart", {
          productId: String(trackedProductId || ""),
          quantity: Number(quantity || 1),
          price: Number(product.price || 0),
          variantId: String(resolveVariantId(product) || ""),
          source: "local_fallback",
        });
        if (cartItems.length === 0) {
          setIsDrawerOpen(true);
        }
        return { success: true };
      }
    } catch (error) {
      console.error("Error adding to cart:", error);
      if (isComboPayload(product)) {
        toast.error("Unable to add combo right now.");
        return { success: false, message: "Combo add failed" };
      }
      if (shouldUseLocalDevFallback()) {
        const addedLocally = addToCartLocal(product, quantity);
        if (!addedLocally) {
          return { success: false, message: "Insufficient stock" };
        }
        if (cartItems.length === 0) {
          setIsDrawerOpen(true);
        }
        return { success: true, source: "local-dev-error-fallback" };
      }
      if (getToken()) {
        toast.error("Unable to add item right now. Please try again.");
        return { success: false, message: "Add to cart failed" };
      }
      const addedLocally = addToCartLocal(product, quantity);
      if (!addedLocally) {
        return { success: false, message: "Insufficient stock" };
      }
      const trackedProductId = resolveProductId(product);
      trackEvent("add_to_cart", {
        productId: String(trackedProductId || ""),
        quantity: Number(quantity || 1),
        price: Number(product.price || 0),
        variantId: String(resolveVariantId(product) || ""),
        source: "local_fallback",
      });
      if (cartItems.length === 0) {
        setIsDrawerOpen(true);
      }
      return { success: true };
    } finally {
      setLoading(false);
    }
  };

  // Calculate totals
  const calculateTotals = (items) => {
    const safeItems = Array.isArray(items) ? items : [];
    const { total, count } = safeItems.reduce(
      (acc, item) => {
        const quantity = Number(item.quantity) || 1;
        const price =
          Number(item.price) ||
          Number(item.product?.price) ||
          Number(item.productData?.price) ||
          0;

        acc.total += price * quantity;
        acc.count += quantity;
        return acc;
      },
      { total: 0, count: 0 },
    );

    setCartTotal(round2(total));
    setCartCount(count);
  };

  // Add to cart locally (fallback)
  const addToCartLocal = (product, quantity = 1) => {
    const stock = getLocalCartAvailableQuantity(product);
    const resolvedProductId = resolveProductId(product);
    const resolvedVariantId = resolveVariantId(product);
    const resolvedVariantName = String(
      product?.variantName ||
        product?.selectedVariant?.name ||
        product?.variant?.name ||
        "",
    )
      .trim()
      .slice(0, 120);

    // If we're adding NEW item, check if quantum <= stock
    // If we're updating existing, check if (existing + quantity) <= stock

    const existingIndex = cartItems.findIndex((item) => {
      const itemId = resolveProductId(item);
      const itemVariantId = resolveVariantId(item);
      return (
        String(itemId) === String(resolvedProductId) &&
        String(itemVariantId || "") === String(resolvedVariantId || "")
      );
    });

    let newItems;
    if (existingIndex > -1) {
      const currentQty = cartItems[existingIndex].quantity;
      if (currentQty + quantity > stock) {
        toast.error(`Only ${stock} items available`);
        return false;
      }
      newItems = [...cartItems];
      newItems[existingIndex].quantity += quantity;
    } else {
      if (quantity > stock) {
        toast.error(`Only ${stock} items available`);
        return false;
      }
      newItems = [
        ...cartItems,
        {
          // Standardize structure
          product: product, // Store full object if possible or ID.
          productData: product,
          _id: resolvedProductId,
          parentProductId: resolvedProductId,
          variant: resolvedVariantId,
          variantId: resolvedVariantId,
          variantName: resolvedVariantName,
          quantity,
          price: product.price,
          originalPrice: product.originalPrice || product.oldPrice,
        },
      ];
    }

    setCartItems(newItems);
    calculateTotals(newItems);
    saveToLocalStorage(newItems);
    return true;
  };

  // Update quantity
  const updateQuantity = async (
    productId,
    quantity,
    variantId = null,
    options = {},
  ) => {
    if (quantity < 1) {
      return removeFromCart(productId, variantId, options);
    }

    try {
      setLoading(true);
      const token = getToken();
      const sessionId = getSessionId();
      const isComboRequest =
        options?.itemType === "combo" ||
        options?.comboId ||
        isComboPayload(options);
      const comboId = isComboRequest
        ? resolveComboId(options) || productId
        : "";

      const headers = buildRequestHeaders(token, sessionId);

      const response = await fetchWithApiFallback("/cart/update", {
        method: "PUT",
        headers,
        credentials: "include",
        body: JSON.stringify({
          ...(isComboRequest
            ? {
                itemType: "combo",
                comboId: comboId || productId,
                quantity,
              }
            : {
                productId,
                quantity,
                variantId: variantId || undefined,
              }),
        }),
      });

      const data = await parseJsonSafely(response);
      const errorMessage = resolveCartErrorMessage(
        getResponseErrorMessage(
          data,
          isComboRequest
            ? "Unable to update combo right now."
            : "Cannot update quantity",
        ),
        isComboRequest
          ? "Unable to update combo right now. Please refresh and try again."
          : "Cannot update quantity",
      );

      if (data?.success) {
        setCartItems(data.data.items || []);
        setCartCount(data.data.itemCount || 0);
        setCartTotal(round2(data.data.subtotal || 0));
        if (token && typeof window !== "undefined") {
          localStorage.removeItem("cart");
        }
        return { success: true };
      } else {
        if (response.status >= 400 && response.status < 500) {
          toast.error(errorMessage);
          return { success: false, message: errorMessage };
        }
        if (shouldUseLocalDevFallback()) {
          updateQuantityLocal(productId, quantity, variantId);
          return { success: true, source: "local-dev-fallback" };
        }
        if (token) {
          toast.error(errorMessage);
          return { success: false, message: errorMessage };
        }
        if (!isComboRequest) {
          updateQuantityLocal(productId, quantity, variantId);
        } else {
          toast.error(errorMessage);
        }
      }
    } catch (error) {
      console.error("Error updating cart:", error);
      if (shouldUseLocalDevFallback() && !options?.itemType && !options?.comboId) {
        updateQuantityLocal(productId, quantity, variantId);
        return { success: true, source: "local-dev-error-fallback" };
      }
      if (getToken()) {
        toast.error(
          options?.itemType || options?.comboId
            ? "Unable to update combo right now."
            : "Unable to update item quantity right now.",
        );
        return { success: false };
      }
      if (!options?.itemType && !options?.comboId) {
        updateQuantityLocal(productId, quantity, variantId);
      } else {
        toast.error("Unable to update combo right now.");
      }
    } finally {
      setLoading(false);
    }
  };

  // Update quantity locally
  const updateQuantityLocal = (productId, quantity, variantId = null) => {
    setCartItems((prev) => {
      const newItems = prev.map((item) =>
        String(resolveProductId(item)) === String(productId) &&
        String(resolveVariantId(item) || "") === String(variantId || "")
          ? { ...item, quantity }
          : item,
      );
      calculateTotals(newItems);
      saveToLocalStorage(newItems);
      return newItems;
    });
  };

  // Remove from cart
  const removeFromCart = async (productId, variantId = null, options = {}) => {
    const isComboRequest =
      options?.itemType === "combo" ||
      options?.comboId ||
      isComboPayload(options);
    const resolvedVariantId = !isComboRequest
      ? (variantId ??
        resolveVariantId(
          cartItems.find(
            (item) => String(resolveProductId(item)) === String(productId),
          ),
        ))
      : null;
    const comboId = isComboRequest ? resolveComboId(options) || productId : "";

    try {
      setLoading(true);
      const token = getToken();
      const sessionId = getSessionId();
      const headers = buildRequestHeaders(token, sessionId);

      const queryParts = [];
      if (isComboRequest) {
        queryParts.push("itemType=combo");
        if (comboId) {
          queryParts.push(`comboId=${encodeURIComponent(String(comboId))}`);
        }
      } else if (resolvedVariantId) {
        queryParts.push(
          `variantId=${encodeURIComponent(String(resolvedVariantId))}`,
        );
      }
      const query = queryParts.length ? `?${queryParts.join("&")}` : "";
      const response = await fetchWithApiFallback(
        `/cart/remove/${productId}${query}`,
        {
          method: "DELETE",
          headers,
          credentials: "include",
        },
      );

      const data = await parseJsonSafely(response);
      const errorMessage = resolveCartErrorMessage(
        getResponseErrorMessage(
          data,
          isComboRequest
            ? "Unable to remove combo right now."
            : "Unable to remove item right now.",
        ),
        isComboRequest
          ? "Unable to remove combo right now."
          : "Unable to remove item right now.",
      );

      if (data?.success) {
        setCartItems(data.data.items || []);
        setCartCount(data.data.itemCount || 0);
        setCartTotal(round2(data.data.subtotal || 0));
        if (token && typeof window !== "undefined") {
          localStorage.removeItem("cart");
        }
        if (!isComboRequest) {
          trackEvent("remove_from_cart", {
            productId: String(productId || ""),
            variantId: String(resolvedVariantId || ""),
          });
        }
        // toast.success("Item removed from cart");
      } else {
        if (shouldUseLocalDevFallback()) {
          removeFromCartLocal(productId, resolvedVariantId, {
            itemType: isComboRequest ? "combo" : "product",
            comboId,
          });
          return { success: true, source: "local-dev-fallback" };
        }
        if (token) {
          toast.error(errorMessage);
          return { success: false, message: errorMessage };
        }
        removeFromCartLocal(productId, resolvedVariantId, {
          itemType: isComboRequest ? "combo" : "product",
          comboId,
        });
        if (!isComboRequest) {
          trackEvent("remove_from_cart", {
            productId: String(productId || ""),
            variantId: String(resolvedVariantId || ""),
            source: "local_fallback",
          });
        }
      }
    } catch (error) {
      console.error("Error removing from cart:", error);
      if (shouldUseLocalDevFallback()) {
        removeFromCartLocal(productId, resolvedVariantId, {
          itemType: isComboRequest ? "combo" : "product",
          comboId,
        });
        return { success: true, source: "local-dev-error-fallback" };
      }
      if (getToken()) {
        toast.error(
          isComboRequest
            ? "Unable to remove combo right now."
            : "Unable to remove item right now.",
        );
        return { success: false };
      }
      removeFromCartLocal(productId, resolvedVariantId, {
        itemType: isComboRequest ? "combo" : "product",
        comboId,
      });
      if (!isComboRequest) {
        trackEvent("remove_from_cart", {
          productId: String(productId || ""),
          variantId: String(resolvedVariantId || ""),
          source: "local_fallback",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  // Remove locally
  const removeFromCartLocal = (productId, variantId = null, options = {}) => {
    const isComboRequest =
      options?.itemType === "combo" ||
      options?.comboId ||
      isComboPayload(options);
    const comboId = isComboRequest ? resolveComboId(options) || productId : "";
    setCartItems((prev) => {
      const newItems = prev.filter((item) => {
        if (isComboRequest) {
          if (!isComboCartItem(item)) return true;
          const itemComboId = resolveComboId(item);
          return String(itemComboId || "") !== String(comboId || "");
        }

        const itemProductId = String(resolveProductId(item));
        const itemVariantId = resolveVariantId(item);
        const isSameProduct = itemProductId === String(productId);
        const isSameVariant =
          String(itemVariantId || "") === String(variantId || "");
        return !(isSameProduct && isSameVariant);
      });
      calculateTotals(newItems);
      saveToLocalStorage(newItems);
      // toast.success("Item removed from cart");
      return newItems;
    });
  };

  // Clear cart
  const clearCart = async () => {
    try {
      setLoading(true);
      const token = getToken();
      const sessionId = getSessionId();
      const headers = buildRequestHeaders(token, sessionId);

      await fetchWithApiFallback("/cart/clear", {
        method: "DELETE",
        headers,
        credentials: "include",
      });

      setCartItems([]);
      setCartCount(0);
      setCartTotal(0);
      localStorage.removeItem("cart");
    } catch (error) {
      console.error("Error clearing cart:", error);
    } finally {
      setLoading(false);
    }
  };

  // Check if product is in cart
  const isInCart = (productId, variantId = null) => {
    return cartItems.some(
      (item) =>
        !isComboCartItem(item) &&
        String(resolveProductId(item)) === String(productId) &&
        String(resolveVariantId(item) || "") === String(variantId || ""),
    );
  };

  // Get item quantity in cart
  const getItemQuantity = (productId, variantId = null) => {
    const item = cartItems.find(
      (item) =>
        !isComboCartItem(item) &&
        String(resolveProductId(item)) === String(productId) &&
        String(resolveVariantId(item) || "") === String(variantId || ""),
    );
    return item?.quantity || 0;
  };

  const isComboInCart = (comboId) =>
    cartItems.some(
      (item) =>
        isComboCartItem(item) &&
        String(resolveComboId(item) || "") === String(comboId || ""),
    );

  const getComboQuantity = (comboId) => {
    const item = cartItems.find(
      (entry) =>
        isComboCartItem(entry) &&
        String(resolveComboId(entry) || "") === String(comboId || ""),
    );
    return item?.quantity || 0;
  };

  const addComboToCart = (combo, quantity = 1) =>
    addToCart(
      {
        ...combo,
        ...buildComboCartPayload(combo, quantity),
        itemType: "combo",
      },
      quantity,
    );

  const updateComboQuantity = (comboId, quantity) =>
    updateQuantity(comboId, quantity, null, { itemType: "combo", comboId });

  const removeComboFromCart = (comboId) =>
    removeFromCart(comboId, null, { itemType: "combo", comboId });

  // Initialize cart on mount
  useEffect(() => {
    fetchCart();
  }, []);

  // Refresh cart after login or auth changes
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleAuthChange = () => {
      mergedGuestSessionRef.current = "";
      syncedStoredCartRef.current = "";
      if (getToken()) {
        fetchCart();
      } else {
        loadFromLocalStorage();
      }
    };

    window.addEventListener("loginSuccess", handleAuthChange);
    window.addEventListener("storage", handleAuthChange);

    return () => {
      window.removeEventListener("loginSuccess", handleAuthChange);
      window.removeEventListener("storage", handleAuthChange);
    };
  }, []);

  return (
    <CartContext.Provider
      value={{
        cartItems,
        cartCount,
        cartTotal,
        cartTotalAmount: cartTotal,
        cartSubTotalAmount: cartTotal,
        shippingAmount:
          cartTotal > 0 ? round2(calculateShipping(cartTotal)) : 0,
        loading,
        isInitialized,
        addToCart,
        addComboToCart,
        updateQuantity,
        updateComboQuantity,
        removeFromCart,
        removeComboFromCart,
        clearCart,
        isInCart,
        getItemQuantity,
        isComboInCart,
        getComboQuantity,
        isComboCartItem,
        fetchCart,
        isDrawerOpen,
        setIsDrawerOpen,
        orderNote,
        setOrderNote,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
};

export default CartContext;
