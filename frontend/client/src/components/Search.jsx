"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { IoSearchOutline } from "react-icons/io5";

const Search = ({
  placeholder = "Search for products...",
  width = "100%",
  onSearch = null,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const router = useRouter();

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!searchTerm.trim()) return;

    if (onSearch) {
      onSearch(searchTerm);
    } else {
      // Default: Navigate to products page with search query
      router.push(`/products?search=${encodeURIComponent(searchTerm)}`);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="relative w-full"
      style={{ maxWidth: width }}
    >
      {/* Search Icon */}
      <IoSearchOutline
        size={18}
        className={`absolute left-4 top-1/2 -translate-y-1/2 z-10 pointer-events-none transition-colors duration-300 ${
          isFocused ? "text-[#c1591c]" : "text-gray-400"
        }`}
      />

      {/* Input Field */}
      <input
        type="text"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        placeholder={placeholder}
        className={`w-full py-3 pl-12 pr-12 text-sm font-medium rounded-full outline-none transition-all duration-300 ${
          isFocused
            ? "bg-white border border-[#c1591c]/30 shadow-[0_4px_12px_rgba(0,0,0,0.05)]"
            : "bg-gray-100 border border-transparent hover:bg-gray-50"
        }`}
        style={{
          fontFamily: "'Inter', system-ui, sans-serif",
        }}
      />

      {/* Submit Button */}
      <button
        type="submit"
        className={`absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${
          searchTerm
            ? "bg-[#c1591c] text-white hover:bg-[#a04815]"
            : "bg-transparent text-gray-400 hover:bg-gray-200"
        }`}
      >
        <IoSearchOutline size={16} />
      </button>
    </form>
  );
};

export default Search;
