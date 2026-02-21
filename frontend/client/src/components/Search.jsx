"use client";

import { fetchDataFromApi } from "@/utils/api";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { IoSearchOutline } from "react-icons/io5";

const Search = ({
  placeholder = "Search for products...",
  width = "100%",
  onSearch = null,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const router = useRouter();
  const searchRef = useRef(null);
  const debounceTimeout = useRef(null);

  // Debounced search function
  const debouncedSearch = useCallback(async (term) => {
    if (!term || term.length < 1) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }

    setIsLoading(true);
    try {
      console.log("[Search] Searching for:", term);
      const response = await fetchDataFromApi(
        `/api/products?search=${encodeURIComponent(term)}&limit=8`,
      );
      console.log("[Search] Response:", response);
      if (response?.error !== true && response?.data) {
        const safeSuggestions = Array.isArray(response.data)
          ? response.data.filter((product) => product?.isExclusive !== true)
          : [];
        console.log("[Search] Found", safeSuggestions.length, "results");
        setSuggestions(safeSuggestions);
        setShowDropdown(true);
      } else {
        console.log("[Search] No results or error:", response?.message);
        setSuggestions([]);
      }
    } catch (error) {
      console.error("[Search] Error:", error);
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Handle input change with debounce
  const handleInputChange = (e) => {
    const value = e.target.value;
    setSearchTerm(value);

    // Clear existing timeout
    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
    }

    // Set new timeout for debounced search (300ms)
    debounceTimeout.current = setTimeout(() => {
      debouncedSearch(value);
    }, 300);
  };

  // Handle form submit
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!searchTerm.trim()) return;

    setShowDropdown(false);
    if (onSearch) {
      onSearch(searchTerm);
    } else {
      router.push(`/products?search=${encodeURIComponent(searchTerm)}`);
    }
  };

  // Handle suggestion click
  const handleSuggestionClick = (product) => {
    setSearchTerm("");
    setSuggestions([]);
    setShowDropdown(false);
    router.push(`/product/${product._id || product.id}`);
  };

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeout.current) {
        clearTimeout(debounceTimeout.current);
      }
    };
  }, []);

  // Dynamic Placeholder Logic
  const placeholders = [
    "Search for 'Crunchy'...",
    "Try 'Dark Chocolate'...",
    "Find your favorite flavor...",
    "Search for 'High Protein'...",
    "Discover 'Sugar Free'...",
    "Search for anything...",
  ];
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [fadeKey, setFadeKey] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderIndex((prev) => (prev + 1) % placeholders.length);
      setFadeKey((prev) => prev + 1);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      ref={searchRef}
      className="relative w-full h-full"
      style={{ maxWidth: width }}
    >
      <form
        onSubmit={handleSubmit}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className="relative w-full h-full flex items-center group/search"
      >
        {/* Input Field */}
        <div className="relative w-full h-full">
          <input
            type="text"
            value={searchTerm}
            onChange={handleInputChange}
            onFocus={() => {
              setIsFocused(true);
              if (suggestions.length > 0) setShowDropdown(true);
            }}
            onBlur={() => setIsFocused(false)}
            className="w-full h-full py-3 pl-6 pr-14 text-base font-medium rounded-full outline-none bg-transparent border-none transition-all z-10 relative bg-transparent"
            style={{
              fontFamily: "'Inter', system-ui, sans-serif",
            }}
          />

          {/* Dynamic Placeholder (Behind input) */}
          {!searchTerm && (
            <div
              key={fadeKey}
              className="absolute top-0 left-0 w-full h-full flex items-center pl-6 pointer-events-none animate-in fade-in slide-in-from-bottom-2 duration-500"
            >
              <span className="text-gray-400 text-base font-medium truncate">
                {placeholders[placeholderIndex]}
              </span>
            </div>
          )}
        </div>

        {/* Loading/Submit Button - Right side */}
        <button
          type="submit"
          className={`absolute right-1.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300 ${searchTerm || isFocused
            ? "bg-[var(--flavor-color)] text-white shadow-lg shadow-[var(--flavor-color)]/30 scale-100"
            : "bg-gray-100 text-gray-400 scale-90"
            }`}
          disabled={isLoading}
        >
          {isLoading ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <IoSearchOutline size={18} strokeWidth={2.5} />
          )}
        </button>
      </form>

      {/* Search Suggestions Dropdown */}
      {showDropdown && (
        <div className="absolute top-[calc(100%+8px)] left-0 right-0 bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/40 z-50 max-h-[400px] overflow-y-auto animate-in fade-in slide-in-from-top-2 p-2">
          {isLoading ? (
            <div className="p-8 text-center text-gray-500">
              <div
                className="w-6 h-6 border-2 border-gray-200 border-t-[var(--flavor-color)] rounded-full animate-spin mx-auto mb-3"
              />
              <span className="text-sm font-medium">Searching...</span>
            </div>
          ) : suggestions.length > 0 ? (
            <>
              {suggestions.map((product) => (
                <button
                  key={product._id || product.id}
                  onClick={() => handleSuggestionClick(product)}
                  className="w-full flex items-center gap-4 p-3 rounded-xl hover:bg-[var(--flavor-glass)] transition-all duration-200 group text-left"
                >
                  <div className="relative w-14 h-14 rounded-lg overflow-hidden bg-gray-50 shrink-0">
                    <img
                      src={
                        product.thumbnail ||
                        product.images?.[0] ||
                        "/product_placeholder.png"
                      }
                      alt={product.name}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-800 text-sm truncate group-hover:text-[var(--flavor-color)] transition-colors">
                      {product.name}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[var(--flavor-color)] font-bold text-sm">
                        ₹{product.price}
                      </span>
                      {product.originalPrice > product.price && (
                        <span className="text-gray-400 line-through text-xs decoration-gray-300">
                          ₹{product.originalPrice}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all duration-300">
                    <IoSearchOutline className="text-[var(--flavor-color)]" size={16} />
                  </div>
                </button>
              ))}
              <div className="mt-2 pt-2 border-t border-gray-100">
                <button
                  onClick={handleSubmit}
                  className="w-full py-3 text-center text-[var(--flavor-color)] hover:bg-[var(--flavor-glass)] font-semibold text-sm rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  View all results for "{searchTerm}"
                  <IoSearchOutline size={14} />
                </button>
              </div>
            </>
          ) : searchTerm.length >= 1 ? (
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <IoSearchOutline className="w-7 h-7 text-gray-300" />
              </div>
              <p className="text-gray-800 font-semibold mb-1">No products found</p>
              <p className="text-gray-500 text-sm">
                Try searching for something else
              </p>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};

export default Search;
