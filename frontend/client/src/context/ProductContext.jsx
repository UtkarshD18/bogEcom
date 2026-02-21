"use client";

import { fetchDataFromApi } from "@/utils/api";
import { createContext, useContext, useEffect, useState } from "react";

/**
 * Product Context
 *
 * This context manages product data fetched from the backend API.
 * Admin panel manages products via backend, this context fetches and displays them.
 */

const ProductContext = createContext();

const sanitizePublicProducts = (items) =>
  Array.isArray(items)
    ? items.filter((product) => {
        const flag = product?.isExclusive;
        return !(flag === true || String(flag).trim().toLowerCase() === "true");
      })
    : [];

export const ProductProvider = ({ children }) => {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [featuredProducts, setFeaturedProducts] = useState([]);
  const [homeSlides, setHomeSlides] = useState([]);
  const [banners, setBanners] = useState([]);
  const [blogs, setBlogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch all products from API
  const fetchProducts = async (params = {}) => {
    try {
      setLoading(true);
      const mergedParams = {
        excludeExclusive: "true",
        ...params,
      };
      const queryString = new URLSearchParams(mergedParams).toString();
      const response = await fetchDataFromApi(`/api/products?${queryString}`);
      if (response?.error !== true) {
        setProducts(sanitizePublicProducts(response?.data || []));
      }
      return response;
    } catch (err) {
      console.error("Error fetching products:", err);
      setError(err.message);
      return { error: true, data: [] };
    } finally {
      setLoading(false);
    }
  };

  // Fetch single product by ID or slug
  const fetchProductById = async (id) => {
    try {
      const response = await fetchDataFromApi(`/api/products/${id}`);
      return response?.data || null;
    } catch (err) {
      console.error("Error fetching product:", err);
      return null;
    }
  };

  // Fetch categories from API (admin manages these)
  const fetchCategories = async () => {
    try {
      const response = await fetchDataFromApi("/api/categories");
      if (response?.error !== true) {
        setCategories(response?.data || []);
      }
      return response;
    } catch (err) {
      console.error("Error fetching categories:", err);
      return { error: true, data: [] };
    }
  };

  // Fetch featured products
  const fetchFeaturedProducts = async () => {
    try {
      const response = await fetchDataFromApi(
        "/api/products?featured=true&excludeExclusive=true",
      );
      if (response?.error !== true) {
        setFeaturedProducts(sanitizePublicProducts(response?.data || []));
      }
      return response;
    } catch (err) {
      console.error("Error fetching featured products:", err);
      return { error: true, data: [] };
    }
  };

  // Fetch home slides from API (admin manages these)
  const fetchHomeSlides = async () => {
    try {
      const response = await fetchDataFromApi("/api/home-slides");
      if (response?.error !== true) {
        setHomeSlides(response?.data || []);
      }
      return response;
    } catch (err) {
      console.error("Error fetching home slides:", err);
      return { error: true, data: [] };
    }
  };

  // Fetch banners from API (admin manages these)
  const fetchBanners = async () => {
    try {
      const response = await fetchDataFromApi("/api/banners");
      if (response?.error !== true) {
        setBanners(response?.data || []);
      }
      return response;
    } catch (err) {
      console.error("Error fetching banners:", err);
      return { error: true, data: [] };
    }
  };

  // Fetch blogs from API (admin manages these)
  const fetchBlogs = async () => {
    try {
      const response = await fetchDataFromApi("/api/blogs");
      if (response?.error !== true) {
        setBlogs(response?.data || []);
      }
      return response;
    } catch (err) {
      console.error("Error fetching blogs:", err);
      return { error: true, data: [] };
    }
  };

  // Fetch products by category
  const fetchProductsByCategory = async (categoryId) => {
    try {
      const response = await fetchDataFromApi(
        `/api/products?category=${categoryId}&excludeExclusive=true`,
      );
      return sanitizePublicProducts(response?.data || []);
    } catch (err) {
      console.error("Error fetching products by category:", err);
      return [];
    }
  };

  // Search products
  const searchProducts = async (query) => {
    try {
      const response = await fetchDataFromApi(
        `/api/products?search=${encodeURIComponent(query)}&excludeExclusive=true`,
      );
      return sanitizePublicProducts(response?.data || []);
    } catch (err) {
      console.error("Error searching products:", err);
      return [];
    }
  };

  // Initialize data on mount
  useEffect(() => {
    const initializeData = async () => {
      setLoading(true);
      await Promise.all([
        fetchProducts(),
        fetchCategories(),
        fetchFeaturedProducts(),
        fetchHomeSlides(),
        fetchBanners(),
        fetchBlogs(),
      ]);
      setLoading(false);
    };

    initializeData();
  }, []);

  const value = {
    // State
    products,
    categories,
    featuredProducts,
    homeSlides,
    banners,
    blogs,
    loading,
    error,

    // Actions
    fetchProducts,
    fetchProductById,
    fetchCategories,
    fetchFeaturedProducts,
    fetchHomeSlides,
    fetchBanners,
    fetchBlogs,
    fetchProductsByCategory,
    searchProducts,

    // Setters (for local updates if needed)
    setProducts,
    setCategories,
  };

  return (
    <ProductContext.Provider value={value}>{children}</ProductContext.Provider>
  );
};

// Custom hook to use product context
export const useProducts = () => {
  const context = useContext(ProductContext);
  if (!context) {
    throw new Error("useProducts must be used within a ProductProvider");
  }
  return context;
};

export default ProductContext;
