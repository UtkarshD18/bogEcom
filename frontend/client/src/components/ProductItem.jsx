"use client";

import { useCart } from "@/context/CartContext";
import { FLAVORS, MyContext } from "@/context/ThemeContext";
import { useWishlist } from "@/context/WishlistContext";
import { getImageUrl } from "@/utils/imageUtils";
import Link from "next/link";
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
        className="group relative w-full h-full rounded-3xl p-2.5 sm:p-3.5 transition-all duration-300 hover:-translate-y-1.5 hover:rotate-[-0.35deg] cursor-pointer overflow-hidden"
        style={{
          backgroundColor: flavor.cardBg,
          border: `1px solid ${flavor.color}14`,
          boxShadow: `0 10px 24px ${flavor.color}10`,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.boxShadow = `0 26px 70px rgba(0,0,0,0.12), 0 18px 44px ${flavor.color}1f`;
          e.currentTarget.style.borderColor = `${flavor.color}2e`;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.boxShadow = `0 10px 24px ${flavor.color}10`;
          e.currentTarget.style.borderColor = `${flavor.color}14`;
        }}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
          style={{
            background: `radial-gradient(650px circle at 18% 0%, ${flavor.color}22, transparent 58%), radial-gradient(520px circle at 110% 120%, ${flavor.badge}1f, transparent 46%)`,
          }}
        />
        <div className="pointer-events-none absolute inset-0 rounded-3xl ring-1 ring-black/5" />

        {/* ================= IMAGE SECTION ================= */}
        <div
          className="relative h-36 sm:h-44 md:h-52 w-full overflow-hidden rounded-2xl flex items-center justify-center"
          style={{
            background: `linear-gradient(135deg, rgba(255,255,255,0.85) 0%, ${flavor.glass} 100%)`,
            border: `1px solid ${flavor.color}12`,
          }}
        >
          <div
            className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
            style={{
              background: `linear-gradient(135deg, ${flavor.color}18 0%, transparent 52%, ${flavor.badge}10 100%)`,
            }}
          />

          {/* Discount Badge - themed */}
          {discount > 0 && (
            <span
              className="absolute top-3 left-3 text-white text-[10px] font-extrabold px-2.5 py-1 rounded-full shadow-sm z-10 transition-all duration-300 backdrop-blur"
              style={{
                background: `linear-gradient(90deg, ${flavor.badge} 0%, ${flavor.color} 100%)`,
                border: `1px solid ${flavor.color}2e`,
                boxShadow: `0 10px 20px ${flavor.color}14`,
              }}
            >
              {discount}% OFF
            </span>
          )}

          {/* Wishlist Button */}
          <button
            onClick={handleWishlistClick}
            className={`absolute top-3 right-3 p-2 rounded-full shadow-sm opacity-100 sm:opacity-0 transform translate-x-0 sm:translate-x-2 transition-all duration-300 sm:group-hover:opacity-100 sm:group-hover:translate-x-0 z-10 backdrop-blur ${
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
              className="relative flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-full text-[10px] sm:text-xs font-extrabold uppercase tracking-wide transition-all duration-300 active:scale-95 hover:scale-105 hover:-translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed"
              style={{
                background: alreadyInCart
                  ? "linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)"
                  : `linear-gradient(135deg, ${flavor.color} 0%, ${flavor.hover} 100%)`,
                color: "#ffffff",
                cursor: "pointer",
                border: `1px solid ${alreadyInCart ? "#ef4444" : `${flavor.color}cc`}`,
                boxShadow: `0 12px 24px ${
                  alreadyInCart ? "#ef444455" : `${flavor.color}55`
                }`,
              }}
            >
              {isAddingToCart ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : alreadyInCart ? (
                <MdDeleteOutline size={18} />
              ) : (
                <IoMdCart size={18} />
              )}
            </button>
          </div>
        </div>
      </div>
    </Link>
  );
};

export default ProductItem;
