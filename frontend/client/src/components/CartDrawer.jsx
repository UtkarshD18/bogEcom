"use client";

import { useCart } from "@/context/CartContext";
import { useProducts } from "@/context/ProductContext";
import { useShippingDisplayCharge } from "@/hooks/useShippingDisplayCharge";
import { postData } from "@/utils/api";
import { trackEvent } from "@/utils/analyticsTracker";
import { round2 } from "@/utils/gst";
import { getImageUrl } from "@/utils/imageUtils";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { IoBagCheckOutline, IoCartOutline, IoClose, IoFlashOutline } from "react-icons/io5";
import { MdAdd, MdRemove, MdDeleteOutline } from "react-icons/md";

import "swiper/css";
import "swiper/css/navigation";

const CartDrawer = () => {
    const {
        isDrawerOpen,
        setIsDrawerOpen,
        cartItems,
        addToCart,
        removeFromCart,
        removeComboFromCart,
        updateQuantity,
        updateComboQuantity,
        isComboCartItem,
        cartSubTotalAmount,
        orderNote,
        setOrderNote,
    } = useCart();
    const { products, fetchProducts } = useProducts();
    const { displayShippingCharge } = useShippingDisplayCharge();
    const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);
    const [activeOfferId, setActiveOfferId] = useState(null);
    const [comboUpsells, setComboUpsells] = useState([]);
    const [comboUpsellLoading, setComboUpsellLoading] = useState(false);
    const trackedComboViewsRef = useRef(new Set());
    const comboUpsellCacheRef = useRef(new Map());
    const lastUpsellKeyRef = useRef("");
    const router = useRouter();
    const subtotal = round2(cartSubTotalAmount || 0);
    const shippingCost = 0; // DISPLAY-ONLY shipping is shown struck-through below.
    const total = round2(subtotal + shippingCost);

    const handleCloseCart = () => {
        setIsDrawerOpen(false);
    };

    const handleStartShopping = () => {
        setIsDrawerOpen(false);
    };

    const handleCheckout = async () => {
        setIsCheckoutLoading(true);
        setIsDrawerOpen(false);
        router.push("/checkout");
        setIsCheckoutLoading(false);
    };

    useEffect(() => {
        if (!isDrawerOpen || products.length > 0) return;
        fetchProducts({ limit: 12 });
    }, [fetchProducts, isDrawerOpen, products.length]);

    const resolveProductId = (item) => {
        if (!item) return null;
        if (item.product && typeof item.product === "object") {
            return item.product._id || item.product.id || null;
        }
        if (item.product) return item.product;
        if (item.productData) return item.productData._id || item.productData.id || null;
        return item._id || item.id || null;
    };

    const resolveProductData = (item) => {
        if (item?.product && typeof item.product === "object") return item.product;
        if (item?.productData) return item.productData;
        const productId = resolveProductId(item);
        const fallback = products?.find(
            (p) => String(p?._id || p?.id) === String(productId),
        );
        return fallback || item;
    };

    const isComboItem = (item) =>
        typeof isComboCartItem === "function"
            ? isComboCartItem(item)
            : item?.itemType === "combo" || Boolean(item?.combo || item?.comboSnapshot?.comboId);

    const toNumber = (value, fallback = 0) => {
        const numeric = Number(value);
        return Number.isFinite(numeric) ? numeric : fallback;
    };

    const resolveVariantData = (item, product) => {
        const explicitVariant = item?.selectedVariant;
        if (explicitVariant && typeof explicitVariant === "object") {
            return explicitVariant;
        }

        const variantId = item?.variant || item?.variantId || null;
        if (!variantId) return null;

        const variants = Array.isArray(product?.variants) ? product.variants : [];
        return (
            variants.find(
                (variant) => String(variant?._id || variant?.id) === String(variantId),
            ) || null
        );
    };

    const resolveCartItemVariantId = (item) => {
        if (!item) return null;
        if (item?.variant && typeof item.variant === "object") {
            return item.variant._id || item.variant.id || null;
        }
        return (
            item?.variantId ||
            item?.variant ||
            item?.selectedVariant?._id ||
            item?.selectedVariant?.id ||
            null
        );
    };

    // Helper to normalize cart item data
    const getItemData = (item) => {
        if (isComboItem(item)) {
            const combo = item?.comboSnapshot || item?.combo || {};
            const comboItems = Array.isArray(combo?.items) ? combo.items : [];
            const comboId =
                combo?.comboId ||
                combo?._id ||
                item?.combo ||
                item?.comboSnapshot?.comboId ||
                item?._id ||
                item?.id ||
                null;
            const price = toNumber(item?.price ?? combo?.comboPrice, 0);
            const originalPrice = toNumber(
                item?.originalPrice ?? combo?.originalPrice ?? combo?.originalTotal,
                0,
            );
            const itemsPreview = comboItems
                .map((entry) => entry?.productTitle || entry?.name)
                .filter(Boolean);
            const previewText = itemsPreview.slice(0, 3).join(", ");
            const extraCount = itemsPreview.length > 3 ? itemsPreview.length - 3 : 0;

            return {
                id: comboId,
                name: combo?.comboName || combo?.name || "Combo Bundle",
                image:
                    combo?.thumbnail ||
                    combo?.image ||
                    item?.image ||
                    "/combo_placeholder.png",
                price,
                originalPrice,
                brand: "Combo Deal",
                quantity: Number(item?.quantity || 1),
                quantityUnit:
                    previewText && extraCount > 0
                        ? `${previewText} + ${extraCount} more`
                        : previewText || "Bundle",
                itemType: "combo",
                items: comboItems,
            };
        }

        const product = resolveProductData(item);
        const productId = resolveProductId(item);
        const variant = resolveVariantData(item, product);
        const variantLabel =
            item?.variantName ||
            variant?.name ||
            (variant?.weight
                ? `${variant.weight}${variant?.unit || product?.unit || ""}`
                : "");
        const price = toNumber(
            item?.price ?? variant?.price ?? product?.price,
            0,
        );
        const originalPrice = toNumber(
            item?.originalPrice ?? variant?.originalPrice ?? product?.originalPrice,
            0,
        );

        return {
            id: productId || product?._id || product?.id || item._id || item.id,
            name: product?.name || item?.name || item?.title || "Product",
            image:
                product?.thumbnail ||
                product?.images?.[0] ||
                item?.image ||
                "/product_1.png",
            price,
            originalPrice,
            brand: product?.brand || item?.brand || "BOG",
            quantity: Number(item?.quantity || 1),
            quantityUnit:
                variantLabel ||
                item?.quantityUnit ||
                product?.quantityUnit ||
                "Per Unit",
            itemType: "product",
        };
    };

    const resolveVariantLabel = (variant, product) => {
        if (!variant) return "";
        if (variant?.name) return variant.name;
        if (variant?.weight) {
            const unit = variant?.unit || product?.unit || "";
            return `${variant.weight}${unit}`.trim();
        }
        return "";
    };

    const getOfferData = (product) => {
        const defaultVariant =
            product?.hasVariants && Array.isArray(product?.variants)
                ? product.variants.find((variant) => variant?.isDefault) || product.variants[0]
                : null;

        const discountedPrice = round2(
            Number(defaultVariant?.price ?? product?.price ?? 0),
        );

        let originalPrice = round2(
            Number(defaultVariant?.originalPrice ?? product?.originalPrice ?? 0),
        );
        const explicitDiscount = Number(
            defaultVariant?.discountPercent ?? product?.discount ?? 0,
        );

        if (!originalPrice || originalPrice <= discountedPrice) {
            if (explicitDiscount > 0 && explicitDiscount < 100) {
                originalPrice = round2(discountedPrice / (1 - explicitDiscount / 100));
            } else {
                originalPrice = round2(discountedPrice * 1.12);
            }
        }

        const savings = Math.max(round2(originalPrice - discountedPrice), 0);
        const percentOff = Math.max(
            1,
            Math.round(
                originalPrice > 0 ? ((originalPrice - discountedPrice) / originalPrice) * 100 : explicitDiscount || 0,
            ),
        );

        return {
            discountedPrice,
            originalPrice,
            savings,
            percentOff: Math.min(percentOff, 30),
            variantId: defaultVariant?._id || defaultVariant?.id || null,
            variantLabel: resolveVariantLabel(defaultVariant, product),
            variant: defaultVariant || null,
        };
    };

    const buildOfferItemFromProduct = (product) => {
        if (!product) return null;
        const offer = getOfferData(product);
        const productId = product?._id || product?.id;
        if (!productId) return null;
        return {
            source: "product",
            productId: String(productId),
            name: product?.name || product?.title || "Recommended product",
            image: product?.thumbnail || product?.images?.[0] || "/product_1.png",
            discountedPrice: offer.discountedPrice,
            originalPrice: offer.originalPrice,
            percentOff: offer.percentOff,
            variantLabel: offer.variantLabel || "",
            variantId: offer.variantId || null,
            productRef: product,
            offer,
        };
    };

    const buildOfferItemFromCombo = (entry) => {
        const combo = entry?.combo || entry;
        if (!combo) return null;
        const comboItems = Array.isArray(combo?.items) ? combo.items : [];
        if (!comboItems.length) return null;
        const missingIds = Array.isArray(entry?.missingProductIds)
            ? entry.missingProductIds.map((id) => String(id))
            : [];
        const preferredItem =
            (missingIds.length > 0
                ? comboItems.find((item) =>
                    missingIds.includes(String(item?.productId || "")),
                )
                : comboItems[0]) || comboItems[0];
        if (!preferredItem) return null;

        const productId =
            preferredItem?.productId || preferredItem?.product?._id || preferredItem?.product?.id;
        if (!productId) return null;
        const productMatch = products?.find(
            (product) => String(product?._id || product?.id) === String(productId),
        );
        const variantId = preferredItem?.variantId || null;
        const matchedVariant =
            variantId && Array.isArray(productMatch?.variants)
                ? productMatch.variants.find(
                    (variant) =>
                        String(variant?._id || variant?.id) === String(variantId),
                )
                : null;
        const discountedPrice = round2(
            Number(preferredItem?.price ?? productMatch?.price ?? 0),
        );
        const originalPrice = round2(
            Number(preferredItem?.originalPrice ?? productMatch?.originalPrice ?? 0),
        );
        const resolvedOriginal =
            originalPrice > 0 ? originalPrice : discountedPrice;
        const percentOff =
            resolvedOriginal > discountedPrice
                ? Math.round(
                    ((resolvedOriginal - discountedPrice) / resolvedOriginal) * 100,
                )
                : 0;

        return {
            source: "combo",
            productId: String(productId),
            name:
                preferredItem?.productTitle ||
                productMatch?.name ||
                combo?.name ||
                "Recommended product",
            image:
                preferredItem?.image ||
                productMatch?.thumbnail ||
                productMatch?.images?.[0] ||
                combo?.thumbnail ||
                combo?.image ||
                "/product_1.png",
            discountedPrice,
            originalPrice: resolvedOriginal,
            percentOff,
            variantLabel:
                preferredItem?.variantName ||
                resolveVariantLabel(matchedVariant, productMatch) ||
                "",
            variantId: variantId ? String(variantId) : null,
            productRef: productMatch || null,
        };
    };

    const cartUpsellItems = useMemo(() => {
        const items = [];
        cartItems.forEach((item) => {
            if (isComboItem(item)) {
                const comboItems = item?.comboSnapshot?.items || item?.combo?.items || [];
                comboItems.forEach((entry) => {
                    const productId = entry?.productId || entry?.product?._id || entry?.product?.id;
                    if (!productId) return;
                    items.push({
                        productId: String(productId),
                        variantId: entry?.variantId ? String(entry.variantId) : "",
                    });
                });
                return;
            }

            const productId = resolveProductId(item);
            if (!productId) return;
            const variantId = resolveCartItemVariantId(item);
            items.push({
                productId: String(productId),
                variantId: variantId ? String(variantId) : "",
            });
        });
        return items;
    }, [cartItems, isComboItem]);

    const cartUpsellKey = useMemo(() => {
        if (!cartUpsellItems.length) return "";
        return cartUpsellItems
            .map((entry) => `${entry.productId}:${entry.variantId || ""}`)
            .sort()
            .join("|");
    }, [cartUpsellItems]);

    const cartProductIds = useMemo(() => {
        const ids = new Set();
        cartUpsellItems.forEach((entry) => {
            if (entry?.productId) ids.add(String(entry.productId));
        });
        return ids;
    }, [cartUpsellItems]);

    const relatedProducts = useMemo(() => {
        if (!Array.isArray(products)) return [];
        return products
            .filter((product) => {
                const id = product?._id || product?.id;
                if (!id) return false;
                return !cartProductIds.has(String(id));
            })
            .slice(0, 4);
    }, [products, cartProductIds]);

    useEffect(() => {
        let active = true;

        const loadComboUpsells = async () => {
            if (!isDrawerOpen) {
                if (active) setComboUpsellLoading(false);
                return;
            }

            if (!cartUpsellItems.length) {
                if (active) {
                    setComboUpsells([]);
                    setComboUpsellLoading(false);
                }
                return;
            }

            if (cartUpsellKey && lastUpsellKeyRef.current !== cartUpsellKey) {
                lastUpsellKeyRef.current = cartUpsellKey;
                comboUpsellCacheRef.current.clear();
                if (active) {
                    setComboUpsells([]);
                }
            }

            const cached = cartUpsellKey
                ? comboUpsellCacheRef.current.get(cartUpsellKey)
                : null;
            if (cached) {
                if (active) {
                    setComboUpsells(cached);
                    setComboUpsellLoading(false);
                }
                return;
            }

            try {
                setComboUpsellLoading(true);
                const response = await postData("/api/combos/cart-upsell", {
                    items: cartUpsellItems.map((entry) => ({
                        productId: entry.productId,
                        variantId: entry.variantId || undefined,
                    })),
                });
                if (!active) return;
                if (response?.success) {
                    const suggestions = Array.isArray(response.data?.suggestions)
                        ? response.data.suggestions
                        : [];
                    setComboUpsells(suggestions);
                    if (cartUpsellKey) {
                        comboUpsellCacheRef.current.set(cartUpsellKey, suggestions);
                    }
                } else {
                    setComboUpsells([]);
                }
            } catch (error) {
                if (active) {
                    setComboUpsells([]);
                }
            } finally {
                if (active) {
                    setComboUpsellLoading(false);
                }
            }
        };

        loadComboUpsells();

        return () => {
            active = false;
        };
    }, [cartUpsellItems, cartUpsellKey, isDrawerOpen]);

    useEffect(() => {
        if (!comboUpsells.length) return;
        comboUpsells.forEach((entry) => {
            const combo = entry?.combo || entry;
            const comboId = String(combo?._id || combo?.id || "");
            if (!comboId) return;
            if (trackedComboViewsRef.current.has(comboId)) return;
            trackedComboViewsRef.current.add(comboId);
            trackEvent("combo_view", {
                comboId,
                comboName: combo?.name || "",
                comboSlug: combo?.slug || "",
                comboType: combo?.comboType || "",
                sectionName: "cart_upsell",
            });
        });
    }, [comboUpsells]);

    const cartSavings = round2(
        cartItems.reduce((sum, item) => {
            const data = getItemData(item);
            const qty = Number(item?.quantity || 1);
            const discountedPrice = Number(data?.price || 0);
            const originalPrice = Number(data?.originalPrice || 0);
            if (originalPrice > discountedPrice) {
                return sum + (originalPrice - discountedPrice) * qty;
            }
            return sum;
        }, 0),
    );

    const offerSavingsPreview = round2(
        relatedProducts.reduce((sum, product) => {
            const offer = getOfferData(product);
            return sum + offer.savings;
        }, 0),
    );

    const offerItem = useMemo(() => {
        if (comboUpsells.length > 0) {
            const comboOffer = buildOfferItemFromCombo(comboUpsells[0]);
            if (comboOffer) return comboOffer;
        }
        if (relatedProducts.length > 0) {
            return buildOfferItemFromProduct(relatedProducts[0]);
        }
        return null;
    }, [comboUpsells, relatedProducts, products]);

    const offerPreviewSavings = round2(
        offerItem
            ? Math.max(
                Number(offerItem.originalPrice || 0) -
                Number(offerItem.discountedPrice || 0),
                0,
            )
            : offerSavingsPreview,
    );

    const handleAddOfferProduct = async (offer) => {
        if (!offer || activeOfferId) return;
        const id = offer?.productId;
        if (!id) return;
        setActiveOfferId(String(id));
        try {
            const baseProduct =
                offer.productRef ||
                ({
                    _id: id,
                    id,
                    name: offer.name,
                    thumbnail: offer.image,
                    images: offer.image ? [offer.image] : undefined,
                });
            const variantFromProduct =
                offer.variantId && Array.isArray(baseProduct?.variants)
                    ? baseProduct.variants.find(
                        (variant) =>
                            String(variant?._id || variant?.id) ===
                            String(offer.variantId),
                    )
                    : null;
            const cartProduct = offer.variantId
                ? {
                    ...baseProduct,
                    price: offer.discountedPrice,
                    originalPrice: offer.originalPrice,
                    selectedVariant: {
                        _id: offer.variantId,
                        name: offer.variantLabel || variantFromProduct?.name || "",
                        sku: variantFromProduct?.sku,
                        price: offer.discountedPrice,
                        weight: variantFromProduct?.weight,
                        unit: variantFromProduct?.unit,
                    },
                    variantId: offer.variantId,
                }
                : {
                    ...baseProduct,
                    price: offer.discountedPrice,
                    originalPrice: offer.originalPrice,
                };
            await addToCart(cartProduct, 1);
        } finally {
            setActiveOfferId(null);
        }
    };

    return (
        <>
            {/* Backdrop */}
            <div
                className={`fixed inset-0 z-[120] bg-black/45 backdrop-blur-[2px] transition-opacity duration-300 ${isDrawerOpen ? "opacity-100" : "opacity-0 pointer-events-none"
                    }`}
                onClick={handleCloseCart}
            />

            {/* Drawer */}
            <div
                className={`fixed inset-y-0 right-0 z-[121] h-full w-full bg-white shadow-2xl transition-transform duration-300 md:max-w-md flex flex-col ${isDrawerOpen
                        ? "translate-x-0"
                        : "translate-x-full"
                    }`}
                style={{ background: "#ffffff" }}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <IoCartOutline size={24} className="text-primary" />
                        Shopping Cart
                        <span className="text-sm font-normal text-gray-500 ml-2">({cartItems.length} items)</span>
                    </h2>
                    <button
                        onClick={handleCloseCart}
                        className="p-2 rounded-full hover:bg-gray-100 transition-colors"
                    >
                        <IoClose size={24} />
                    </button>
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto overscroll-y-contain scroll-smooth px-4 pb-6 pt-3 sm:px-5 [scrollbar-gutter:stable]">
                    {cartItems.length === 0 ? (
                        <div className="flex h-full flex-col items-center justify-center text-center space-y-4">
                            <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center">
                                <IoCartOutline size={40} className="text-gray-300" />
                            </div>
                            <div>
                                <p className="text-lg font-bold text-gray-900">Your cart is empty</p>
                                <p className="text-sm text-gray-500">Looks like you haven&apos;t added anything yet.</p>
                            </div>
                            <Link
                                href="/products"
                                onClick={handleStartShopping}
                                className="mt-4 px-6 py-2 bg-primary text-white rounded-full font-bold shadow-lg shadow-primary/30 hover:brightness-110 transition-all active:scale-95"
                            >
                                Start Shopping
                            </Link>
                        </div>
                    ) : (
                        <>
                            <section className="space-y-3">
                                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">
                                    Cart Items
                                </p>
                                {cartItems.map((item) => {
                                    const data = getItemData(item);
                                    const productId = resolveProductId(item);
                                    const isComboLine = data.itemType === "combo";
                                    return (
                                        <div key={`${data.id}-${item?.variant || item?.variantId || "base"}`} className="flex gap-4 p-3 rounded-2xl bg-white border border-gray-100 shadow-sm">
                                            <div className="w-20 h-20 shrink-0 bg-white rounded-xl flex items-center justify-center p-2 border border-gray-100">
                                                <img
                                                    src={getImageUrl(data.image)}
                                                    alt={data.name}
                                                    className="w-full h-full object-contain"
                                                />
                                            </div>

                                            <div className="flex-1 flex flex-col justify-between min-w-0">
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="min-w-0">
                                                        <h4 className="text-sm font-bold text-gray-900 line-clamp-1">{data.name}</h4>
                                                        <p className="text-xs text-gray-500">
                                                            {data.brand}
                                                            {data.quantityUnit ? ` • ${data.quantityUnit}` : ""}
                                                        </p>
                                                    </div>
                                                    <button
                                                        onClick={() =>
                                                            isComboLine
                                                                ? removeComboFromCart(data.id)
                                                                : removeFromCart(
                                                                    productId || data.id,
                                                                    item?.variant || null,
                                                                )
                                                        }
                                                        className="p-1.5 rounded-full text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all active:scale-90"
                                                        aria-label="Remove item"
                                                    >
                                                        <MdDeleteOutline size={16} />
                                                    </button>
                                                </div>

                                                <div className="flex items-center justify-between mt-2">
                                                    <div className="flex items-center gap-3 bg-gray-50 rounded-full px-2 py-1">
                                                        <button
                                                            onClick={() =>
                                                                isComboLine
                                                                    ? updateComboQuantity(
                                                                        data.id,
                                                                        Number(data.quantity) - 1,
                                                                    )
                                                                    : updateQuantity(
                                                                        productId || data.id,
                                                                        Number(data.quantity) - 1,
                                                                        item?.variant || null,
                                                                    )
                                                            }
                                                            className="w-6 h-6 flex items-center justify-center rounded-full bg-white shadow-sm text-gray-600 hover:text-red-500 active:scale-90 transition-all"
                                                        >
                                                            <MdRemove size={14} />
                                                        </button>
                                                        <span className="text-sm font-bold w-4 text-center">{data.quantity}</span>
                                                        <button
                                                            onClick={() =>
                                                                isComboLine
                                                                    ? updateComboQuantity(
                                                                        data.id,
                                                                        Number(data.quantity) + 1,
                                                                    )
                                                                    : updateQuantity(
                                                                        productId || data.id,
                                                                        Number(data.quantity) + 1,
                                                                        item?.variant || null,
                                                                    )
                                                            }
                                                            disabled={
                                                                isComboLine
                                                                    ? false
                                                                    : Number(data.quantity) >=
                                                                    (item.product?.stock ||
                                                                        item.productData?.stock ||
                                                                        item.stock ||
                                                                        Infinity)
                                                            }
                                                            className="w-6 h-6 flex items-center justify-center rounded-full bg-white shadow-sm text-gray-600 hover:text-primary active:scale-90 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                                                        >
                                                            <MdAdd size={14} />
                                                        </button>
                                                    </div>
                                                    <span className="text-sm font-bold text-primary">₹{round2(data.price * data.quantity)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </section>

                            <div className="my-6 border-t border-gray-200" />

                            <section className="rounded-2xl border border-amber-100 bg-amber-50/70 p-4 space-y-3">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <p className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                                            <IoFlashOutline className="text-amber-600" />
                                            Limited Time Offer
                                        </p>
                                        <p className="mt-1 text-xs text-gray-600">
                                            Limited time offer - grab this at a discounted price.
                                        </p>
                                    </div>
                                    <span className="inline-flex items-center rounded-full bg-amber-600 text-white px-2.5 py-1 text-[10px] font-semibold tracking-wide">
                                        LIMITED TIME DEAL
                                    </span>
                                </div>

                                <p className="text-xs text-emerald-700 font-semibold">
                                    {cartSavings > 0
                                        ? `You're saving ₹${cartSavings} on this order.`
                                        : offerPreviewSavings > 0
                                            ? `Save ₹${offerPreviewSavings} more with this limited-time deal.`
                                            : "Limited-time offer curated for your cart."}
                                </p>

                                <div className="space-y-3 pt-1">
                                    {comboUpsellLoading && !offerItem ? (
                                        <p className="text-xs text-gray-500">Loading offer...</p>
                                    ) : offerItem ? (
                                        <div className="rounded-xl border border-amber-100 bg-white p-3 shadow-sm">
                                            <div className="flex gap-3">
                                                <div className="w-16 h-16 rounded-lg border border-gray-100 bg-gray-50 flex items-center justify-center p-2 shrink-0">
                                                    <img
                                                        src={getImageUrl(offerItem.image)}
                                                        alt={offerItem.name || "Recommended product"}
                                                        className="w-full h-full object-contain"
                                                    />
                                                </div>

                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-700">
                                                            Limited time offer
                                                        </p>
                                                        {offerItem.percentOff > 0 && (
                                                            <span className="rounded-full bg-red-50 text-red-600 px-1.5 py-0.5 text-[9px] font-semibold whitespace-nowrap">
                                                                {offerItem.percentOff}% OFF
                                                            </span>
                                                        )}
                                                    </div>
                                                    <Link
                                                        href={`/product/${offerItem.productId}`}
                                                        onClick={handleCloseCart}
                                                        className="line-clamp-1 text-sm font-semibold text-gray-900 hover:text-primary"
                                                    >
                                                        {offerItem.name}
                                                    </Link>
                                                    {offerItem.variantLabel && (
                                                        <p className="mt-0.5 text-xs text-gray-500">
                                                            {offerItem.variantLabel}
                                                        </p>
                                                    )}
                                                    <p className="mt-0.5 text-xs text-gray-500">
                                                        Earlier price ₹{round2(offerItem.originalPrice || 0)}, now only ₹{round2(offerItem.discountedPrice || 0)}
                                                    </p>

                                                    <div className="mt-2 flex items-center justify-between gap-2">
                                                        <div className="flex items-center gap-2">
                                                            {offerItem.originalPrice > offerItem.discountedPrice && (
                                                                <span className="text-xs text-gray-400 line-through">
                                                                    ₹{round2(offerItem.originalPrice || 0)}
                                                                </span>
                                                            )}
                                                            <span className="text-sm font-extrabold text-primary">
                                                                ₹{round2(offerItem.discountedPrice || 0)}
                                                            </span>
                                                        </div>
                                                        <button
                                                            onClick={() => handleAddOfferProduct(offerItem)}
                                                            disabled={activeOfferId === String(offerItem.productId)}
                                                            className="rounded-full bg-primary text-white text-xs font-semibold px-3 py-1.5 hover:brightness-110 transition disabled:opacity-60"
                                                        >
                                                            {activeOfferId === String(offerItem.productId)
                                                                ? "Adding..."
                                                                : "Add to cart"}
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <p className="text-xs text-gray-500">
                                            New deals will appear here based on your cart.
                                        </p>
                                    )}
                                </div>
                            </section>

                            <div className="my-6 border-t border-gray-200" />

                            <section className="rounded-2xl border border-gray-100 bg-gray-50/60 p-4">
                                <div className="space-y-2 mb-4">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-500">Subtotal</span>
                                        <span className="font-bold text-gray-900">₹{subtotal}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-500">Shipping</span>
                                        <span className="font-bold text-primary flex items-center gap-2">
                                            {displayShippingCharge > 0 && (
                                                <span className="line-through text-gray-500">
                                                    &#8377;{displayShippingCharge.toFixed(2)}
                                                </span>
                                            )}
                                            <span>&#8377;0.00</span>
                                        </span>
                                    </div>
                                    {cartSavings > 0 && (
                                        <div className="flex justify-between text-sm text-emerald-700">
                                            <span>You&apos;re saving</span>
                                            <span className="font-bold">₹{cartSavings}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between text-lg font-extrabold mt-2 pt-2 border-t border-gray-200">
                                        <span>Total</span>
                                        <span>₹{total}</span>
                                    </div>
                                </div>

                                <div className="mb-4">
                                    <textarea
                                        placeholder="Add a note to your order..."
                                        value={orderNote}
                                        onChange={(e) => setOrderNote(e.target.value)}
                                        className="w-full text-sm p-3 rounded-xl border border-gray-200 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary resize-none h-20 bg-white"
                                    />
                                </div>

                                <button
                                    onClick={handleCheckout}
                                    disabled={isCheckoutLoading}
                                    className="w-full py-4 rounded-full bg-linear-to-r from-primary to-[var(--flavor-hover)] text-white font-bold text-lg shadow-lg shadow-primary/30 hover:shadow-xl hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {isCheckoutLoading ? (
                                        <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    ) : (
                                        <>
                                            Checkout <IoBagCheckOutline size={20} />
                                        </>
                                    )}
                                </button>
                                <p className="text-[10px] text-center text-gray-400 mt-3 flex items-center justify-center gap-1">
                                    <IoCartOutline /> Secure Checkout
                                </p>
                            </section>
                        </>
                    )}
                </div>
            </div >
        </>
    );
};

export default CartDrawer;
