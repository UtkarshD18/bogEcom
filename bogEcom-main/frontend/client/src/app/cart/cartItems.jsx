"use client";
import { useCart } from "@/context/CartContext";
import Link from "next/link";
import { HiOutlineFire } from "react-icons/hi";
import { MdDeleteOutline } from "react-icons/md";

const CartItems = ({ item }) => {
  const { updateQuantity, removeFromCart, loading } = useCart();

  // Get product data from item
  const product = item.productData || item.product || {};
  const productId = product._id || item.product;
  const productName = product.name || product.title || "Product";
  const productImage = product.image || product.images?.[0] || "/product_1.png";
  const price = item.price || product.price || 0;
  const quantity = item.quantity || 1;
  const itemTotal = price * quantity;
  const demandStatus = product.demandStatus || item.demandStatus || "NORMAL";

  const handleIncrement = () => {
    if (!loading) {
      updateQuantity(productId, quantity + 1);
    }
  };

  const handleDecrement = () => {
    if (!loading && quantity > 1) {
      updateQuantity(productId, quantity - 1);
    }
  };

  const handleRemove = () => {
    if (!loading) {
      removeFromCart(productId);
    }
  };

  return (
    <div className="p-3 sm:p-5 border-b-[1px] border-[rgba(0,0,0,0.1)] hover:bg-gray-50 transition-colors">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
        <div className="flex items-center gap-3 sm:gap-4 flex-1 w-full">
          <Link href={`/product/${productId}`} className="shrink-0">
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gray-100 rounded-md flex items-center justify-center overflow-hidden">
              <img
                src={productImage}
                alt={productName}
                className="w-full h-full object-contain hover:scale-105 transition-transform"
              />
            </div>
          </Link>
          <div className="flex-1 min-w-0">
            <Link href={`/product/${productId}`}>
              <h3 className="text-[14px] sm:text-[16px] text-gray-800 font-[500] hover:text-[#059669] transition-colors line-clamp-2">
                {productName}
              </h3>
            </Link>
            {/* High Demand Badge */}
            {demandStatus === "HIGH" && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 mt-1">
                <HiOutlineFire className="w-3 h-3" />
                High Demand
              </span>
            )}
            <p className="text-[12px] sm:text-[14px] text-gray-500 mt-1">
              ₹{price.toLocaleString()} × {quantity}
            </p>
            <p className="text-[14px] sm:text-[15px] text-[#059669] font-semibold mt-1">
              ₹{itemTotal.toLocaleString()}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto justify-between sm:justify-end">
          {/* Quantity Controls */}
          <div className="flex items-center border border-gray-300 rounded-md">
            <button
              onClick={handleDecrement}
              disabled={loading || quantity <= 1}
              className="px-2 sm:px-3 py-1.5 sm:py-2 text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              −
            </button>
            <span className="px-3 sm:px-4 py-1.5 sm:py-2 border-l border-r border-gray-300 min-w-[40px] sm:min-w-[50px] text-center font-medium text-sm sm:text-base">
              {quantity}
            </span>
            <button
              onClick={handleIncrement}
              disabled={loading}
              className="px-2 sm:px-3 py-1.5 sm:py-2 text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              +
            </button>
          </div>

          {/* Delete Button */}
          <button
            onClick={handleRemove}
            disabled={loading}
            className="text-red-500 text-xl sm:text-2xl hover:text-red-700 hover:bg-red-50 p-1.5 sm:p-2 rounded-full transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            title="Remove item"
          >
            <MdDeleteOutline />
          </button>
        </div>
      </div>

      {/* High Traffic Notice for this specific product */}
      {demandStatus === "HIGH" && (
        <div className="mt-3 p-2.5 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-xs text-amber-700 flex items-start gap-2">
            <HiOutlineFire className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>
              High traffic product — availability may vary. Your order will be
              confirmed once processed.
            </span>
          </p>
        </div>
      )}
    </div>
  );
};

export default CartItems;
