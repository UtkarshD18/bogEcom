"use client";
import { useCart } from "@/context/CartContext";
import Link from "next/link";
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
    <div className="p-5 border-b-[1px] border-[rgba(0,0,0,0.1)] flex items-center justify-between hover:bg-gray-50 transition-colors">
      <div className="flex items-center gap-4 flex-1">
        <Link href={`/product/${productId}`} className="shrink-0">
          <div className="w-20 h-20 bg-gray-100 rounded-md flex items-center justify-center overflow-hidden">
            <img
              src={productImage}
              alt={productName}
              className="w-full h-full object-contain hover:scale-105 transition-transform"
            />
          </div>
        </Link>
        <div className="flex-1 min-w-0">
          <Link href={`/product/${productId}`}>
            <h3 className="text-[16px] text-gray-800 font-[500] hover:text-[#c1591c] transition-colors line-clamp-2">
              {productName}
            </h3>
          </Link>
          <p className="text-[14px] text-gray-500 mt-1">
            ₹{price.toLocaleString()} × {quantity}
          </p>
          <p className="text-[15px] text-[#c1591c] font-semibold mt-1">
            ₹{itemTotal.toLocaleString()}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Quantity Controls */}
        <div className="flex items-center border border-gray-300 rounded-md">
          <button
            onClick={handleDecrement}
            disabled={loading || quantity <= 1}
            className="px-3 py-2 text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            −
          </button>
          <span className="px-4 py-2 border-l border-r border-gray-300 min-w-[50px] text-center font-medium">
            {quantity}
          </span>
          <button
            onClick={handleIncrement}
            disabled={loading}
            className="px-3 py-2 text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            +
          </button>
        </div>

        {/* Delete Button */}
        <button
          onClick={handleRemove}
          disabled={loading}
          className="text-red-500 text-2xl hover:text-red-700 hover:bg-red-50 p-2 rounded-full transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          title="Remove item"
        >
          <MdDeleteOutline />
        </button>
      </div>
    </div>
  );
};

export default CartItems;
