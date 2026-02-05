"use client";

import ProductItem from "@/components/ProductItem";
import { fetchDataFromApi } from "@/utils/api";
import { CircularProgress, Pagination } from "@mui/material";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";

// Inner component using useSearchParams - needs Suspense wrapper
const ProductPageContent = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [sortBy, setSortBy] = useState("Name, A to Z");
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [priceRange, setPriceRange] = useState([0, 3000]);
  const [loading, setLoading] = useState(true);
  const [totalProducts, setTotalProducts] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Helper to update URL without page reload
  const updateURL = useCallback(
    (updates) => {
      const params = new URLSearchParams(searchParams.toString());
      Object.entries(updates).forEach(([key, value]) => {
        if (value === null || value === undefined || value === "") {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      });
      router.push(`/products?${params.toString()}`, { scroll: false });
    },
    [searchParams, router],
  );

  // Fetch categories from API
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await fetchDataFromApi("/api/categories");
        if (response?.error !== true) {
          setCategories(response?.data || response?.categories || []);
        }
      } catch (error) {
        setCategories([]);
      }
    };
    fetchCategories();
  }, []);

  // Sync state with URL params
  useEffect(() => {
    const categoryParam = searchParams.get("category") || "";
    const minPrice = searchParams.get("minPrice");
    const maxPrice = searchParams.get("maxPrice");

    setSelectedCategory(categoryParam);
    if (minPrice && maxPrice) {
      setPriceRange([parseInt(minPrice), parseInt(maxPrice)]);
    } else {
      setPriceRange([0, 3000]);
    }
  }, [searchParams]);

  // Fetch products from API (admin-managed products)
  const fetchProducts = async () => {
    try {
      setLoading(true);

      // Build query params
      const params = new URLSearchParams();
      params.append("page", currentPage);
      params.append("limit", 15);

      // Sort options
      if (sortBy === "Name, A to Z") {
        params.append("sortBy", "name");
        params.append("order", "asc");
      } else if (sortBy === "Name, Z to A") {
        params.append("sortBy", "name");
        params.append("order", "desc");
      } else if (sortBy === "Price, Low to High") {
        params.append("sortBy", "price");
        params.append("order", "asc");
      } else if (sortBy === "Price, High to Low") {
        params.append("sortBy", "price");
        params.append("order", "desc");
      }

      // Search query from URL
      const search = searchParams.get("search");
      if (search) {
        params.append("search", search);
      }

      // Category filter from URL
      const category = searchParams.get("category");
      if (category) {
        params.append("category", category);
      }

      // Price filter from URL
      const minPrice = searchParams.get("minPrice");
      const maxPrice = searchParams.get("maxPrice");
      if (minPrice) params.append("minPrice", minPrice);
      if (maxPrice) params.append("maxPrice", maxPrice);

      const response = await fetchDataFromApi(
        `/api/products?${params.toString()}`,
      );

      if (response?.error !== true) {
        setProducts(response?.data || response?.products || []);
        setTotalProducts(
          response?.totalProducts ||
            response?.total ||
            response?.data?.length ||
            0,
        );
        setTotalPages(
          response?.totalPages ||
            Math.ceil((response?.totalProducts || 0) / 15) ||
            1,
        );
      }
    } catch (error) {
      console.error("Error fetching products:", error);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  // Fetch products when page, sort, or search params change
  useEffect(() => {
    fetchProducts();
  }, [currentPage, sortBy, searchParams]);

  const handlePageChange = (event, page) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Clear all filters
  const clearAllFilters = () => {
    router.push("/products", { scroll: false });
  };

  // Check if any filters are active
  const hasActiveFilters =
    selectedCategory ||
    priceRange[0] !== 0 ||
    priceRange[1] !== 3000 ||
    searchParams.get("search");

  return (
    <section className="py-4 sm:py-6 bg-gradient-to-b from-[#fffbf5] to-white min-h-screen">
      <div className="container mx-auto px-3 sm:px-4">
        {/* Page Header */}
        <div className="mb-4 sm:mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
            {searchParams.get("search")
              ? `Search Results`
              : selectedCategory
                ? categories.find(
                    (cat) => (cat.slug || cat._id) === selectedCategory,
                  )?.name || "Products"
                : "All Products"}
          </h1>
          {searchParams.get("search") && (
            <p className="text-gray-600">
              Showing results for{" "}
              <span className="font-semibold text-[#059669]">
                "{searchParams.get("search")}"
              </span>
            </p>
          )}
        </div>

        {/* Filter Bar */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 sm:p-4 mb-4 sm:mb-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4">
            {/* Left Side - Product Count & Active Filters */}
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-sm sm:text-base font-medium text-gray-700 whitespace-nowrap">
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-[#059669]/30 border-t-[#059669] rounded-full animate-spin"></span>
                    Loading...
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    <span className="font-bold text-[#059669]">
                      {totalProducts}
                    </span>
                    <span>Products</span>
                  </span>
                )}
              </span>

              {/* Active Filter Tags */}
              {hasActiveFilters && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-gray-400 text-sm hidden sm:block">
                    |
                  </span>
                  {selectedCategory && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#059669]/10 text-[#059669] text-xs font-medium rounded-full">
                      {
                        categories.find(
                          (cat) => (cat.slug || cat._id) === selectedCategory,
                        )?.name
                      }
                      <button
                        onClick={() => updateURL({ category: null })}
                        className="ml-0.5 hover:bg-[#059669]/20 rounded-full p-0.5"
                      >
                        ×
                      </button>
                    </span>
                  )}
                  {(priceRange[0] !== 0 || priceRange[1] !== 3000) && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-600 text-xs font-medium rounded-full">
                      ₹{priceRange[0]} - ₹{priceRange[1]}
                      <button
                        onClick={() =>
                          updateURL({ minPrice: null, maxPrice: null })
                        }
                        className="ml-0.5 hover:bg-blue-100 rounded-full p-0.5"
                      >
                        ×
                      </button>
                    </span>
                  )}
                  <button
                    onClick={clearAllFilters}
                    className="text-xs text-gray-500 hover:text-red-500 underline transition-colors"
                  >
                    Clear all
                  </button>
                </div>
              )}
            </div>

            {/* Right Side - Filters */}
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
              {/* Category Filter */}
              <div className="relative">
                <select
                  value={selectedCategory}
                  onChange={(e) => {
                    const newCategory = e.target.value;
                    setCurrentPage(1);
                    updateURL({ category: newCategory || null });
                  }}
                  className="appearance-none bg-white border border-gray-200 rounded-lg px-3 py-2 pr-8 text-sm font-medium text-gray-700 hover:border-[#059669]/50 focus:outline-none focus:ring-2 focus:ring-[#059669]/20 focus:border-[#059669] transition-all cursor-pointer min-w-[140px]"
                >
                  <option value="">All Categories</option>
                  {categories.map((cat) => (
                    <option
                      key={cat._id || cat.id || cat.slug}
                      value={cat.slug || cat._id || cat.id}
                    >
                      {cat.name}
                    </option>
                  ))}
                </select>
                <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
                  <svg
                    className="w-4 h-4 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </div>
              </div>

              {/* Price Range Filter */}
              <div className="relative">
                <select
                  value={`${priceRange[0]}-${priceRange[1]}`}
                  onChange={(e) => {
                    const [min, max] = e.target.value.split("-").map(Number);
                    setCurrentPage(1);
                    if (min === 0 && max === 3000) {
                      updateURL({ minPrice: null, maxPrice: null });
                    } else {
                      updateURL({ minPrice: min, maxPrice: max });
                    }
                  }}
                  className="appearance-none bg-white border border-gray-200 rounded-lg px-3 py-2 pr-8 text-sm font-medium text-gray-700 hover:border-[#059669]/50 focus:outline-none focus:ring-2 focus:ring-[#059669]/20 focus:border-[#059669] transition-all cursor-pointer min-w-[120px]"
                >
                  <option value="0-3000">All Prices</option>
                  <option value="0-499">Under ₹500</option>
                  <option value="500-999">₹500 - ₹999</option>
                  <option value="1000-1999">₹1000 - ₹1999</option>
                  <option value="2000-3000">₹2000+</option>
                </select>
                <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
                  <svg
                    className="w-4 h-4 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </div>
              </div>

              {/* Divider */}
              <div className="hidden sm:block w-px h-6 bg-gray-200"></div>

              {/* Sort Dropdown */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500 hidden sm:block">
                  Sort:
                </span>
                <div className="relative">
                  <select
                    value={sortBy}
                    onChange={(e) => {
                      setSortBy(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="appearance-none bg-white border border-gray-200 rounded-lg px-3 py-2 pr-8 text-sm font-medium text-gray-700 hover:border-[#059669]/50 focus:outline-none focus:ring-2 focus:ring-[#059669]/20 focus:border-[#059669] transition-all cursor-pointer min-w-[140px]"
                  >
                    <option value="Name, A to Z">Name, A to Z</option>
                    <option value="Name, Z to A">Name, Z to A</option>
                    <option value="Price, Low to High">
                      Price: Low to High
                    </option>
                    <option value="Price, High to Low">
                      Price: High to Low
                    </option>
                  </select>
                  <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
                    <svg
                      className="w-4 h-4 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Products Container */}
        <div className="rightContent flex-1 min-w-0 relative z-0">
          {/* Loading State */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <CircularProgress style={{ color: "#059669" }} />
            </div>
          ) : products.length > 0 ? (
            <>
              {/* Products Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-4 py-3 sm:py-5">
                {products.map((product) => (
                  <ProductItem
                    key={product._id || product.id}
                    id={product._id || product.id}
                    name={product.name || product.title}
                    brand={product.brand || "Buy One Gram"}
                    price={product.price || product.salePrice}
                    originalPrice={
                      product.originalPrice || product.regularPrice
                    }
                    discount={
                      product.discount ||
                      (product.originalPrice && product.price
                        ? Math.round(
                            ((product.originalPrice - product.price) /
                              product.originalPrice) *
                              100,
                          )
                        : 0)
                    }
                    rating={product.rating || 4.5}
                    image={
                      product.image || product.images?.[0] || "/product_1.png"
                    }
                    product={product}
                  />
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center mt-5">
                  <Pagination
                    count={totalPages}
                    page={currentPage}
                    onChange={handlePageChange}
                    showFirstButton
                    showLastButton
                    sx={{
                      "& .Mui-selected": {
                        backgroundColor: "#059669 !important",
                        color: "white",
                      },
                    }}
                  />
                </div>
              )}
            </>
          ) : (
            /* Empty State */
            <div className="flex flex-col items-center justify-center py-20 text-gray-500">
              <svg
                className="w-24 h-24 mb-4 text-gray-300"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                />
              </svg>
              <h3 className="text-xl font-semibold mb-2">No Products Found</h3>
              <p className="text-sm">
                {searchParams.get("search")
                  ? `No results for "${searchParams.get("search")}". Try a different search.`
                  : "Check back later for new products!"}
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

// Loading skeleton for products page
const ProductPageLoading = () => (
  <section className="py-5 bg-white min-h-screen">
    <div className="container mx-auto px-4 flex gap-4">
      {/* Sidebar skeleton removed: no sidebar in new UI */}
      <div className="rightContent flex-1 min-w-0">
        <div className="flex items-center justify-center py-20">
          <CircularProgress style={{ color: "#059669" }} />
        </div>
      </div>
    </div>
  </section>
);

// Main export with Suspense for useSearchParams
const ProductPage = () => {
  return (
    <Suspense fallback={<ProductPageLoading />}>
      <ProductPageContent />
    </Suspense>
  );
};

export default ProductPage;
