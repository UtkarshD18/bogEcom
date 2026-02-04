"use client";

import { useState } from "react";
import { FiMinus, FiPlus } from "react-icons/fi";

/**
 * Quantity Box Component
 *
 * @param {Object} props
 * @param {number} props.min - Minimum quantity (default: 1)
 * @param {number} props.max - Maximum quantity (default: 99)
 * @param {number} props.value - Initial value (default: 1)
 * @param {Function} props.onChange - Callback when quantity changes
 * @param {string} props.size - Size variant: 'sm' | 'md' | 'lg'
 */
const QtyBox = ({
  min = 1,
  max = 99,
  value = 1,
  onChange = () => {},
  size = "md",
  disabled = false,
}) => {
  const [qty, setQty] = useState(value);

  const sizes = {
    sm: "h-8 w-20 text-sm",
    md: "h-10 w-28 text-base",
    lg: "h-12 w-32 text-lg",
  };

  const buttonSizes = {
    sm: "w-6 h-6",
    md: "w-8 h-8",
    lg: "w-10 h-10",
  };

  const handleDecrease = () => {
    if (qty > min && !disabled) {
      const newQty = qty - 1;
      setQty(newQty);
      onChange(newQty);
    }
  };

  const handleIncrease = () => {
    if (qty < max && !disabled) {
      const newQty = qty + 1;
      setQty(newQty);
      onChange(newQty);
    }
  };

  const handleInputChange = (e) => {
    const inputValue = parseInt(e.target.value) || min;
    const clampedValue = Math.max(min, Math.min(max, inputValue));
    setQty(clampedValue);
    onChange(clampedValue);
  };

  return (
    <div
      className={`flex items-center border rounded-lg overflow-hidden ${sizes[size]} ${
        disabled ? "opacity-50 cursor-not-allowed" : ""
      }`}
      style={{
        backgroundColor: "var(--flavor-card-bg, #fffbf5)",
        borderColor:
          "color-mix(in srgb, var(--flavor-color, #a7f3d0) 30%, transparent)",
      }}
    >
      {/* Decrease Button */}
      <button
        type="button"
        onClick={handleDecrease}
        disabled={qty <= min || disabled}
        className={`${buttonSizes[size]} flex items-center justify-center text-gray-600 hover:bg-gray-100 hover:text-[#059669] transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-gray-600`}
      >
        <FiMinus size={size === "sm" ? 12 : size === "md" ? 14 : 16} />
      </button>

      {/* Quantity Input */}
      <input
        type="number"
        value={qty}
        onChange={handleInputChange}
        min={min}
        max={max}
        disabled={disabled}
        className="w-full h-full text-center font-semibold border-x border-gray-200 outline-none bg-transparent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
      />

      {/* Increase Button */}
      <button
        type="button"
        onClick={handleIncrease}
        disabled={qty >= max || disabled}
        className={`${buttonSizes[size]} flex items-center justify-center text-gray-600 hover:bg-gray-100 hover:text-[#059669] transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-gray-600`}
      >
        <FiPlus size={size === "sm" ? 12 : size === "md" ? 14 : 16} />
      </button>
    </div>
  );
};

export default QtyBox;
