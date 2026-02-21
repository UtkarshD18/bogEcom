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

    // Derive display values from default variant when hasVariants
    const defaultVariant = productData.hasVariants && productData.variants?.length > 0
        ? productData.variants.find((v) => v.isDefault) || productData.variants[0]
        : null;

    const displayPrice = defaultVariant ? defaultVariant.price : productData.price;
    const displayOriginalPrice = defaultVariant ? (defaultVariant.originalPrice || 0) : productData.originalPrice;
    const displayDiscount = defaultVariant
        ? (defaultVariant.discountPercent || (defaultVariant.originalPrice && defaultVariant.originalPrice > defaultVariant.price
            ? Math.round(((defaultVariant.originalPrice - defaultVariant.price) / defaultVariant.originalPrice) * 100)
            : 0))
        : productData.discount;
    const displayWeight = defaultVariant ? defaultVariant.weight : productData.weight;
    const displayUnit = defaultVariant ? (defaultVariant.unit || "g") : (productData.unit && productData.unit !== "piece" ? productData.unit : "g");
    const isExclusiveProduct = Boolean(productData?.isExclusive);
    const wishlistVariantId = defaultVariant?._id || null;
    const isWishlisted = isInWishlist(productId, wishlistVariantId);

    const handleWishlistClick = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        await toggleWishlist(productData, {
            variantId: wishlistVariantId,
            variantName: defaultVariant?.name || "",
            quantity: 1,
        });
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
            try {
                const cartPayload = defaultVariant
                    ? {
                        ...productData,
                        price: defaultVariant.price,
                        originalPrice: defaultVariant.originalPrice || productData.originalPrice,
                        selectedVariant: {
                            _id: defaultVariant._id,
                            name: defaultVariant.name,
                            sku: defaultVariant.sku,
                            price: defaultVariant.price,
                            weight: defaultVariant.weight,
                            unit: defaultVariant.unit,
                        },
                        variantId: defaultVariant._id,
                    }
                    : productData;
                await addToCart(cartPayload, 1);
            } catch (error) { console.error(error); } finally { setIsAddingToCart(false); }
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
                {displayDiscount > 0 && (
                    <span className="absolute left-2 top-2 z-10 rounded-full bg-gradient-to-r from-red-500 to-pink-500 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm">
                        {displayDiscount}% OFF
                    </span>
                )}
                {isExclusiveProduct && (
                    <span className={`absolute left-2 z-10 rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm ${displayDiscount > 0 ? "top-8" : "top-2"}`}>
                        Members Only
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

                {/* Weight */}
                {displayWeight > 0 && (
                    <span className="inline-block mt-1 text-[11px] font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                        {Number(displayWeight) >= 1000 && displayUnit === "g"
                            ? `${Number(displayWeight) / 1000} kg`
                            : `${displayWeight}${displayUnit}`}
                        {productData.hasVariants && productData.variants?.length > 1 && (
                            <span className="text-gray-400 ml-1">+{productData.variants.length - 1} more</span>
                        )}
                    </span>
                )}

                {/* Rating */}
                <div className="mt-1 flex items-center gap-1">
                    <div className="flex text-xs">{renderStars()}</div>
                    <span className="text-[10px] text-gray-400">({productData.rating})</span>
                </div>

                {/* Price & Cart */}
                <div className="mt-3 flex items-end justify-between">
                    <div>
                        {displayOriginalPrice > displayPrice && (
                            <span className="block text-[10px] font-medium text-gray-400 line-through">₹{displayOriginalPrice}</span>
                        )}
                        <span className="block text-lg font-bold text-primary">₹{displayPrice}</span>
                    </div>

                    <button
                        onClick={handleAddToCart}
                        disabled={isAddingToCart || (!alreadyInCart && productData.stock === 0)}
                        className={`flex h-10 w-10 items-center justify-center rounded-full shadow-md transition-all active:scale-90 hover:shadow-lg disabled:opacity-70 disabled:cursor-not-allowed ${alreadyInCart
                            ? "bg-gradient-to-r from-red-500 to-pink-500 text-white"
                            : productData.stock === 0
                                ? "bg-gray-200 text-gray-400"
                                : "bg-[var(--color-primary)]/20 text-[var(--color-primary)] border border-[var(--color-primary)]/30"
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
