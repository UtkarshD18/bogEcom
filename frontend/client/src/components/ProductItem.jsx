"use client";

import { useCart } from "@/context/CartContext";
import { FLAVORS, MyContext } from "@/context/ThemeContext";
import { useWishlist } from "@/context/WishlistContext";
import { getImageUrl } from "@/utils/imageUtils";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useContext, useState } from "react";
import {
  IoIosStar,
  IoIosStarHalf,
  IoMdCart,
  IoMdHeart,
  IoMdHeartEmpty,
} from "react-icons/io";
import { MdDeleteOutline } from "react-icons/md";

/**
 * ProductItem Component
 *
 * @param {Object} props
 * @param {string|number} props.id - Product ID
 * @param {string} props.name - Product name
 * @param {string} props.brand - Brand name
 * @param {number} props.price - Current price
 * @param {number} props.originalPrice - Original price (before discount)
 * @param {number} props.discount - Discount percentage
 * @param {number} props.rating - Product rating (0-5)
 * @param {string} props.image - Product image URL
 * @param {Object} props.product - Full product object for cart/wishlist
 */
const ProductItem = ({
  id = 1,
  name = "Classic Peanut Butter - Crunchy",
  brand = "Buy One Gram",
  price = 349,
  originalPrice = 499,
  discount = 30,
  rating = 4.5,
  image = "/product_1.png",
  product = null,
}) => {
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const { addToCart, removeFromCart, isInCart } = useCart();
  const { toggleWishlist, isInWishlist } = useWishlist();
  const router = useRouter();
  const context = useContext(MyContext);
  const flavor = context?.flavor || FLAVORS.creamy;

  const productId = id || product?._id;
  const isWishlisted = isInWishlist(productId);
  const alreadyInCart = isInCart(productId);

  // Create product object for cart/wishlist
  const productData = product || {
    _id: id,
    name,
    brand,
    price,
    originalPrice,
    images: [image],
  };

  // Handle wishlist click
  const handleWishlistClick = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    await toggleWishlist(productData);
  };

  // Handle add to cart or remove from cart (toggle)
  const handleAddToCart = async (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (isAddingToCart) return;

    // If already in cart, remove it
    if (alreadyInCart) {
      setIsAddingToCart(true);
      try {
        await removeFromCart(productId);
      } catch (error) {
        console.error("Error removing from cart:", error);
      } finally {
        setIsAddingToCart(false);
      }
      return;
    }

    // Add to cart
    setIsAddingToCart(true);
    try {
      await addToCart(productData, 1);
    } catch (error) {
      console.error("Error adding to cart:", error);
    } finally {
      setIsAddingToCart(false);
    }
  };

  // Render rating stars with theme color
  const renderStars = () => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;

    for (let i = 0; i < fullStars; i++) {
      stars.push(
        <IoIosStar key={`full-${i}`} style={{ color: flavor.color }} />,
      );
    }
    if (hasHalfStar) {
      stars.push(<IoIosStarHalf key="half" style={{ color: flavor.color }} />);
    }
    return stars;
  };

  return (
    <Link href={`/product/${productId}`} className="block w-full h-full">
      <div
        className="group relative w-full h-full rounded-2xl p-2.5 sm:p-3.5 transition-all duration-300 hover:-translate-y-1 cursor-pointer"
        style={{
          backgroundColor: flavor.cardBg,
          border: `1px solid ${flavor.color}14`,
          boxShadow: `0 10px 24px ${flavor.color}10`,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.boxShadow = `0 18px 40px ${flavor.color}18`;
          e.currentTarget.style.borderColor = `${flavor.color}26`;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.boxShadow = `0 10px 24px ${flavor.color}10`;
          e.currentTarget.style.borderColor = `${flavor.color}14`;
        }}
      >
        {/* ================= IMAGE SECTION ================= */}
        <div
          className="relative h-36 sm:h-44 md:h-52 w-full overflow-hidden rounded-xl flex items-center justify-center"
          style={{
            backgroundColor: flavor.glass,
            border: `1px solid ${flavor.color}0f`,
          }}
        >
          <div
            className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
            style={{
              background: `linear-gradient(135deg, ${flavor.color}10 0%, transparent 60%)`,
            }}
          />

          {/* Discount Badge - themed */}
          {discount > 0 && (
            <span
              className="absolute top-3 left-3 text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow-sm z-10 transition-all duration-300"
              style={{ backgroundColor: flavor.badge }}
            >
              {discount}% OFF
            </span>
          )}

          {/* Wishlist Button */}
          <button
            onClick={handleWishlistClick}
            className={`absolute top-3 right-3 p-2 rounded-full shadow-sm opacity-0 transform translate-x-2 transition-all duration-300 group-hover:opacity-100 group-hover:translate-x-0 z-10 ${
              isWishlisted
                ? "bg-red-500 text-white"
                : "text-gray-400 hover:text-red-500 hover:bg-red-50"
            }`}
            style={{
              backgroundColor: isWishlisted ? undefined : flavor.cardBg,
              border: `1px solid ${flavor.color}1a`,
            }}
          >
            {isWishlisted ? (
              <IoMdHeart size={18} />
            ) : (
              <IoMdHeartEmpty size={18} />
            )}
          </button>

          {/* Product Image */}
          <img
            src={getImageUrl(image)}
            alt={name}
            className="h-full w-full object-contain mix-blend-multiply p-4 transition-transform duration-500 ease-in-out group-hover:scale-[1.08]"
          />
        </div>

        {/* ================= CONTENT SECTION ================= */}
        <div className="mt-2.5 sm:mt-4 px-0.5 sm:px-1">
          {/* Brand */}
          <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400 mb-1">
            {brand}
          </p>

          {/* Title - hover color themed */}
          <h3
            className="text-[12px] sm:text-[14px] font-bold text-gray-900 leading-snug line-clamp-2 transition-colors duration-300 min-h-[32px] sm:min-h-[40px] group-hover:text-gray-900"
            style={{}}
          >
            <span className="group-hover:hidden">{name}</span>
            <span
              className="hidden group-hover:inline"
              style={{ color: flavor.color }}
            >
              {name}
            </span>
          </h3>

          {/* Ratings - themed stars */}
          <div className="flex items-center gap-0.5 sm:gap-1 mt-1.5 sm:mt-2">
            <div className="flex text-[10px] sm:text-xs transition-colors duration-300">
              {renderStars()}
            </div>
            <span className="text-[10px] sm:text-xs text-gray-400 font-medium ml-0.5 sm:ml-1">
              ({rating})
            </span>
          </div>

          {/* Price Row */}
          <div className="flex items-end justify-between mt-3 sm:mt-4">
            <div className="flex flex-col">
              {originalPrice > price && (
                <span className="text-[10px] sm:text-xs text-gray-400 line-through font-medium">
                  ₹{originalPrice}
                </span>
              )}
              <span
                className="text-base sm:text-lg font-extrabold tracking-tight transition-colors duration-300"
                style={{ color: flavor.color }}
              >
                ₹{price}
              </span>
            </div>

            {/* Add/Remove Cart Button - themed */}
            <button
              onClick={handleAddToCart}
              disabled={isAddingToCart}
              aria-label={alreadyInCart ? "Remove from cart" : "Add to cart"}
              title={alreadyInCart ? "Remove from cart" : "Add to cart"}
              className="relative flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wide transition-all duration-300 active:scale-95"
              style={{
                backgroundColor: alreadyInCart ? "#dc2626" : flavor.color,
                color: "#ffffff",
                cursor: "pointer",
                border: `1px solid ${alreadyInCart ? "#dc2626" : `${flavor.color}cc`}`,
              }}
              onMouseEnter={(e) => {
                if (!alreadyInCart) {
                  e.currentTarget.style.backgroundColor = flavor.hover;
                  e.currentTarget.style.boxShadow = `0 4px 12px ${flavor.color}40`;
                } else {
                  e.currentTarget.style.backgroundColor = "#b91c1c";
                }
              }}
              onMouseLeave={(e) => {
                if (!alreadyInCart) {
                  e.currentTarget.style.backgroundColor = flavor.color;
                  e.currentTarget.style.boxShadow = "none";
                } else {
                  e.currentTarget.style.backgroundColor = "#dc2626";
                }
              }}
            >
              {isAddingToCart ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : alreadyInCart ? (
                <MdDeleteOutline size={16} />
              ) : (
                <IoMdCart size={16} />
              )}
            </button>
          </div>
        </div>
      </div>
    </Link>
  );
};

export default ProductItem;
