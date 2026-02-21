"use client";

import {
  deleteData,
  fetchDataFromApi,
  getStoredAccessToken,
  postData,
} from "@/utils/api";
import { createContext, useContext, useEffect, useState } from "react";
import { toast } from "react-hot-toast";

const WishlistContext = createContext();

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
    return getStoredAccessToken();
  };

  const resolveProductId = (item) =>
    String(
      item?.product?._id ||
        item?.product?.id ||
        item?.product ||
        item?.productData?._id ||
        item?.productData?.id ||
        item?.id ||
        item?._id ||
        item ||
        "",
    );

  const readWishlistItems = (payload) =>
    payload?.data?.items || payload?.items || [];

  const readWishlistCount = (payload, items) => {
    const count = payload?.data?.itemCount ?? payload?.itemCount;
    return Number.isFinite(Number(count)) ? Number(count) : items.length;
  };

  const normalizeQuantity = (value, fallback = 1) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    const next = Math.floor(parsed);
    if (next < 1) return fallback;
    return Math.min(next, 100);
  };

  const normalizePrice = (value, fallback = 0) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return Number.isFinite(Number(fallback)) ? Number(fallback) : 0;
    }
    return Math.round((parsed + Number.EPSILON) * 100) / 100;
  };

  const toWishlistPayload = (input) => {
    const raw = input && typeof input === "object" ? input : {};
    const selectedVariant =
      raw?.selectedVariant && typeof raw.selectedVariant === "object"
        ? raw.selectedVariant
        : null;

    const productId = resolveProductId(input);
    const quantity = normalizeQuantity(raw?.quantity ?? raw?.wishlistQuantity ?? 1);
    const variantId = String(
      raw?.variantId || raw?.variant || selectedVariant?._id || "",
    ).trim();
    const variantName = String(raw?.variantName || selectedVariant?.name || "").trim();

    const price = normalizePrice(
      raw?.price,
      selectedVariant?.price ?? raw?.productData?.price ?? 0,
    );
    const originalPrice = normalizePrice(
      raw?.originalPrice ?? raw?.oldPrice,
      selectedVariant?.originalPrice ??
        raw?.productData?.originalPrice ??
        raw?.productData?.oldPrice ??
        0,
    );

    return {
      productId,
      quantity,
      variantId: variantId || null,
      variantName,
      price,
      originalPrice,
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

      const data = await fetchDataFromApi("/api/wishlist");
      if (data?.error === true || !data?.success) {
        setWishlistItems([]);
        setWishlistCount(0);
        return;
      }

      const items = readWishlistItems(data);
      setWishlistItems(items);
      setWishlistCount(readWishlistCount(data, items));
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

  const addToWishlist = async (product) => {
    const payload = toWishlistPayload(product);
    const productId = payload.productId;
    const token = getToken();

    if (!productId) {
      toast.error("Invalid product");
      return false;
    }

    // ---------- GUEST ----------
    if (!token) {
      const exists = wishlistItems.some(
        (item) => resolveProductId(item) === productId
      );

      if (exists) {
        toast.error("Already in wishlist");
        return false;
      }

      const productData = product && typeof product === "object" ? product : {};
      const selectedVariant =
        payload.variantId
          ? {
              ...((productData?.selectedVariant &&
                typeof productData.selectedVariant === "object"
                  ? productData.selectedVariant
                  : {})),
              _id: payload.variantId,
              name:
                payload.variantName ||
                productData?.selectedVariant?.name ||
                "",
              price: payload.price,
              originalPrice: payload.originalPrice,
            }
          : productData?.selectedVariant;

      const newItems = [
        ...wishlistItems,
        {
          product: productId,
          productData: {
            ...productData,
            price: payload.price,
            originalPrice: payload.originalPrice,
            quantity: payload.quantity,
            variantId: payload.variantId || undefined,
            variantName: payload.variantName || undefined,
            selectedVariant,
          },
          quantity: payload.quantity,
          variant: payload.variantId,
          variantName: payload.variantName,
          price: payload.price,
          originalPrice: payload.originalPrice,
          addedAt: new Date().toISOString(),
        },
      ];

      setWishlistItems(newItems);
      setWishlistCount(newItems.length);
      saveLocal(newItems);
      toast.success("Added to wishlist");
      return true;
    }

    // ---------- AUTH USER ----------
    try {
      const data = await postData("/api/wishlist/add", {
        productId,
        quantity: payload.quantity,
        variantId: payload.variantId || undefined,
        variantName: payload.variantName || undefined,
        price: payload.price,
        originalPrice: payload.originalPrice,
      });
      if (data?.error === true || !data?.success) {
        toast.error(data?.message || "Failed to add to wishlist");
        return false;
      }

      const items = readWishlistItems(data);
      setWishlistItems(items);
      setWishlistCount(readWishlistCount(data, items));
      toast.success("Added to wishlist");
      return true;
    } catch (err) {
      console.error(err);
      toast.error("Failed to add to wishlist");
      return false;
    }
  };

  // =============================
  // REMOVE
  // =============================

  const removeFromWishlist = async (input) => {
    const productId = resolveProductId(input);
    const token = getToken();

    if (!productId) {
      toast.error("Invalid product");
      return false;
    }

    // ---------- GUEST ----------
    if (!token) {
      const next = wishlistItems.filter(
        (item) => resolveProductId(item) !== productId
      );
      setWishlistItems(next);
      setWishlistCount(next.length);
      saveLocal(next);
      toast.success("Removed from wishlist");
      return true;
    }

    setRemovingItems((prev) => ({ ...prev, [productId]: true }));

    try {
      const data = await deleteData(`/api/wishlist/remove/${productId}`);
      if (data?.error === true || !data?.success) {
        toast.error(data?.message || "Failed to remove item");
        return false;
      }

      const items = readWishlistItems(data);
      setWishlistItems(items);
      setWishlistCount(readWishlistCount(data, items));
      toast.success("Removed from wishlist");
      return true;
    } catch (err) {
      console.error(err);
      toast.error("Failed to remove item");
      return false;
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

  const isInWishlist = (productId) =>
    wishlistItems.some(
      (item) => resolveProductId(item) === String(productId)
    );

  const toggleWishlist = async (product) => {
    const payload = toWishlistPayload(product);
    const id = payload.productId;
    const token = getToken();
    const isCurrentlyWishlisted = isInWishlist(id);

    if (!id) {
      toast.error("Invalid product");
      return false;
    }

    if (!token) {
      if (isCurrentlyWishlisted) {
        return removeFromWishlist(id);
      }
      return addToWishlist(product);
    }

    try {
      const data = await postData("/api/wishlist/toggle", {
        productId: id,
        quantity: payload.quantity,
        variantId: payload.variantId || undefined,
        variantName: payload.variantName || undefined,
        price: payload.price,
        originalPrice: payload.originalPrice,
      });
      if (data?.error === true || !data?.success) {
        // Fallback path keeps UX working even if toggle endpoint fails once.
        return isCurrentlyWishlisted
          ? removeFromWishlist(id)
          : addToWishlist(product);
      }

      const items = readWishlistItems(data);
      setWishlistItems(items);
      setWishlistCount(readWishlistCount(data, items));

      const isWishlisted = Boolean(
        data?.data?.isWishlisted ??
          items.some((item) => resolveProductId(item) === id),
      );

      toast.success(isWishlisted ? "Added to wishlist" : "Removed from wishlist");
      return isWishlisted;
    } catch (err) {
      console.error(err);
      return isCurrentlyWishlisted
        ? removeFromWishlist(id)
        : addToWishlist(product);
    }
  };

  const clearWishlist = async () => {
    const token = getToken();

    if (token) {
      await deleteData("/api/wishlist/clear");
    }

    setWishlistItems([]);
    setWishlistCount(0);
    if (typeof window !== "undefined") {
      localStorage.removeItem("wishlist");
    }
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

