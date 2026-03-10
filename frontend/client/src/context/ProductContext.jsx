"use client";

import { fetchDataFromApi } from "@/utils/api";
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
      const response = await fetchDataFromApi("/api/categories");
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
      const response = await fetchDataFromApi("/api/products?featured=true");
      if (response?.error !== true) {
        setFeaturedProducts(response?.data || []);
      }
      return response;
    } catch (err) {
      console.error("Error fetching featured products:", err);
      return { error: true, data: [] };
    }
  }, []);

  const fetchHomeSlides = useCallback(async () => {
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
  }, []);

  const fetchBanners = useCallback(async () => {
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
  }, []);

  const fetchBlogs = useCallback(async () => {
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
