"use client";

import { API_BASE_URL } from "@/utils/api";
import { parseJsonSafely, getResponseErrorMessage } from "@/utils/safeJsonFetch";
import Cookies from "js-cookie";
import { createContext, useContext, useEffect, useState } from "react";
import { toast } from "react-hot-toast";

const WishlistContext = createContext();
const API_URL = API_BASE_URL;

export const WishlistProvider = ({ children }) => {
  const [wishlistItems, setWishlistItems] = useState([]);
  const [wishlistCount, setWishlistCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [removingItems, setRemovingItems] = useState({});
  const [isInitialized, setIsInitialized] = useState(false);

  // =============================
  // HELPERS
  // =============================

  const getToken = () => {
    if (typeof window === "undefined") return null;
    return Cookies.get("accessToken") || localStorage.getItem("token");
  };

  const resolveProductId = (item) =>
    String(
      item?.product?._id ||
        item?.product ||
        item?.productData?._id ||
        item?.id ||
        item?._id ||
        item ||
        "",
    );

  const resolveVariantId = (item) => {
    const raw =
      item?.variantId ||
      item?.variant?._id ||
      item?.variant ||
      item?.selectedVariant?._id ||
      null;
    if (raw === undefined || raw === null || raw === "") return null;
    return String(raw).trim();
  };

  const resolveQuantity = (item, fallback = 1) => {
    const parsed = Number(item?.quantity ?? fallback);
    if (!Number.isFinite(parsed) || parsed < 1) return 1;
    return Math.floor(parsed);
  };

  const getWishlistKey = (productId, variantId = null) =>
    `${String(productId || "")}::${String(variantId || "")}`;

  const resolveGuestSnapshot = ({
    product,
    variantId = null,
    variantName = "",
    quantity = 1,
  }) => {
    const normalizedVariantId =
      variantId === undefined || variantId === null || variantId === ""
        ? null
        : String(variantId).trim();
    let resolvedVariantName = String(variantName || "").trim();
    let price = Number(product?.price || 0);
    let originalPrice = Number(
      product?.originalPrice || product?.oldPrice || product?.price || 0,
    );

    if (normalizedVariantId && Array.isArray(product?.variants)) {
      const match = product.variants.find(
        (variant) => String(variant?._id || "") === normalizedVariantId,
      );
      if (match) {
        price = Number(match.price ?? price ?? 0);
        originalPrice = Number(match.originalPrice ?? originalPrice ?? price ?? 0);
        if (!resolvedVariantName) {
          resolvedVariantName = String(match.name || "").trim();
        }
      }
    }

    if (!resolvedVariantName && product?.selectedVariant?.name) {
      resolvedVariantName = String(product.selectedVariant.name).trim();
    }

    const parsedQty = Number(quantity);
    const resolvedQuantity =
      Number.isFinite(parsedQty) && parsedQty > 0 ? Math.floor(parsedQty) : 1;

    return {
      variantId: normalizedVariantId,
      variantName: resolvedVariantName,
      quantity: resolvedQuantity,
      priceSnapshot: Number.isFinite(price) ? price : 0,
      originalPriceSnapshot: Number.isFinite(originalPrice) ? originalPrice : 0,
    };
  };

  const saveLocal = (items) => {
    if (typeof window === "undefined") return;
    localStorage.setItem("wishlist", JSON.stringify(items));
  };

  const loadLocal = () => {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem("wishlist");
    if (!saved) return;

    try {
      const parsed = JSON.parse(saved);
      setWishlistItems(parsed || []);
      setWishlistCount(parsed?.length || 0);
    } catch (err) {
      console.error(err);
    }
  };

  // =============================
  // FETCH
  // =============================

  const fetchWishlist = async () => {
    try {
      setLoading(true);
      const token = getToken();

      if (!token) {
        loadLocal();
        return;
      }

      const res = await fetch(`${API_URL}/api/wishlist`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        credentials: "include",
      });

      const data = await parseJsonSafely(res);

      if (!res.ok) {
        setWishlistItems([]);
        setWishlistCount(0);
        return;
      }

      setWishlistItems(data?.data?.items || []);
      setWishlistCount(data?.data?.itemCount || 0);
    } catch (err) {
      console.error(err);
      if (!getToken()) {
        loadLocal();
      } else {
        setWishlistItems([]);
        setWishlistCount(0);
      }
    } finally {
      setLoading(false);
      setIsInitialized(true);
    }
  };

  // =============================
  // ADD
  // =============================

  const addToWishlist = async (product, options = {}) => {
    const productId = resolveProductId(product);
    const variantId = resolveVariantId(options) || resolveVariantId(product);
    const variantName = String(
      options?.variantName || product?.selectedVariant?.name || "",
    ).trim();
    const quantity = resolveQuantity(options, 1);
    const token = getToken();

    // ---------- GUEST ----------
    if (!token) {
      const exists = wishlistItems.some(
        (item) =>
          getWishlistKey(resolveProductId(item), resolveVariantId(item)) ===
          getWishlistKey(productId, variantId)
      );

      if (exists) {
        toast.error("Already in wishlist");
        return;
      }

      const guestSnapshot = resolveGuestSnapshot({
        product,
        variantId,
        variantName,
        quantity,
      });

      const newItems = [
        ...wishlistItems,
        {
          product: productId,
          productData: product,
          variantId: guestSnapshot.variantId,
          variantName: guestSnapshot.variantName,
          quantity: guestSnapshot.quantity,
          priceSnapshot: guestSnapshot.priceSnapshot,
          originalPriceSnapshot: guestSnapshot.originalPriceSnapshot,
          addedAt: new Date().toISOString(),
        },
      ];

      setWishlistItems(newItems);
      setWishlistCount(newItems.length);
      saveLocal(newItems);
      toast.success("Added to wishlist");
      return;
    }

    // ---------- AUTH USER ----------
    try {
      const res = await fetch(`${API_URL}/api/wishlist/add`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        credentials: "include",
        body: JSON.stringify({
          productId,
          variantId: variantId || undefined,
          variantName: variantName || undefined,
          quantity,
        }),
      });

      const data = await parseJsonSafely(res);

      if (!res.ok) {
        toast.error(
          getResponseErrorMessage(data, "Failed to add to wishlist")
        );
        return;
      }

      setWishlistItems(data?.data?.items || []);
      setWishlistCount(data?.data?.itemCount || 0);
      toast.success("Added to wishlist");
    } catch (err) {
      console.error(err);
      toast.error("Failed to add to wishlist");
    }
  };

  // =============================
  // REMOVE
  // =============================

  const removeFromWishlist = async (input) => {
    const productId = resolveProductId(input);
    const variantId = resolveVariantId(input);
    const token = getToken();

    if (!productId) {
      toast.error("Invalid product");
      return;
    }

    // ---------- GUEST ----------
    if (!token) {
      const next = wishlistItems.filter(
        (item) => {
          const itemProductId = resolveProductId(item);
          const itemVariantId = resolveVariantId(item);
          if (itemProductId !== productId) return true;
          if (!variantId) return false;
          return String(itemVariantId || "") !== String(variantId || "");
        }
      );
      setWishlistItems(next);
      setWishlistCount(next.length);
      saveLocal(next);
      toast.success("Removed from wishlist");
      return;
    }

    setRemovingItems((prev) => ({ ...prev, [productId]: true }));

    try {
      const query = variantId
        ? `?variantId=${encodeURIComponent(String(variantId))}`
        : "";
      const res = await fetch(`${API_URL}/api/wishlist/remove/${productId}${query}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        credentials: "include",
      });

      const data = await parseJsonSafely(res);

      if (!res.ok) {
        toast.error(
          getResponseErrorMessage(data, "Failed to remove item")
        );
        return;
      }

      setWishlistItems(data?.data?.items || []);
      setWishlistCount(data?.data?.itemCount || 0);
      toast.success("Removed from wishlist");
    } catch (err) {
      console.error(err);
      toast.error("Failed to remove item");
    } finally {
      setRemovingItems((prev) => {
        const next = { ...prev };
        delete next[productId];
        return next;
      });
    }
  };

  // =============================
  // HELPERS
  // =============================

  const isInWishlist = (productId, variantId = null) =>
    wishlistItems.some((item) => {
      const itemProductId = resolveProductId(item);
      if (itemProductId !== String(productId)) return false;
      if (!variantId) return true;
      return String(resolveVariantId(item) || "") === String(variantId || "");
    });

  const toggleWishlist = (product, options = {}) => {
    const id = resolveProductId(product);
    const variantId = resolveVariantId(options) || resolveVariantId(product);
    if (isInWishlist(id, variantId)) {
      return removeFromWishlist({ product: id, variantId });
    }
    return addToWishlist(product, options);
  };

  const clearWishlist = async () => {
    const token = getToken();

    if (token) {
      await fetch(`${API_URL}/api/wishlist/clear`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      });
    }

    setWishlistItems([]);
    setWishlistCount(0);
    localStorage.removeItem("wishlist");
  };

  useEffect(() => {
    fetchWishlist();
  }, []);

  return (
    <WishlistContext.Provider
      value={{
        wishlistItems,
        wishlistCount,
        loading,
        isInitialized,
        removingItems,
        addToWishlist,
        removeFromWishlist,
        toggleWishlist,
        isInWishlist,
        clearWishlist,
        fetchWishlist,
      }}
    >
      {children}
    </WishlistContext.Provider>
  );
};

export const useWishlist = () => {
  const ctx = useContext(WishlistContext);
  if (!ctx)
    throw new Error("useWishlist must be used within WishlistProvider");
  return ctx;
};

export default WishlistContext;

