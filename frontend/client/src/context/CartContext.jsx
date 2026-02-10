"use client";

import Cookies from "js-cookie";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
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

  // Session-based sidebar trigger: opens once per browser session on first add-to-cart
  const handleAddToCartUI = useCallback((productName) => {
    if (typeof window === "undefined") return;
    const firstAddDone = sessionStorage.getItem("cartFirstAddDone");
    console.log("[Cart] First add flag:", firstAddDone, "| Product:", productName);
    if (!firstAddDone) {
      console.log("[Cart] Opening sidebar (first add this session)");
      setIsDrawerOpen(true);
      sessionStorage.setItem("cartFirstAddDone", "true");
    } else {
      console.log("[Cart] Showing toast (sidebar already shown this session)");
      toast.success(`${productName} added to cart!`);
    }
  }, []);

  const handleSetIsDrawerOpen = useCallback((open) => {
    setIsDrawerOpen(open);
  }, []);

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
        const apiItems = data.data.items || [];
        if (apiItems.length > 0) {
          // API has items — use as source of truth & sync to localStorage
          setCartItems(apiItems);
          setCartCount(data.data.itemCount || 0);
          setCartTotal(data.data.subtotal || 0);
          saveToLocalStorage(apiItems);
        }
        // If API returned empty, keep whatever localStorage already hydrated
      }
      // If API returned !success, keep whatever localStorage already hydrated
    } catch (error) {
      console.error("Error fetching cart:", error);
      // localStorage items already loaded in init, nothing extra needed
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
        const rawItems = parsed.items;

        // Validate: items must be a non-empty array of objects with product & quantity
        if (
          !Array.isArray(rawItems) ||
          rawItems.length === 0 ||
          !rawItems.every((i) => i && (i.product || i.productData) && typeof i.quantity === "number")
        ) {
          // Corrupted or empty — reset safely
          localStorage.removeItem("cart");
          return;
        }

        setCartItems(rawItems);
        calculateTotals(rawItems);
      } catch (e) {
        console.error("Error parsing cart from localStorage:", e);
        localStorage.removeItem("cart");
      }
    }
  };

  // Save to local storage
  const saveToLocalStorage = (items) => {
    if (typeof window === "undefined") return;
    localStorage.setItem("cart", JSON.stringify({ items }));
  };

  // Calculate totals
  const calculateTotals = (items) => {
    const count = items.reduce((sum, item) => sum + item.quantity, 0);
    const total = items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );
    setCartCount(count);
    setCartTotal(total);
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
        const newItems = data.data.items || [];
        setCartItems(newItems);
        setCartCount(data.data.itemCount || 0);
        setCartTotal(data.data.subtotal || 0);
        saveToLocalStorage(newItems);
        handleAddToCartUI(product.name);
        return { success: true };
      } else {
        // Fallback to local storage
        addToCartLocal(product, quantity);
        return { success: true };
      }
    } catch (error) {
      console.error("Error adding to cart:", error);
      addToCartLocal(product, quantity);
      return { success: true };
    } finally {
      setLoading(false);
    }
  };

  // Add to cart locally (fallback)
  const addToCartLocal = (product, quantity = 1) => {
    const existingIndex = cartItems.findIndex(
      (item) =>
        (item.product?._id || item.product) === (product._id || product.id),
    );

    let newItems;
    if (existingIndex > -1) {
      newItems = [...cartItems];
      newItems[existingIndex].quantity += quantity;
    } else {
      newItems = [
        ...cartItems,
        {
          product: product._id || product.id,
          productData: product,
          quantity,
          price: product.price,
          originalPrice: product.originalPrice || product.oldPrice,
        },
      ];
    }

    setCartItems(newItems);
    calculateTotals(newItems);
    saveToLocalStorage(newItems);
    handleAddToCartUI(product.name);
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
        const newItems = data.data.items || [];
        setCartItems(newItems);
        setCartCount(data.data.itemCount || 0);
        setCartTotal(data.data.subtotal || 0);
        saveToLocalStorage(newItems);
      } else {
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
    // Compute once from current state, use everywhere (avoids stale closure)
    const newItems = cartItems.map((item) =>
      (item.product?._id || item.product) === productId
        ? { ...item, quantity }
        : item,
    );
    setCartItems(newItems);
    calculateTotals(newItems);
    saveToLocalStorage(newItems);
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
        const newItems = data.data.items || [];
        setCartItems(newItems);
        setCartCount(data.data.itemCount || 0);
        setCartTotal(data.data.subtotal || 0);
        saveToLocalStorage(newItems);
        toast.success("Item removed from cart");
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
    // Compute once from current state, use everywhere (avoids stale closure)
    const newItems = cartItems.filter(
      (item) => (item.product?._id || item.product) !== productId,
    );
    setCartItems(newItems);
    calculateTotals(newItems);
    saveToLocalStorage(newItems);
    toast.success("Item removed from cart");
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
      (item) => (item.product?._id || item.product) === productId,
    );
  };

  // Get item quantity in cart
  const getItemQuantity = (productId) => {
    const item = cartItems.find(
      (item) => (item.product?._id || item.product) === productId,
    );
    return item?.quantity || 0;
  };

  // Auto-persist cart to localStorage whenever it changes (safety net)
  useEffect(() => {
    if (!isInitialized) return;
    if (cartItems.length > 0) {
      saveToLocalStorage(cartItems);
    } else {
      localStorage.removeItem("cart");
    }
  }, [cartItems, isInitialized]);

  // Initialize cart on mount
  useEffect(() => {
    // Step 1: Hydrate immediately from localStorage so UI shows data before API responds
    loadFromLocalStorage();
    // Step 2: Then sync with server (overrides only if server has actual items)
    fetchCart();
  }, []);

  return (
    <CartContext.Provider
      value={{
        cartItems,
        cartCount,
        cartTotal,
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
        setIsDrawerOpen: handleSetIsDrawerOpen,
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
