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
        console.log("[Search] Found", response.data.length, "results");
        setSuggestions(response.data);
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
        className="relative w-full h-full flex items-center"
      >
        {/* Input Field */}
        <input
          type="text"
          value={searchTerm}
          onChange={handleInputChange}
          onFocus={() => {
            setIsFocused(true);
            if (suggestions.length > 0) setShowDropdown(true);
          }}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          className="w-full h-full py-2 pl-4 pr-9 text-sm font-medium rounded-full outline-none bg-transparent border-none placeholder:text-gray-400"
          style={{
            fontFamily: "'Inter', system-ui, sans-serif",
          }}
        />

        {/* Loading/Submit Button - Right side */}
        <button
          type="submit"
          className={`absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center transition-all duration-300 ${searchTerm
            ? "bg-primary text-white hover:brightness-90"
            : "bg-transparent text-gray-400"
            }`}
          disabled={isLoading}
        >
          {isLoading ? (
            <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <IoSearchOutline size={14} />
          )}
        </button>
      </form>

      {/* Search Suggestions Dropdown */}
      {showDropdown && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-lg border border-gray-100 z-50 max-h-96 overflow-y-auto">
          {isLoading ? (
            <div className="p-4 text-center text-gray-500">
              <div className="w-5 h-5 border-2 border-gray-300 border-t-primary rounded-full animate-spin mx-auto mb-2" />
              Searching...
            </div>
          ) : suggestions.length > 0 ? (
            <>
              {suggestions.map((product) => (
                <button
                  key={product._id || product.id}
                  onClick={() => handleSuggestionClick(product)}
                  className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0 text-left"
                >
                  <img
                    src={
                      product.thumbnail ||
                      product.images?.[0] ||
                      "/product_placeholder.png"
                    }
                    alt={product.name}
                    className="w-12 h-12 object-cover rounded-lg"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-800 text-sm truncate">
                      {product.name}
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="text-primary font-semibold text-sm">
                        ₹{product.price}
                      </span>
                      {product.originalPrice > product.price && (
                        <span className="text-gray-400 line-through text-xs">
                          ₹{product.originalPrice}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
              <button
                onClick={handleSubmit}
                className="w-full p-3 text-center text-primary hover:bg-[var(--flavor-glass)] font-medium text-sm transition-colors"
              >
                View all results for "{searchTerm}"
              </button>
            </>
          ) : searchTerm.length >= 1 ? (
            <div className="p-6 text-center">
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <IoSearchOutline className="w-6 h-6 text-gray-400" />
              </div>
              <p className="text-gray-600 font-medium">No products found</p>
              <p className="text-gray-400 text-sm mt-1">
                Try a different search term
              </p>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};

export default Search;
