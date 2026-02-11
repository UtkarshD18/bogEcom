"use client";

import { useCart } from "@/context/CartContext";
import { FLAVORS, MyContext } from "@/context/ThemeContext";
import { useWishlist } from "@/context/WishlistContext";
import { getImageUrl } from "@/utils/imageUtils";
import Link from "next/link";
import { useContext, useState } from "react";
import { IoIosStar, IoIosStarHalf, IoMdCart, IoMdHeart, IoMdHeartEmpty } from "react-icons/io";
import { MdDeleteOutline } from "react-icons/md";

const ProductItem = (props) => {
    const {
        id, _id, name, brand, price, originalPrice, discount, rating, image, product
    } = props;

    const [isAddingToCart, setIsAddingToCart] = useState(false);
    const { addToCart, removeFromCart, isInCart } = useCart();
    const { toggleWishlist, isInWishlist } = useWishlist();
    const context = useContext(MyContext);
    const flavor = context?.flavor || FLAVORS.creamy;

    const productId = id || _id || product?._id || product?.id;
    const isWishlisted = isInWishlist(productId);
    const alreadyInCart = isInCart(productId);

    const productData = product || {
        _id: id || _id || product?.id || 1,
        name: name || "Classic Peanut Butter",
        brand: brand || "Buy One Gram",
        price: price || 349,
        originalPrice: originalPrice || 499,
        images: [image || "/product_1.png"],
        rating: rating || 4.5,
        discount: discount || 30
    };

    const handleWishlistClick = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        await toggleWishlist(productData);
    };

    const handleAddToCart = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (isAddingToCart) return;

        if (alreadyInCart) {
            setIsAddingToCart(true);
            try { await removeFromCart(productId); } catch (error) { console.error(error); } finally { setIsAddingToCart(false); }
        } else {
            setIsAddingToCart(true);
            try { await addToCart(productData, 1); } catch (error) { console.error(error); } finally { setIsAddingToCart(false); }
        }
    };

    const renderStars = () => {
        const stars = [];
        const fullStars = Math.floor(productData.rating);
        const hasHalfStar = productData.rating % 1 >= 0.5;
        for (let i = 0; i < fullStars; i++) {
            stars.push(<IoIosStar key={`f-${i}`} className="text-amber-400" />);
        }
        if (hasHalfStar) {
            stars.push(<IoIosStarHalf key="h" className="text-amber-400" />);
        }
        return stars;
    };

    return (
        <Link href={`/product/${productId}`} className="group relative block h-full w-full rounded-3xl bg-white p-3 transition-all hover:shadow-xl hover:-translate-y-1 border border-gray-100">

            {/* Image Container */}
            <div className="relative mb-3 h-40 w-full overflow-hidden rounded-2xl bg-gray-50 flex items-center justify-center">
                {/* Discount Badge */}
                {productData.discount > 0 && (
                    <span className="absolute left-2 top-2 z-10 rounded-full bg-gradient-to-r from-red-500 to-pink-500 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm">
                        {productData.discount}% OFF
                    </span>
                )}

                {/* Wishlist Button */}
                <button
                    onClick={handleWishlistClick}
                    className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/80 backdrop-blur-sm text-gray-400 shadow-sm transition-all hover:bg-red-50 hover:text-red-500 active:scale-95"
                >
                    {isWishlisted ? <IoMdHeart className="text-red-500" /> : <IoMdHeartEmpty />}
                </button>

                <img
                    src={getImageUrl(productData.images?.[0])}
                    alt={productData.name}
                    className="h-full w-full object-contain p-4 transition-transform duration-500 group-hover:scale-110 mix-blend-multiply"
                />
            </div>

            {/* Content */}
            <div className="px-1">
                <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">{productData.brand}</p>
                <h3 className="line-clamp-2 min-h-[40px] text-sm font-bold text-gray-900 group-hover:text-primary transition-colors">
                    {productData.name}
                </h3>

                {/* Rating */}
                <div className="mt-1 flex items-center gap-1">
                    <div className="flex text-xs">{renderStars()}</div>
                    <span className="text-[10px] text-gray-400">({productData.rating})</span>
                </div>

                {/* Price & Cart */}
                <div className="mt-3 flex items-end justify-between">
                    <div>
                        {productData.originalPrice > productData.price && (
                            <span className="block text-[10px] font-medium text-gray-400 line-through">₹{productData.originalPrice}</span>
                        )}
                        <span className="block text-lg font-bold text-primary">₹{productData.price}</span>
                    </div>

                    <button
                        onClick={handleAddToCart}
                        disabled={isAddingToCart || (!alreadyInCart && productData.stock === 0)}
                        className={`flex h-10 w-10 items-center justify-center rounded-full shadow-md transition-all active:scale-90 hover:shadow-lg disabled:opacity-70 disabled:cursor-not-allowed ${alreadyInCart
                            ? "bg-gradient-to-r from-red-500 to-pink-500 text-white"
                            : productData.stock === 0
                                ? "bg-gray-200 text-gray-400"
                                : "bg-linear-to-r from-primary to-[var(--flavor-hover)] text-black"
                            }`}
                    >
                        {isAddingToCart ? (
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        ) : alreadyInCart ? (
                            <MdDeleteOutline size={18} />
                        ) : (
                            <IoMdCart size={18} />
                        )}
                    </button>
                </div>
            </div>
        </Link>
    );
};

export default ProductItem;
