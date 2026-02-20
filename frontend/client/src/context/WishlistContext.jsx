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

  const addToWishlist = async (product) => {
    const productId = resolveProductId(product);
    const token = getToken();

    // ---------- GUEST ----------
    if (!token) {
      const exists = wishlistItems.some(
        (item) => resolveProductId(item) === productId
      );

      if (exists) {
        toast.error("Already in wishlist");
        return;
      }

      const newItems = [
        ...wishlistItems,
        {
          product: productId,
          productData: product,
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
        body: JSON.stringify({ productId }),
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
    const token = getToken();

    if (!productId) {
      toast.error("Invalid product");
      return;
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
      return;
    }

    setRemovingItems((prev) => ({ ...prev, [productId]: true }));

    try {
      const res = await fetch(
        `${API_URL}/api/wishlist/remove/${productId}`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          credentials: "include",
        }
      );

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

  const isInWishlist = (productId) =>
    wishlistItems.some(
      (item) => resolveProductId(item) === String(productId)
    );

  const toggleWishlist = (product) => {
    const id = resolveProductId(product);
    if (isInWishlist(id)) {
      return removeFromWishlist(id);
    }
    return addToWishlist(product);
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

