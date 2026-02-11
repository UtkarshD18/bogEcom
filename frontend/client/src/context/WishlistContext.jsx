"use client";

import Cookies from "js-cookie";
import { createContext, useContext, useEffect, useState } from "react";
import { toast } from "react-hot-toast";

/**
 * Wishlist Context
 *
 * Production-ready wishlist management with:
 * - Local storage persistence for guests
 * - API sync for logged-in users
 */

const WishlistContext = createContext();
const API_URL = (
  process.env.NEXT_PUBLIC_APP_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:8000"
).replace(/\/+$/, "");

export const WishlistProvider = ({ children }) => {
  const [wishlistItems, setWishlistItems] = useState([]);
  const [wishlistCount, setWishlistCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Get user token if logged in
  const getToken = () => {
    if (typeof window === "undefined") return null;
    return Cookies.get("accessToken") || localStorage.getItem("token");
  };

  // Fetch wishlist from API or local storage
  const fetchWishlist = async () => {
    try {
      setLoading(true);
      const token = getToken();

      if (token) {
        const response = await fetch(`${API_URL}/api/wishlist`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          credentials: "include",
        });

        const data = await response.json();

        if (data.success && data.data) {
          setWishlistItems(data.data.items || []);
          setWishlistCount(data.data.itemCount || data.data.items?.length || 0);
        } else {
          loadFromLocalStorage();
        }
      } else {
        loadFromLocalStorage();
      }
    } catch (error) {
      console.error("Error fetching wishlist:", error);
      loadFromLocalStorage();
    } finally {
      setLoading(false);
      setIsInitialized(true);
    }
  };

  // Load wishlist from local storage
  const loadFromLocalStorage = () => {
    if (typeof window === "undefined") return;

    const savedWishlist = localStorage.getItem("wishlist");
    if (savedWishlist) {
      try {
        const parsed = JSON.parse(savedWishlist);
        setWishlistItems(parsed || []);
        setWishlistCount(parsed?.length || 0);
      } catch (e) {
        console.error("Error parsing wishlist:", e);
      }
    }
  };

  // Save to local storage
  const saveToLocalStorage = (items) => {
    if (typeof window === "undefined") return;
    localStorage.setItem("wishlist", JSON.stringify(items));
  };

  // Add to wishlist
  const addToWishlist = async (product) => {
    try {
      setLoading(true);
      const token = getToken();
      const productId = product._id || product.id;

      if (token) {
        const response = await fetch(`${API_URL}/api/wishlist/add`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          credentials: "include",
          body: JSON.stringify({ productId }),
        });

        const data = await response.json();

        if (data.success) {
          setWishlistItems(data.data.items || []);
          setWishlistCount(data.data.itemCount || data.data.items?.length || 0);
          toast.success("Item added to wishlist");
          return { success: true };
        }
      }

      // Fallback to local storage
      addToWishlistLocal(product);
      toast.success("Item added to wishlist");
      return { success: true };
    } catch (error) {
      console.error("Error adding to wishlist:", error);
      addToWishlistLocal(product);
      toast.success("Item added to wishlist");
      return { success: true };
    } finally {
      setLoading(false);
    }
  };

  // Add to wishlist locally
  const addToWishlistLocal = (product) => {
    const productId = product._id || product.id;

    // Check if already exists before updating state
    const exists = wishlistItems.some(
      (item) => (item.product?._id || item.product || item._id) === productId,
    );

    if (exists) {
      toast.error("Already in wishlist");
      return;
    }

    setWishlistItems((prev) => {
      const newItems = [
        ...prev,
        {
          product: productId,
          productData: product,
          addedAt: new Date().toISOString(),
        },
      ];

      setWishlistCount(newItems.length);
      saveToLocalStorage(newItems);
      return newItems;
    });
  };

  // Remove from wishlist
  const removeFromWishlist = async (productId) => {
    try {
      setLoading(true);
      const token = getToken();

      if (token) {
        const response = await fetch(
          `${API_URL}/api/wishlist/remove/${productId}`,
          {
            method: "DELETE",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            credentials: "include",
          },
        );

        const data = await response.json();

        if (data.success) {
          setWishlistItems(data.data.items || []);
          setWishlistCount(data.data.itemCount || data.data.items?.length || 0);
          toast.success("Item removed from wishlist");
          return { success: true };
        }
      }

      // Fallback to local storage
      removeFromWishlistLocal(productId);
      toast.success("Item removed from wishlist");
      return { success: true };
    } catch (error) {
      console.error("Error removing from wishlist:", error);
      removeFromWishlistLocal(productId);
      toast.success("Item removed from wishlist");
      return { success: true };
    } finally {
      setLoading(false);
    }
  };

  // Remove locally
  const removeFromWishlistLocal = (productId) => {
    setWishlistItems((prev) => {
      const newItems = prev.filter(
        (item) => (item.product?._id || item.product || item._id) !== productId,
      );
      setWishlistCount(newItems.length);
      saveToLocalStorage(newItems);
      return newItems;
    });
  };

  // Toggle wishlist (add or remove)
  const toggleWishlist = async (product) => {
    const productId = product._id || product.id;
    if (isInWishlist(productId)) {
      return removeFromWishlist(productId);
    } else {
      return addToWishlist(product);
    }
  };

  // Check if product is in wishlist
  const isInWishlist = (productId) => {
    return wishlistItems.some(
      (item) => (item.product?._id || item.product || item._id) === productId,
    );
  };

  // Clear wishlist
  const clearWishlist = async () => {
    try {
      setLoading(true);
      const token = getToken();

      if (token) {
        await fetch(`${API_URL}/api/wishlist/clear`, {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          credentials: "include",
        });
      }

      setWishlistItems([]);
      setWishlistCount(0);
      localStorage.removeItem("wishlist");
    } catch (error) {
      console.error("Error clearing wishlist:", error);
    } finally {
      setLoading(false);
    }
  };

  // Initialize on mount
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
  const context = useContext(WishlistContext);
  if (!context) {
    throw new Error("useWishlist must be used within a WishlistProvider");
  }
  return context;
};

export default WishlistContext;
