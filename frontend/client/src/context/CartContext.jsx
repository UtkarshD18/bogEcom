"use client";

import { API_BASE_URL } from "@/utils/api";
import { trackEvent } from "@/utils/analyticsTracker";

import { useSettings } from "@/context/SettingsContext";
import { round2 } from "@/utils/gst";
import { getResponseErrorMessage, parseJsonSafely } from "@/utils/safeJsonFetch";
import Cookies from "js-cookie";
import { createContext, useContext, useEffect, useState } from "react";
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
const USE_DEV_PROXY = process.env.NODE_ENV !== "production";

const buildApiUrl = (path) => {
  const normalizedPath = String(path || "").startsWith("/")
    ? String(path)
    : `/${String(path || "")}`;
  const apiPath = normalizedPath.startsWith("/api/")
    ? normalizedPath
    : `/api${normalizedPath}`;

  if (USE_DEV_PROXY) {
    return apiPath;
  }

  return `${API_URL}${apiPath}`;
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

const resolveComboPrice = (value) =>
  Number(
    value?.comboPrice ??
      value?.combo?.comboPrice ??
      value?.comboSnapshot?.comboPrice ??
      value?.price ??
      0,
  );

const isComboCartItem = (item) =>
  item?.itemType === "combo" || Boolean(item?.combo || item?.comboSnapshot?.comboId);

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

export const CartProvider = ({ children }) => {
  const [cartItems, setCartItems] = useState([]);
  const [cartCount, setCartCount] = useState(0);
  const [cartTotal, setCartTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [orderNote, setOrderNote] = useState("");
  const { calculateShipping } = useSettings();

  // Get user token if logged in
  const getToken = () => {
    if (typeof window === "undefined") return null;
    return Cookies.get("accessToken") || localStorage.getItem("token");
  };

  const resolveVariantId = (item) => {
    if (isComboCartItem(item)) return null;
    const rawVariant = item?.variant?._id || item?.variant || item?.variantId;
    if (rawVariant === undefined || rawVariant === null || rawVariant === "") {
      return null;
    }
    return String(rawVariant);
  };

  // Fetch cart from API or local storage
  const fetchCart = async () => {
    try {
      setLoading(true);
      const token = getToken();
      const sessionId = getSessionId();

      const headers = {
        "Content-Type": "application/json",
      };

      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      if (sessionId && !token) {
        headers["X-Session-Id"] = sessionId;
      }

      const response = await fetch(buildApiUrl("/cart"), {
        method: "GET",
        headers,
        credentials: "include",
      });

      const data = await parseJsonSafely(response);

      if (data?.success && data?.data) {
        setCartItems(data.data.items || []);
        setCartCount(data.data.itemCount || 0);
        setCartTotal(round2(data.data.subtotal || 0));
      } else {
        // Fallback to local storage
        loadFromLocalStorage();
      }
    } catch (error) {
      console.error("Error fetching cart:", error);
      const restoredFromLocal = loadFromLocalStorage();
      if (!restoredFromLocal && shouldShowCartFetchErrorToast()) {
        toast.error("Unable to sync cart right now. Please refresh.");
      }
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

      if (isComboRequest && !comboId) {
        toast.error("Combo is unavailable right now.");
        return { success: false, message: "Combo unavailable" };
      }

      const headers = {
        "Content-Type": "application/json",
      };

      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      if (sessionId && !token) {
        headers["X-Session-Id"] = sessionId;
      }

      const response = await fetch(buildApiUrl("/cart/add"), {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify(
          isComboRequest
            ? {
                itemType: "combo",
                comboId: comboId || undefined,
                quantity,
              }
            : {
                productId: product._id || product.id,
                quantity,
                price: product.price,
                originalPrice: product.originalPrice || product.oldPrice,
                variantId: product.variantId || product.selectedVariant?._id || undefined,
                variantName: product.selectedVariant?.name || undefined,
              },
        ),
      });

      const data = await parseJsonSafely(response);
      const errorMessage = getResponseErrorMessage(
        data,
        isComboRequest ? "Cannot add combo" : "Cannot add item",
      );

      if (data?.success) {
        setCartItems(data.data.items || []);
        setCartCount(data.data.itemCount || 0);
        setCartTotal(round2(data.data.subtotal || 0));

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
          trackEvent("add_to_cart", {
            productId: String(product._id || product.id || ""),
            quantity: Number(quantity || 1),
            price: Number(product.price || 0),
            variantId: String(product.variantId || product.selectedVariant?._id || ""),
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

        addToCartLocal(product, quantity);
        trackEvent("add_to_cart", {
          productId: String(product._id || product.id || ""),
          quantity: Number(quantity || 1),
          price: Number(product.price || 0),
          variantId: String(product.variantId || product.selectedVariant?._id || ""),
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
      addToCartLocal(product, quantity);
      trackEvent("add_to_cart", {
        productId: String(product._id || product.id || ""),
        quantity: Number(quantity || 1),
        price: Number(product.price || 0),
        variantId: String(product.variantId || product.selectedVariant?._id || ""),
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
    // Check stock if available in product object
    const stock = product.stock !== undefined ? product.stock : Infinity;

    // If we're adding NEW item, check if quantum <= stock
    // If we're updating existing, check if (existing + quantity) <= stock

    const existingIndex = cartItems.findIndex((item) => {
      const itemId =
        item.product?._id || item.product?.id || item.product || item.id;
      const productId = product._id || product.id;
      return String(itemId) === String(productId);
    });

    let newItems;
    if (existingIndex > -1) {
      const currentQty = cartItems[existingIndex].quantity;
      if (currentQty + quantity > stock) {
        toast.error(`Only ${stock} items available`);
        return;
      }
      newItems = [...cartItems];
      newItems[existingIndex].quantity += quantity;
    } else {
      if (quantity > stock) {
        toast.error(`Only ${stock} items available`);
        return;
      }
      newItems = [
        ...cartItems,
        {
          // Standardize structure
          product: product, // Store full object if possible or ID.
          productData: product,
          _id: product._id || product.id,
          quantity,
          price: product.price,
          originalPrice: product.originalPrice || product.oldPrice,
        },
      ];
    }

    setCartItems(newItems);
    calculateTotals(newItems);
    saveToLocalStorage(newItems);
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
        options?.itemType === "combo" || options?.comboId || isComboPayload(options);
      const comboId = isComboRequest ? resolveComboId(options) || productId : "";

      const headers = {
        "Content-Type": "application/json",
      };

      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      if (sessionId && !token) {
        headers["X-Session-Id"] = sessionId;
      }

      const response = await fetch(buildApiUrl("/cart/update"), {
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
      const errorMessage = getResponseErrorMessage(
        data,
        isComboRequest ? "Cannot update combo" : "Cannot update quantity",
      );

      if (data?.success) {
        setCartItems(data.data.items || []);
        setCartCount(data.data.itemCount || 0);
        setCartTotal(round2(data.data.subtotal || 0));
        return { success: true };
      } else {
        if (response.status >= 400 && response.status < 500) {
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
        String(item.product?._id || item.product?.id || item.product || item.id) ===
          String(productId) &&
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
      options?.itemType === "combo" || options?.comboId || isComboPayload(options);
    const resolvedVariantId =
      !isComboRequest
        ? variantId ??
          resolveVariantId(
            cartItems.find(
              (item) =>
                String(
                  item.product?._id || item.product?.id || item.product || item.id,
                ) === String(productId),
            ),
          )
        : null;
    const comboId = isComboRequest ? resolveComboId(options) || productId : "";

    try {
      setLoading(true);
      const token = getToken();
      const sessionId = getSessionId();

      const headers = {
        "Content-Type": "application/json",
      };

      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      if (sessionId && !token) {
        headers["X-Session-Id"] = sessionId;
      }

      const queryParts = [];
      if (isComboRequest) {
        queryParts.push("itemType=combo");
        if (comboId) {
          queryParts.push(`comboId=${encodeURIComponent(String(comboId))}`);
        }
      } else if (resolvedVariantId) {
        queryParts.push(`variantId=${encodeURIComponent(String(resolvedVariantId))}`);
      }
      const query = queryParts.length ? `?${queryParts.join("&")}` : "";
      const response = await fetch(buildApiUrl(`/cart/remove/${productId}${query}`), {
        method: "DELETE",
        headers,
        credentials: "include",
      });

      const data = await parseJsonSafely(response);

      if (data?.success) {
        setCartItems(data.data.items || []);
        setCartCount(data.data.itemCount || 0);
        setCartTotal(round2(data.data.subtotal || 0));
        if (!isComboRequest) {
          trackEvent("remove_from_cart", {
            productId: String(productId || ""),
            variantId: String(resolvedVariantId || ""),
          });
        }
        // toast.success("Item removed from cart");
      } else {
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
      options?.itemType === "combo" || options?.comboId || isComboPayload(options);
    const comboId = isComboRequest ? resolveComboId(options) || productId : "";
    setCartItems((prev) => {
      const newItems = prev.filter((item) => {
        if (isComboRequest) {
          if (!isComboCartItem(item)) return true;
          const itemComboId = resolveComboId(item);
          return String(itemComboId || "") !== String(comboId || "");
        }

        const itemProductId = String(
          item.product?._id || item.product?.id || item.product || item.id,
        );
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

      const headers = {
        "Content-Type": "application/json",
      };

      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      if (sessionId && !token) {
        headers["X-Session-Id"] = sessionId;
      }

      await fetch(buildApiUrl("/cart/clear"), {
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
  const isInCart = (productId) => {
    return cartItems.some(
      (item) =>
        !isComboCartItem(item) &&
        String(
          item.product?._id || item.product?.id || item.product || item.id,
        ) === String(productId),
    );
  };

  // Get item quantity in cart
  const getItemQuantity = (productId) => {
    const item = cartItems.find(
      (item) =>
        !isComboCartItem(item) &&
        String(
          item.product?._id || item.product?.id || item.product || item.id,
        ) === String(productId),
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
    addToCart({ ...combo, itemType: "combo" }, quantity);

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
