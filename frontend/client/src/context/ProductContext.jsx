"use client";

import {
  fetchDataFromApi,
  PUBLIC_SECTION_REQUEST_TIMEOUT_MS,
} from "@/utils/api";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

/**
 * Product Context
 *
 * Keeps product-related lookups available to the client, but avoids
 * preloading large datasets on every route. Consumers fetch what they need.
 */

const ProductContext = createContext();

const resolveBlogApiBaseUrl = () => {
  const configuredBase = String(
    process.env.NEXT_PUBLIC_APP_API_URL || process.env.NEXT_PUBLIC_API_URL || "",
  )
    .trim()
    .replace(/^['"]|['"]$/g, "")
    .replace(/\/+$/, "");

  if (configuredBase) {
    return configuredBase;
  }

  if (typeof window !== "undefined") {
    return String(window.location.origin || "").replace(/\/+$/, "");
  }

  return "http://127.0.0.1:8000";
};

export const ProductProvider = ({ children }) => {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [featuredProducts, setFeaturedProducts] = useState([]);
  const [homeSlides, setHomeSlides] = useState([]);
  const [banners, setBanners] = useState([]);
  const [blogs, setBlogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchProducts = useCallback(async (params = {}) => {
    try {
      setLoading(true);
      const queryString = new URLSearchParams(params).toString();
      const response = await fetchDataFromApi(`/api/products?${queryString}`);
      if (response?.error !== true) {
        setProducts(response?.data || []);
      }
      return response;
    } catch (err) {
      console.error("Error fetching products:", err);
      setError(err.message);
      return { error: true, data: [] };
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchProductById = useCallback(async (id) => {
    try {
      const response = await fetchDataFromApi(`/api/products/${id}`);
      return response?.data || null;
    } catch (err) {
      console.error("Error fetching product:", err);
      return null;
    }
  }, []);

  const fetchCategories = useCallback(async () => {
    try {
      const response = await fetchDataFromApi("/api/categories", {
        timeoutMs: PUBLIC_SECTION_REQUEST_TIMEOUT_MS,
      });
      if (response?.error !== true) {
        setCategories(response?.data || []);
      }
      return response;
    } catch (err) {
      console.error("Error fetching categories:", err);
      return { error: true, data: [] };
    }
  }, []);

  const fetchFeaturedProducts = useCallback(async () => {
    try {
      const response = await fetchDataFromApi(
        "/api/products?bestSeller=true&sortBy=createdAt&order=desc",
        {
          timeoutMs: PUBLIC_SECTION_REQUEST_TIMEOUT_MS,
        },
      );
      if (response?.error !== true) {
        setFeaturedProducts(response?.data || []);
      }
      return response;
    } catch (err) {
      console.error("Error fetching highlighted products:", err);
      return { error: true, data: [] };
    }
  }, []);

  const fetchHomeSlides = useCallback(async () => {
    try {
      const response = await fetchDataFromApi("/api/home-slides", {
        timeoutMs: PUBLIC_SECTION_REQUEST_TIMEOUT_MS,
      });
      if (response?.error !== true) {
        setHomeSlides(response?.data || []);
      }
      return response;
    } catch (err) {
      console.error("Error fetching home slides:", err);
      return { error: true, data: [] };
    }
  }, []);

  const fetchBanners = useCallback(async () => {
    try {
      const response = await fetchDataFromApi("/api/banners", {
        timeoutMs: PUBLIC_SECTION_REQUEST_TIMEOUT_MS,
      });
      if (response?.error !== true) {
        setBanners(response?.data || []);
      }
      return response;
    } catch (err) {
      console.error("Error fetching banners:", err);
      return { error: true, data: [] };
    }
  }, []);

  const fetchBlogs = useCallback(async () => {
    try {
      const response = await fetch(
        `${resolveBlogApiBaseUrl()}/api/blogs`,
        {
          credentials: "include",
        },
      );
      const data = await response.json();
      if (response.ok && data?.error !== true) {
        setBlogs(Array.isArray(data?.data) ? data.data : []);
        return data;
      }

      return data;
    } catch (err) {
      console.error("Error fetching blogs:", err);
      return { error: true, data: [] };
    }
  }, []);

  const fetchProductsByCategory = useCallback(async (categoryId) => {
    try {
      const response = await fetchDataFromApi(
        `/api/products?category=${categoryId}`,
      );
      return response?.data || [];
    } catch (err) {
      console.error("Error fetching products by category:", err);
      return [];
    }
  }, []);

  const searchProducts = useCallback(async (query) => {
    try {
      const response = await fetchDataFromApi(
        `/api/products?search=${encodeURIComponent(query)}`,
      );
      return response?.data || [];
    } catch (err) {
      console.error("Error searching products:", err);
      return [];
    }
  }, []);

  const value = useMemo(
    () => ({
      products,
      categories,
      featuredProducts,
      homeSlides,
      banners,
      blogs,
      loading,
      error,
      fetchProducts,
      fetchProductById,
      fetchCategories,
      fetchFeaturedProducts,
      fetchHomeSlides,
      fetchBanners,
      fetchBlogs,
      fetchProductsByCategory,
      searchProducts,
      setProducts,
      setCategories,
    }),
    [
      products,
      categories,
      featuredProducts,
      homeSlides,
      banners,
      blogs,
      loading,
      error,
      fetchProducts,
      fetchProductById,
      fetchCategories,
      fetchFeaturedProducts,
      fetchHomeSlides,
      fetchBanners,
      fetchBlogs,
      fetchProductsByCategory,
      searchProducts,
    ],
  );

  return (
    <ProductContext.Provider value={value}>{children}</ProductContext.Provider>
  );
};

export const useProducts = () => {
  const context = useContext(ProductContext);
  if (!context) {
    throw new Error("useProducts must be used within a ProductProvider");
  }
  return context;
};

export default ProductContext;
