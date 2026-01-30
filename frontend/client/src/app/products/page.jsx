"use client";

import ProductItem from "@/components/ProductItem";
// import Sidebar from "@/components/Sidebar";
import { fetchDataFromApi } from "@/utils/api";
import {
  Button,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Pagination,
  Select,
} from "@mui/material";
import Menu from "@mui/material/Menu";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

// Inner component using useSearchParams - needs Suspense wrapper
const ProductPageContent = () => {
  const [sortBy, setSortBy] = useState("Name, A to Z");
  const [anchorEl, setAnchorEl] = useState(null);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [priceRange, setPriceRange] = useState([0, 3000]);
  const [loading, setLoading] = useState(true);
  const [totalProducts, setTotalProducts] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const searchParams = useSearchParams();

  const open = Boolean(anchorEl);

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
    // Set selected category from URL
    const categoryParam = searchParams.get("category");
    if (categoryParam) setSelectedCategory(categoryParam);
    // Set price range from URL
    const minPrice = searchParams.get("minPrice");
    const maxPrice = searchParams.get("maxPrice");
    if (minPrice && maxPrice) {
      setPriceRange([parseInt(minPrice), parseInt(maxPrice)]);
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

  const handleClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = (value) => {
    if (value) {
      setSortBy(value);
      setCurrentPage(1); // Reset to first page on sort change
    }
    setAnchorEl(null);
  };

  const handlePageChange = (event, page) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <section className="py-3 sm:py-5 bg-white min-h-screen">
      <div className="container mx-auto px-3 sm:px-4 flex gap-4">
        <div className="rightContent flex-1 min-w-0 relative z-0">
          <div className="top strip w-full bg-[#f1f1f1] p-2 rounded-md min-h-[48px] flex flex-col sm:flex-row items-start sm:items-center justify-between px-3 sm:px-4 relative z-0 gap-2 sm:gap-0">
            <span className="text-[13px] sm:text-[15px] text-gray-700 font-semibold">
              {loading ? "Loading..." : `There are ${totalProducts} Products.`}
              {searchParams.get("search") && (
                <span className="ml-2 text-[#c1591c]">
                  for "{searchParams.get("search")}"
                </span>
              )}
            </span>

            <div className="flex items-center gap-2 sm:gap-4 flex-wrap w-full sm:w-auto">
              {/* Category Dropdown Filter */}
              <FormControl
                size="small"
                sx={{
                  minWidth: { xs: 120, sm: 180 },
                  background: "white",
                  mr: { xs: 0, sm: 1 },
                }}
              >
                <InputLabel id="category-select-label" shrink>
                  Category
                </InputLabel>
                <Select
                  labelId="category-select-label"
                  id="category-select"
                  value={selectedCategory}
                  label="Category"
                  onChange={(e) => {
                    setSelectedCategory(e.target.value);
                    const params = new URLSearchParams(searchParams.toString());
                    if (e.target.value) {
                      params.set("category", e.target.value);
                    } else {
                      params.delete("category");
                    }
                    window.location.href = `/products?${params.toString()}`;
                  }}
                  displayEmpty
                  notched
                  renderValue={(selected) =>
                    selected
                      ? categories.find(
                          (cat) => (cat.slug || cat._id || cat.id) === selected,
                        )?.name || "Category"
                      : "All Categories"
                  }
                >
                  <MenuItem value="">All Categories</MenuItem>
                  {categories.map((cat) => (
                    <MenuItem
                      key={cat._id || cat.id || cat.slug}
                      value={cat.slug || cat._id || cat.id}
                    >
                      {cat.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              {/* Price Range Dropdown Filter */}
              <FormControl
                size="small"
                sx={{
                  minWidth: { xs: 100, sm: 150 },
                  background: "white",
                  mr: { xs: 0, sm: 1 },
                }}
              >
                <InputLabel id="price-range-select-label">
                  Price Range
                </InputLabel>
                <Select
                  labelId="price-range-select-label"
                  id="price-range-select"
                  value={`${priceRange[0]}-${priceRange[1]}`}
                  label="Price Range"
                  onChange={(e) => {
                    const [min, max] = e.target.value.split("-").map(Number);
                    setPriceRange([min, max]);
                    const params = new URLSearchParams(searchParams.toString());
                    params.set("minPrice", min);
                    params.set("maxPrice", max);
                    window.location.href = `/products?${params.toString()}`;
                  }}
                >
                  <MenuItem value="0-3000">All Prices</MenuItem>
                  <MenuItem value="0-499">Under ₹500</MenuItem>
                  <MenuItem value="500-999">₹500 - ₹999</MenuItem>
                  <MenuItem value="1000-1999">₹1000 - ₹1999</MenuItem>
                  <MenuItem value="2000-3000">₹2000 - ₹3000</MenuItem>
                </Select>
              </FormControl>
              {/* Sort Dropdown */}
              <span
                className="text-[15px] text-gray-700 font-semibold hidden sm:block"
                style={{ marginRight: 8 }}
              >
                Sort By
              </span>
              <div className="relative">
                <Button
                  sx={{
                    backgroundColor: "white",
                    color: "#333",
                    textTransform: "capitalize",
                    fontSize: "14px",
                    padding: "4px 12px",
                    minWidth: 120,
                    "&:hover": {
                      backgroundColor: "#f5f5f5",
                    },
                  }}
                  onClick={handleClick}
                >
                  {sortBy}
                </Button>
                <Menu
                  anchorEl={anchorEl}
                  open={open}
                  onClose={() => handleClose()}
                >
                  <MenuItem onClick={() => handleClose("Name, A to Z")}>
                    Name, A to Z
                  </MenuItem>
                  <MenuItem onClick={() => handleClose("Name, Z to A")}>
                    Name, Z to A
                  </MenuItem>
                  <MenuItem onClick={() => handleClose("Price, Low to High")}>
                    Price, Low to High
                  </MenuItem>
                  <MenuItem onClick={() => handleClose("Price, High to Low")}>
                    Price, High to Low
                  </MenuItem>
                </Menu>
              </div>
            </div>
          </div>

          {/* Loading State */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <CircularProgress style={{ color: "#c1591c" }} />
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
                    inStock={product.inStock !== false && product.stock !== 0}
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
                        backgroundColor: "#c1591c !important",
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
          <CircularProgress style={{ color: "#c1591c" }} />
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
