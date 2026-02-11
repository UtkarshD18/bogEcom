"use client";

import { useSettings } from "@/context/SettingsContext";
import { round2 } from "@/utils/gst";
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
const API_URL = (
  process.env.NEXT_PUBLIC_APP_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:8000"
).replace(/\/+$/, "");

// Generate or get session ID for guest carts
const getSessionId = () => {
  if (typeof window === "undefined") return null;

  let sessionId = localStorage.getItem("cartSessionId");
  if (!sessionId) {
    sessionId = `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem("cartSessionId", sessionId);
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

      const response = await fetch(`${API_URL}/api/cart`, {
        method: "GET",
        headers,
        credentials: "include",
      });

      const data = await response.json();

      if (data.success && data.data) {
        setCartItems(data.data.items || []);
        setCartCount(data.data.itemCount || 0);
        setCartTotal(round2(data.data.subtotal || 0));
      } else {
        // Fallback to local storage
        loadFromLocalStorage();
      }
    } catch (error) {
      console.error("Error fetching cart:", error);
      toast.error("Failed to fetch cart. Using local data.");
      loadFromLocalStorage();
    } finally {
      setLoading(false);
      setIsInitialized(true);
    }
  };

  // Load cart from local storage (fallback)
  const loadFromLocalStorage = () => {
    if (typeof window === "undefined") return;

    const savedCart = localStorage.getItem("cart");
    if (savedCart) {
      try {
        const parsed = JSON.parse(savedCart);
        setCartItems(parsed.items || []);
        calculateTotals(parsed.items || []);
      } catch (e) {
        console.error("Error parsing cart from localStorage:", e);
      }
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

      const headers = {
        "Content-Type": "application/json",
      };

      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      if (sessionId && !token) {
        headers["X-Session-Id"] = sessionId;
      }

      const response = await fetch(`${API_URL}/api/cart/add`, {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({
          productId: product._id || product.id,
          quantity,
          price: product.price,
          originalPrice: product.originalPrice || product.oldPrice,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setCartItems(data.data.items || []);
        setCartCount(data.data.itemCount || 0);
        setCartTotal(round2(data.data.subtotal || 0));

        // Auto-open drawer only if it was the first item added
        if (cartItems.length === 0) {
          setIsDrawerOpen(true);
        }
        return { success: true };
      } else {
        // If server says "Only X items available", SHOW ERROR and DO NOT FALLBACK
        if (response.status === 400 && data.message && data.message.includes("items available")) {
          toast.error(data.message);
          return { success: false, message: data.message };
        }

        // Fallback to local storage ONLY for other errors (e.g. network/auth issues that aren't business logic rejections)
        // But for "Out of Stock", we should trust the server.
        // If it's a 404 (product not found) or 500, maybe fallback?
        // Actually, for consistent "Out of Stock" behavior, better to NOT fallback if we know the stock.
        // However, the original code fell back for *everything*.
        // Let's refine: If 400, it's likely a business rule violation (stock).

        if (response.status === 400) {
          toast.error(data.message || "Cannot add item");
          return { success: false, message: data.message };
        }

        addToCartLocal(product, quantity);
        if (cartItems.length === 0) {
          setIsDrawerOpen(true);
        }
        return { success: true };
      }
    } catch (error) {
      console.error("Error adding to cart:", error);
      addToCartLocal(product, quantity);
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
    const { total, count } = items.reduce(
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
  const updateQuantity = async (productId, quantity) => {
    if (quantity < 1) {
      return removeFromCart(productId);
    }

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

      const response = await fetch(`${API_URL}/api/cart/update`, {
        method: "PUT",
        headers,
        credentials: "include",
        body: JSON.stringify({ productId, quantity }),
      });

      const data = await response.json();

      if (data.success) {
        setCartItems(data.data.items || []);
        setCartCount(data.data.itemCount || 0);
        setCartTotal(round2(data.data.subtotal || 0));
        return { success: true };
      } else {
        if (response.status === 400) {
          toast.error(data.message || "Cannot update quantity");
          return { success: false, message: data.message };
        }
        updateQuantityLocal(productId, quantity);
      }
    } catch (error) {
      console.error("Error updating cart:", error);
      updateQuantityLocal(productId, quantity);
    } finally {
      setLoading(false);
    }
  };

  // Update quantity locally
  const updateQuantityLocal = (productId, quantity) => {
    setCartItems((prev) => {
      const newItems = prev.map((item) =>
        String(
          item.product?._id || item.product?.id || item.product || item.id,
        ) === String(productId)
          ? { ...item, quantity }
          : item,
      );
      calculateTotals(newItems);
      saveToLocalStorage(newItems);
      return newItems;
    });
  };

  // Remove from cart
  const removeFromCart = async (productId) => {
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

      const response = await fetch(`${API_URL}/api/cart/remove/${productId}`, {
        method: "DELETE",
        headers,
        credentials: "include",
      });

      const data = await response.json();

      if (data.success) {
        setCartItems(data.data.items || []);
        setCartCount(data.data.itemCount || 0);
        setCartTotal(round2(data.data.subtotal || 0));
        // toast.success("Item removed from cart");
      } else {
        removeFromCartLocal(productId);
      }
    } catch (error) {
      console.error("Error removing from cart:", error);
      removeFromCartLocal(productId);
    } finally {
      setLoading(false);
    }
  };

  // Remove locally
  const removeFromCartLocal = (productId) => {
    setCartItems((prev) => {
      const newItems = prev.filter(
        (item) =>
          String(
            item.product?._id || item.product?.id || item.product || item.id,
          ) !== String(productId),
      );
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

      await fetch(`${API_URL}/api/cart/clear`, {
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
        String(
          item.product?._id || item.product?.id || item.product || item.id,
        ) === String(productId),
    );
  };

  // Get item quantity in cart
  const getItemQuantity = (productId) => {
    const item = cartItems.find(
      (item) =>
        String(
          item.product?._id || item.product?.id || item.product || item.id,
        ) === String(productId),
    );
    return item?.quantity || 0;
  };

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
        updateQuantity,
        removeFromCart,
        clearCart,
        isInCart,
        getItemQuantity,
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
