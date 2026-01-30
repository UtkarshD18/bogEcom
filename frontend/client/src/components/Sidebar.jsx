"use client";

import { fetchDataFromApi } from "@/utils/api";
import { Button } from "@mui/material";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import FormGroup from "@mui/material/FormGroup";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Collapse } from "react-collapse";
import { LiaAngleDownSolid, LiaAngleUpSolid } from "react-icons/lia";
import RangeSlider from "react-range-slider-input";
import "react-range-slider-input/dist/style.css";

const label = { inputProps: { "aria-label": "Checkbox demo" } };

/**
 * Sidebar Component
 *
 * Fetches categories from API (admin-managed).
 * Provides filtering by category, price, and rating.
 */
const Sidebar = () => {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [isOpenCatFilter, setIsOpenCatFilter] = useState(true);
  const [price, setPrice] = useState([0, 3000]);
  const [categories, setCategories] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch categories from API (admin manages these in admin panel)
  const fetchCategories = async () => {
    try {
      setLoading(true);
      const response = await fetchDataFromApi("/api/categories");
      if (response?.error !== true) {
        setCategories(response?.data || response?.categories || []);
      }
    } catch (error) {
      console.error("Error fetching categories:", error);
      // Fallback categories if API fails
      setCategories([
        { _id: "1", name: "Fruits & Vegetables" },
        { _id: "2", name: "Bakery & Pastry" },
        { _id: "3", name: "Dairy & Eggs" },
        { _id: "4", name: "Meat & Seafood" },
        { _id: "5", name: "Beverages" },
        { _id: "6", name: "Snacks & Sweets" },
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();

    // Initialize selected categories from URL
    const categoryParam = searchParams.get("category");
    if (categoryParam) {
      setSelectedCategories(categoryParam.split(","));
    }
  }, []);

  // Handle category filter change
  const handleCategoryChange = (categoryId) => {
    let newSelected;
    if (selectedCategories.includes(categoryId)) {
      newSelected = selectedCategories.filter((id) => id !== categoryId);
    } else {
      newSelected = [...selectedCategories, categoryId];
    }
    setSelectedCategories(newSelected);

    // Update URL with filter
    const params = new URLSearchParams(searchParams.toString());
    if (newSelected.length > 0) {
      params.set("category", newSelected.join(","));
    } else {
      params.delete("category");
    }
    router.push(`/products?${params.toString()}`);
  };

  // Handle price filter change (debounced)
  const handlePriceChange = (newPrice) => {
    setPrice(newPrice);
  };

  // Apply price filter on release
  const handlePriceApply = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("minPrice", price[0]);
    params.set("maxPrice", price[1]);
    router.push(`/products?${params.toString()}`);
  };

  return (
    <aside
      className="flex flex-col gap-5 sticky z-10"
      style={{ top: "calc(var(--header-height, 60px) + 20px)" }}
    >
      {/* Category Filter */}
      <div
        className="box rounded-lg p-4 shadow-sm relative z-20"
        style={{ backgroundColor: "var(--flavor-card-bg, #fffbf5)" }}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-[16px] font-[600] text-gray-700 mb-2">
            Shop by Categories
          </h3>

          <Button
            sx={{
              minWidth: "35px",
              width: "35px",
              height: "35px",
              borderRadius: "50%",
              color: "#444",
              "&:hover": {
                backgroundColor: "#f0f0f0",
              },
            }}
            onClick={() => setIsOpenCatFilter(!isOpenCatFilter)}
          >
            {isOpenCatFilter ? (
              <LiaAngleUpSolid size={20} />
            ) : (
              <LiaAngleDownSolid size={20} />
            )}
          </Button>
        </div>

        <Collapse isOpened={isOpenCatFilter}>
          <div className="scroll overflow-auto max-h-[250px]">
            {loading ? (
              <p className="text-sm text-gray-500">Loading categories...</p>
            ) : categories.length > 0 ? (
              <FormGroup>
                {categories.map((category) => (
                  <FormControlLabel
                    key={category._id || category.id}
                    control={
                      <Checkbox
                        checked={selectedCategories.includes(
                          category._id || category.id,
                        )}
                        onChange={() =>
                          handleCategoryChange(category._id || category.id)
                        }
                        sx={{
                          color: "#9ca3af",
                          padding: "8px",
                          "& .MuiSvgIcon-root": {
                            fontSize: "22px",
                            border: "2px solid #d1d5db",
                            borderRadius: "4px",
                            backgroundColor: "#fff",
                          },
                          "&:hover": {
                            backgroundColor: "rgba(193, 89, 28, 0.04)",
                          },
                          "&.Mui-checked": {
                            color: "#c1591c",
                            "& .MuiSvgIcon-root": {
                              border: "2px solid #c1591c",
                              backgroundColor: "#fff",
                            },
                          },
                          "&.Mui-focusVisible": {
                            outline: "2px solid #c1591c",
                            outlineOffset: "2px",
                          },
                        }}
                      />
                    }
                    label={
                      <span
                        style={{
                          color: "#374151",
                          fontSize: "14px",
                          fontWeight: 500,
                        }}
                      >
                        {category.name}
                      </span>
                    }
                    sx={{
                      marginLeft: 0,
                      marginRight: 0,
                      padding: "4px 0",
                      borderRadius: "6px",
                      "&:hover": {
                        backgroundColor: "rgba(193, 89, 28, 0.04)",
                      },
                    }}
                  />
                ))}
              </FormGroup>
            ) : (
              <p className="text-sm text-gray-500">No categories available</p>
            )}
          </div>
        </Collapse>
      </div>

      {/* Price Filter */}
      <div
        className="box rounded-lg p-4 shadow-sm"
        style={{ backgroundColor: "var(--flavor-card-bg, #fffbf5)" }}
      >
        <h3 className="text-[16px] font-[600] text-gray-700 mb-4">
          Filter by Price
        </h3>

        <RangeSlider
          value={price}
          onInput={handlePriceChange}
          onThumbDragEnd={handlePriceApply}
          min={0}
          max={3000}
          step={50}
        />

        <div className="flex justify-between mt-2 text-gray-600">
          <span>₹{price[0]}</span>
          <span>₹{price[1]}</span>
        </div>

        <Button
          variant="outlined"
          size="small"
          onClick={handlePriceApply}
          sx={{
            marginTop: 3,
            width: "100%",
            borderColor: "#c1591c",
            color: "#c1591c",
            "&:hover": {
              borderColor: "#a04a17",
              backgroundColor: "rgba(193, 89, 28, 0.04)",
            },
          }}
        >
          Apply Price Filter
        </Button>
      </div>

      {/* Clear Filters */}
      {(selectedCategories.length > 0 || searchParams.get("minPrice")) && (
        <Button
          variant="text"
          onClick={() => {
            setSelectedCategories([]);
            setPrice([0, 3000]);
            router.push("/products");
          }}
          sx={{
            color: "#c1591c",
            "&:hover": {
              backgroundColor: "rgba(193, 89, 28, 0.04)",
            },
          }}
        >
          Clear All Filters
        </Button>
      )}
    </aside>
  );
};

export default Sidebar;
