"use client";

import ProductCardBadges from "@/components/productCard/ProductCardBadges";
import ProductCardPriceBlock from "@/components/productCard/ProductCardPriceBlock";
import ProductImage from "@/components/ProductImage";
import ShareButton from "@/components/ShareButton";
import StockNotificationButton from "@/components/StockNotificationButton";
import { useCart } from "@/context/CartContext";
import { useWishlist } from "@/context/WishlistContext";
import useSeoAlt from "@/hooks/useSeoAlt";
import { resolveAvailability } from "@/utils/productAvailability";
import { buildProductHref } from "@/utils/productRouting";
import { subscribeToStockUpdates } from "@/realtime/stockSocket";
import { applyStockUpdateToProduct } from "@/utils/stockRealtime";
import {
  formatWeight,
  getWeightInGrams,
  replaceWeightRange,
} from "@/utils/weightDisplay";
import Link from "next/link";
import { memo, startTransition, useEffect, useState } from "react";
import {
  IoIosStar,
  IoIosStarHalf,
  IoIosStarOutline,
  IoMdCart,
  IoMdHeart,
  IoMdHeartEmpty,
} from "react-icons/io";
import { MdDeleteOutline } from "react-icons/md";

const ProductItem = (props) => {
  const {
    id,
    _id,
    name,
    brand,
    price,
    originalPrice,
    discount,
    rating,
    image,
    product,
    itemType,
    realtimeManagedExternally = false,
    compactListing = false,
  } = props;

  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const [liveProduct, setLiveProduct] = useState(product || null);
  const {
    addToCart,
    removeFromCart,
    isInCart,
    addComboToCart,
    removeComboFromCart,
    isComboInCart,
  } = useCart();
  const { toggleWishlist, isInWishlist } = useWishlist();

  useEffect(() => {
    setLiveProduct(product || null);
  }, [product]);

  useEffect(() => {
    if (!product) return undefined;
    if (realtimeManagedExternally) return undefined;

    return subscribeToStockUpdates((payload) => {
      startTransition(() => {
        setLiveProduct((previous) =>
          applyStockUpdateToProduct(previous, payload),
        );
      });
    });
  }, [product, realtimeManagedExternally]);

  const resolvedItemType = String(
    itemType || liveProduct?.itemType || product?.itemType || "product",
  ).toLowerCase();
  const isComboItem = resolvedItemType === "combo";
  const productCardId = isComboItem
    ? id || _id || liveProduct?.comboId || liveProduct?._id || liveProduct?.id
    : liveProduct?.parentProductId ||
      id ||
      _id ||
      liveProduct?._id ||
      liveProduct?.id;
  const productVariantId = liveProduct?.variantId || null;
  const alreadyInCart = isComboItem
    ? isComboInCart(productCardId)
    : isInCart(productCardId, productVariantId);

  const productData = liveProduct ||
    product || {
      _id: id || _id || product?.id || 1,
      name: name || "Classic Peanut Butter",
      brand: brand || "Buy One Gram",
      price: price || 349,
      originalPrice: originalPrice || 499,
      images: [image || "/product_1.webp"],
      rating: rating || 0,
      discount: discount || 30,
    };

  // Derive display values from default variant when hasVariants
  const defaultVariant =
    productData.hasVariants && productData.variants?.length > 0
      ? productData.variants[0]
      : null;
  const isVariantCard = Boolean(productVariantId || productData?.variantId);
  const availability = isComboItem
    ? resolveAvailability(productData)
    : isVariantCard
      ? resolveAvailability(defaultVariant, productData)
      : resolveAvailability(productData);
  const availableQuantity = availability.available;

  const displayPrice = defaultVariant
    ? defaultVariant.price
    : productData.price;
  const displayOriginalPrice = defaultVariant
    ? defaultVariant.originalPrice || 0
    : productData.originalPrice;
  const displayDiscount =
    displayOriginalPrice && displayOriginalPrice > displayPrice
      ? Math.round(
          ((displayOriginalPrice - displayPrice) / displayOriginalPrice) * 100,
        )
      : 0;
  const normalizedDisplayDiscount = isComboItem
    ? Math.ceil(Number(displayDiscount || 0))
    : Number(displayDiscount || 0);
  const displayWeightInGrams = defaultVariant
    ? getWeightInGrams(defaultVariant)
    : getWeightInGrams(productData);
  const displayWeightLabel = formatWeight(
    displayWeightInGrams,
    defaultVariant?.unit || productData?.unit || "g",
  );
  const displayProductName = replaceWeightRange(
    productData.name,
    displayWeightLabel,
  );
  const displayShortDescription = String(
    productData.shortDescription ||
      productData.short_description ||
      productData.subtitle ||
      productData.tagline ||
      productData.metaDescription ||
      "",
  ).trim();
  const isNewArrival = Boolean(
    productData.newArrival ?? productData.isNewArrival,
  );
  const isBestSeller = Boolean(
    productData.bestSeller ?? productData.isBestSeller,
  );
  const isHighDemand =
    Boolean(productData.highDemand) ||
    String(productData.demandStatus || "").toUpperCase() === "HIGH";
  const showDiscountBadge =
    Number(normalizedDisplayDiscount) > 0 && !isNewArrival && !isBestSeller;
  const isExclusiveProduct = Boolean(productData?.isExclusive);
  const wishlistVariantId = defaultVariant?._id || null;
  const wishlistItemType = isComboItem ? "combo" : "product";
  const isWishlisted = isInWishlist(
    productCardId,
    productVariantId || wishlistVariantId,
    wishlistItemType,
  );
  const isOutOfStock = availability.tracked && availableQuantity <= 0;
  const showNotifyAction = !isComboItem && isOutOfStock;
  const notifyVariantId = productVariantId || defaultVariant?._id || null;
  const notifyVariantName = defaultVariant?.name || "";
  const notifyRequested = Boolean(
    productData?.stockNotificationRequested ||
      defaultVariant?.stockNotificationRequested,
  );
  const lowStockLabel =
    !isComboItem &&
    availability.tracked &&
    availableQuantity > 0 &&
    availableQuantity <= 3
      ? `Only ${availableQuantity} left`
      : "";
  const actionLabel = alreadyInCart
    ? "Remove from cart"
    : showNotifyAction
      ? "Notify me when back in stock"
      : isOutOfStock
        ? "Currently unavailable"
        : "Add to cart";
  const primaryCartButtonStyle = {
    background:
      "linear-gradient(135deg, var(--flavor-color, #24150f) 0%, var(--flavor-hover, #3a2418) 100%)",
    color: "var(--flavor-text, #ffffff)",
    boxShadow:
      "0 18px 35px -26px color-mix(in srgb, var(--flavor-color, #24150f) 58%, transparent)",
  };

  const handleWishlistClick = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    await toggleWishlist(productData, {
      itemType: wishlistItemType,
      variantId: productVariantId || wishlistVariantId,
      variantName: defaultVariant?.name || "",
      quantity: 1,
    });
  };

  const imgAlt = useSeoAlt(
    productData.images?.[0] || displayProductName || productData.name,
    displayProductName || productData.name,
  );

  const handleAddToCart = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (isAddingToCart) return;

    if (alreadyInCart) {
      setIsAddingToCart(true);
      try {
        if (isComboItem) {
          await removeComboFromCart(productCardId);
        } else {
          await removeFromCart(productCardId, productVariantId);
        }
      } catch (error) {
        console.error(error);
      } finally {
        setIsAddingToCart(false);
      }
    } else {
      setIsAddingToCart(true);
      try {
        if (isComboItem) {
          await addComboToCart(productData, 1);
        } else {
          const cartPayload = defaultVariant
            ? {
                ...productData,
                parentProductId: productCardId,
                price: defaultVariant.price,
                originalPrice:
                  defaultVariant.originalPrice || productData.originalPrice,
                selectedVariant: {
                  _id: defaultVariant._id,
                  name: defaultVariant.name,
                  sku: defaultVariant.sku,
                  price: defaultVariant.price,
                  weightInGrams: defaultVariant.weightInGrams,
                  label: defaultVariant.label,
                  weight: defaultVariant.weight,
                  unit: defaultVariant.unit,
                },
                variantId: defaultVariant._id,
              }
            : {
                ...productData,
                parentProductId: productCardId,
              };
          await addToCart(cartPayload, 1);
        }
      } catch (error) {
        console.error(error);
      } finally {
        setIsAddingToCart(false);
      }
    }
  };

  const reviewStatsSource =
    !isComboItem && productData.hasVariants
      ? (productVariantId ? productData : defaultVariant) || productData
      : productData;
  const displayReviewCount = Number(
    reviewStatsSource?.totalReviews ??
      reviewStatsSource?.reviewCount ??
      reviewStatsSource?.numReviews ??
      0,
  );
  const displayRating =
    displayReviewCount > 0
      ? Number(reviewStatsSource?.avgRating ?? reviewStatsSource?.rating ?? 0)
      : 0;
  const productHref = isComboItem
    ? `/combo/${productCardId}`
    : buildProductHref(productData, {
        variantId: productVariantId,
        fallbackId: productCardId,
        fallbackHref: productCardId
          ? `/product/${encodeURIComponent(String(productCardId))}`
          : "/products",
      });

  const renderStars = () => {
    const stars = [];
    const fullStars = Math.floor(displayRating);
    const hasHalfStar = displayRating % 1 >= 0.5;
    for (let index = 0; index < 5; index += 1) {
      if (index < fullStars) {
        stars.push(<IoIosStar key={`f-${index}`} className="text-amber-400" />);
      } else if (index === fullStars && hasHalfStar) {
        stars.push(<IoIosStarHalf key="h" className="text-amber-400" />);
      } else {
        stars.push(
          <IoIosStarOutline key={`e-${index}`} className="text-gray-300" />,
        );
      }
    }
    return stars;
  };

  return (
    <div
      data-product-card
      data-product-card-id={productCardId || ""}
      data-product-card-type={resolvedItemType}
      className={`group relative flex w-full min-w-0 flex-col border bg-white shadow-[0_6px_16px_rgba(0,0,0,0.08)] transition-all ${
        compactListing
          ? "h-full max-sm:h-[390px] rounded-[18px] p-2 sm:rounded-[22px] sm:p-3"
          : "h-full rounded-[22px] p-3"
      } ${
        isOutOfStock
          ? "border-gray-100"
          : "border-gray-100 hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(0,0,0,0.12)]"
      }`}
    >
      <Link
        href={productHref}
        aria-label={`Open ${displayProductName || productData.name}`}
        className="absolute inset-0 z-0 rounded-[inherit]"
      >
        <span className="sr-only">{displayProductName || productData.name}</span>
      </Link>

      {/* Image Container */}
      <ProductImage
        src={productData.images?.[0]}
        alt={imgAlt}
        cardImage
        aspect={compactListing ? "aspect-square sm:aspect-square" : "aspect-square"}
        fit="cover"
        className={compactListing ? "relative z-10 mb-1.5 w-full bg-[#f5f5f5] sm:mb-3" : "relative z-10 mb-3 w-full bg-[#f5f5f5]"}
        imgClassName={`object-cover transition-all duration-300 ${
          isOutOfStock
            ? "grayscale-[0.45] saturate-50 opacity-70"
            : "group-hover:scale-105"
        }`}
      >
        <ProductCardBadges
          isNewArrival={isNewArrival}
          isBestSeller={isBestSeller}
          showDiscountBadge={showDiscountBadge}
          discountLabel={`${normalizedDisplayDiscount}% OFF`}
          isExclusive={isExclusiveProduct}
          isHighDemand={isHighDemand}
        />

        {/* Wishlist Button */}
        <button
          onClick={handleWishlistClick}
          className={`absolute right-2 top-2 z-10 flex items-center justify-center rounded-full bg-white/80 text-gray-400 shadow-sm backdrop-blur-sm transition-all hover:bg-red-50 hover:text-red-500 active:scale-95 ${
            compactListing ? "h-7 w-7 sm:h-8 sm:w-8" : "h-8 w-8"
          }`}
        >
          {isWishlisted ? (
            <IoMdHeart className="text-red-500" />
          ) : (
            <IoMdHeartEmpty />
          )}
        </button>

        {/* Share Button */}
        <div
          onClick={(e) => e.preventDefault()}
          className="absolute right-2 top-12 z-10"
        >
          <ShareButton
            productId={productCardId}
            productName={displayProductName || productData.name}
            variant="icon"
            iconSizeClass={compactListing ? "h-7 w-7 sm:h-8 sm:w-8" : "h-8 w-8"}
            iconGlyphClass={compactListing ? "h-3.5 w-3.5 sm:h-4 sm:w-4" : "h-4 w-4"}
          />
        </div>

        {isOutOfStock ? (
          <>
            <div className="absolute inset-0 bg-black/18" />
            <div className={`absolute border border-white/15 bg-black/55 text-white shadow-[0_18px_35px_-24px_rgba(0,0,0,0.6)] backdrop-blur-sm ${
              compactListing
                ? "inset-x-2 bottom-2 rounded-xl px-2 py-1.5 sm:inset-x-3 sm:bottom-3 sm:rounded-2xl sm:px-3 sm:py-2"
                : "inset-x-3 bottom-3 rounded-2xl px-3 py-2"
            }`}>
              <p className={compactListing ? "text-[9px] font-bold uppercase tracking-[0.14em] text-white sm:text-[10px]" : "text-[10px] font-bold uppercase tracking-[0.16em] text-white"}>
                Out of stock
              </p>
              <p className={compactListing ? "mt-0.5 line-clamp-1 text-[10px] font-medium text-white/80 sm:mt-1 sm:text-[11px]" : "mt-1 text-[11px] font-medium text-white/80"}>
                We're restocking soon
              </p>
            </div>
          </>
        ) : null}
      </ProductImage>

      {/* Content */}
      <div className="relative z-10 flex flex-1 flex-col">
        <p className={compactListing ? "mb-0.5 min-h-[20px] text-[8px] font-semibold uppercase tracking-[0.15em] text-gray-400 line-clamp-2 sm:mb-1 sm:min-h-0 sm:text-[10px]" : "mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-400"}>
          {productData.brand}
        </p>
        <h3 className={compactListing ? "min-h-[34px] line-clamp-2 text-[12px] font-bold leading-snug text-gray-900 transition-colors group-hover:text-primary sm:min-h-0 sm:text-[13px] sm:font-semibold" : "text-[13px] font-semibold leading-snug text-gray-900 transition-colors group-hover:text-primary"}>
          {displayProductName || productData.name}
        </h3>
        <div className={compactListing ? "mt-1 min-h-[16px] sm:min-h-7" : "mt-1 min-h-7"}>
          {displayShortDescription ? (
            <p className={compactListing ? "line-clamp-1 text-[10px] font-medium text-gray-500 sm:line-clamp-2 sm:text-[11px]" : "line-clamp-2 text-[11px] font-medium text-gray-500"}>
              {displayShortDescription}
            </p>
          ) : null}
        </div>

        {/* Weight */}
        {displayWeightLabel && (
          <span className={compactListing ? "mt-1 inline-flex w-fit rounded-full bg-[#f0f0f0] px-2 py-0.5 text-[10px] font-semibold text-gray-600 sm:mt-2 sm:px-2.5 sm:text-[11px]" : "mt-2 inline-flex w-fit rounded-full bg-[#f0f0f0] px-2.5 py-0.5 text-[11px] font-semibold text-gray-600"}>
            {displayWeightLabel}
            {productData.hasVariants && productData.variants?.length > 1 && (
              <span className="ml-1 text-gray-400">
                +{productData.variants.length - 1} more
              </span>
            )}
          </span>
        )}

        {/* Rating */}
        <div className={compactListing ? "mt-1 flex items-center gap-1 sm:mt-2" : "mt-2 flex items-center gap-1"}>
          <div className={compactListing ? "flex text-[10px] sm:text-xs" : "flex text-xs"}>{renderStars()}</div>
          <span className="text-[10px] text-gray-400">
            ({displayReviewCount})
          </span>
        </div>

        {lowStockLabel ? (
          <div className={compactListing ? "mt-1 sm:mt-2" : "mt-2"}>
            <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-amber-700">
              {lowStockLabel}
            </span>
          </div>
        ) : null}

        {/* Price & Cart */}
        <div className={compactListing ? "mt-auto border-t border-[#f3ece6] pt-2 sm:pt-3" : "mt-auto border-t border-[#f3ece6] pt-3"}>
          <div className={compactListing ? "flex items-end sm:min-h-10" : "min-h-10 flex items-end"}>
            <div>
              <ProductCardPriceBlock
                originalPrice={displayOriginalPrice}
                finalPrice={displayPrice}
              />
            </div>
          </div>

          <div className={compactListing ? "mt-2 sm:mt-3 sm:min-h-11" : "mt-3 min-h-11"}>
            {showNotifyAction ? (
              <StockNotificationButton
                productId={productCardId}
                productName={displayProductName || productData.name}
                variantId={notifyVariantId}
                variantName={notifyVariantName}
                initialRequested={notifyRequested}
                compact
                className={
                  compactListing
                    ? "max-sm:min-h-9 max-sm:rounded-xl max-sm:px-2 max-sm:py-1.5 max-sm:text-[11px] max-sm:leading-tight"
                    : ""
                }
                preventNavigation
              />
            ) : (
              <button
                onClick={handleAddToCart}
                aria-label={
                  alreadyInCart
                    ? `Remove ${displayProductName || productData.name} from cart`
                    : isOutOfStock
                      ? `${displayProductName || productData.name} is unavailable`
                      : `Add ${displayProductName || productData.name} to cart`
                }
                disabled={isAddingToCart || (!alreadyInCart && isOutOfStock)}
                className={`inline-flex w-full items-center justify-center gap-2 font-semibold transition disabled:cursor-not-allowed disabled:opacity-70 ${
                  compactListing
                    ? "min-h-9 rounded-xl px-2 py-1.5 text-[12px] sm:min-h-11 sm:rounded-2xl sm:px-4 sm:py-3 sm:text-sm"
                    : "min-h-11 rounded-2xl px-4 py-3 text-sm"
                } ${
                  alreadyInCart
                    ? "border border-red-200 bg-red-50 text-red-600 hover:bg-red-100"
                    : isOutOfStock
                      ? "border border-[#e4d6ca] bg-[#f4ede7] text-[#a08979]"
                      : "hover:-translate-y-0.5 hover:brightness-[1.03] active:brightness-95"
                }`}
                style={
                  !alreadyInCart && !isOutOfStock
                    ? primaryCartButtonStyle
                    : undefined
                }
              >
                {isAddingToCart ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : alreadyInCart ? (
                  <MdDeleteOutline size={18} />
                ) : (
                  <IoMdCart size={18} />
                )}
                <span>{actionLabel}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default memo(ProductItem);
