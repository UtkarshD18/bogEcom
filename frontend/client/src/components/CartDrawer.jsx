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
        addComboToCart,
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
        };
    };

    const cartProductIds = useMemo(() => {
        const ids = new Set();
        cartItems.forEach((item) => {
            if (isComboItem(item)) {
                const comboItems = item?.comboSnapshot?.items || item?.combo?.items || [];
                comboItems.forEach((entry) => {
                    const productId = entry?.productId || entry?.product?._id || entry?.product?.id;
                    if (productId) ids.add(String(productId));
                });
                return;
            }

            const id = resolveProductId(item);
            if (id) ids.add(String(id));
        });
        return ids;
    }, [cartItems, isComboItem]);

    const cartProductIdList = useMemo(
        () => Array.from(cartProductIds.values()),
        [cartProductIds],
    );

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
            if (!isDrawerOpen) return;
            if (!cartProductIdList.length) {
                if (active) setComboUpsells([]);
                return;
            }
            try {
                setComboUpsellLoading(true);
                const response = await postData("/api/combos/cart-upsell", {
                    items: cartProductIdList.map((id) => ({ productId: id })),
                });
                if (!active) return;
                if (response?.success) {
                    const suggestions = Array.isArray(response.data?.suggestions)
                        ? response.data.suggestions
                        : [];
                    setComboUpsells(suggestions);
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
    }, [cartProductIdList, isDrawerOpen]);

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

    const comboSavingsPreview = round2(
        comboUpsells.reduce((sum, entry) => {
            const combo = entry?.combo || entry;
            return sum + Number(combo?.totalSavings || 0);
        }, 0),
    );

    const handleAddOfferProduct = async (product) => {
        if (!product) return;
        const id = product?._id || product?.id;
        if (!id || activeOfferId) return;
        setActiveOfferId(String(id));
        try {
            await addToCart(product, 1);
        } finally {
            setActiveOfferId(null);
        }
    };

    const handleAddComboUpsell = async (entry) => {
        const combo = entry?.combo || entry;
        const comboId = combo?._id || combo?.id;
        if (!comboId || activeOfferId) return;
        const activeKey = `combo-${comboId}`;
        setActiveOfferId(activeKey);
        try {
            trackEvent("combo_click", {
                comboId: String(comboId),
                comboName: combo?.name || "",
                comboSlug: combo?.slug || "",
                comboType: combo?.comboType || "",
                sectionName: "cart_upsell",
                action: "add",
            });
            await addComboToCart(combo, 1);
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
                                        : comboUpsells.length > 0
                                            ? `Unlock up to ₹${comboSavingsPreview} more with bundle deals.`
                                            : `You can save up to ₹${offerSavingsPreview} more with these add-ons.`}
                                </p>

                                <div className="space-y-3 pt-1">
                                    {comboUpsellLoading ? (
                                        <p className="text-xs text-gray-500">Loading bundle suggestions...</p>
                                    ) : comboUpsells.length > 0 ? (
                                        comboUpsells.map((entry) => {
                                            const combo = entry?.combo || entry;
                                            const comboId = combo?._id || combo?.id;
                                            const isAdding = activeOfferId === `combo-${comboId}`;
                                            const productsPreview = Array.isArray(combo?.items)
                                                ? combo.items
                                                    .map((item) => item?.productTitle || item?.name)
                                                    .filter(Boolean)
                                                    .slice(0, 3)
                                                    .join(", ")
                                                : "";
                                            const missingCount = Number(entry?.missingCount || 0);
                                            return (
                                                <div
                                                    key={comboId}
                                                    className="rounded-xl border border-amber-100 bg-white p-3 shadow-sm"
                                                >
                                                    <div className="flex gap-3">
                                                        <div className="w-16 h-16 rounded-lg border border-gray-100 bg-gray-50 flex items-center justify-center p-2 shrink-0">
                                                            <img
                                                                src={getImageUrl(combo?.thumbnail || combo?.image || "/combo_placeholder.png")}
                                                                alt={combo?.name || "Combo deal"}
                                                                className="w-full h-full object-contain"
                                                            />
                                                        </div>

                                                        <div className="min-w-0 flex-1">
                                                            <div className="flex items-center justify-between gap-2">
                                                                <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-700">
                                                                    Bundle upgrade
                                                                </p>
                                                                <span className="rounded-full bg-emerald-50 text-emerald-600 px-1.5 py-0.5 text-[9px] font-semibold whitespace-nowrap">
                                                                    Save ₹{round2(combo?.totalSavings || 0)}
                                                                </span>
                                                            </div>
                                                            <p className="line-clamp-1 text-sm font-semibold text-gray-900">
                                                                {combo?.name || "Combo Deal"}
                                                            </p>
                                                            <p className="mt-0.5 text-xs text-gray-500">
                                                                {missingCount > 0
                                                                    ? `Complete ${missingCount} more item${missingCount > 1 ? "s" : ""} to unlock this bundle.`
                                                                    : productsPreview || "Bundle curated for your cart."}
                                                            </p>

                                                            <div className="mt-2 flex items-center justify-between gap-2">
                                                                <div className="flex items-center gap-2">
                                                                    {combo?.originalTotal > combo?.comboPrice && (
                                                                        <span className="text-xs text-gray-400 line-through">
                                                                            ₹{round2(combo?.originalTotal || 0)}
                                                                        </span>
                                                                    )}
                                                                    <span className="text-sm font-extrabold text-primary">
                                                                        ₹{round2(combo?.comboPrice || 0)}
                                                                    </span>
                                                                </div>
                                                                <button
                                                                    onClick={() => handleAddComboUpsell(entry)}
                                                                    disabled={isAdding}
                                                                    className="rounded-full bg-primary text-white text-xs font-semibold px-3 py-1.5 hover:brightness-110 transition disabled:opacity-60"
                                                                >
                                                                    {isAdding ? "Adding..." : "Add Combo"}
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    ) : relatedProducts.length > 0 ? (
                                        relatedProducts.map((product) => {
                                            const productId = product?._id || product?.id;
                                            const image = product?.thumbnail || product?.images?.[0] || "/product_1.png";
                                            const name = product?.name || "Recommended product";
                                            const offer = getOfferData(product);
                                            const isAdding = activeOfferId === String(productId);

                                            return (
                                                <div
                                                    key={productId}
                                                    className="rounded-xl border border-amber-100 bg-white p-3 shadow-sm"
                                                >
                                                    <div className="flex gap-3">
                                                        <div className="w-16 h-16 rounded-lg border border-gray-100 bg-gray-50 flex items-center justify-center p-2 shrink-0">
                                                            <img
                                                                src={getImageUrl(image)}
                                                                alt={name}
                                                                className="w-full h-full object-contain"
                                                            />
                                                        </div>

                                                        <div className="min-w-0 flex-1">
                                                            <div className="flex items-center justify-between gap-2">
                                                                <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-700">
                                                                    You may also like
                                                                </p>
                                                                <span className="rounded-full bg-red-50 text-red-600 px-1.5 py-0.5 text-[9px] font-semibold whitespace-nowrap">
                                                                    {offer.percentOff}% OFF
                                                                </span>
                                                            </div>
                                                            <Link
                                                                href={`/product/${productId}`}
                                                                onClick={handleCloseCart}
                                                                className="line-clamp-1 text-sm font-semibold text-gray-900 hover:text-primary"
                                                            >
                                                                {name}
                                                            </Link>
                                                            <p className="mt-0.5 text-xs text-gray-500">
                                                                Earlier price ₹{offer.originalPrice}, now only ₹{offer.discountedPrice}
                                                            </p>

                                                            <div className="mt-2 flex items-center justify-between gap-2">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-xs text-gray-400 line-through">
                                                                        ₹{offer.originalPrice}
                                                                    </span>
                                                                    <span className="text-sm font-extrabold text-primary">
                                                                        ₹{offer.discountedPrice}
                                                                    </span>
                                                                </div>
                                                                <button
                                                                    onClick={() => handleAddOfferProduct(product)}
                                                                    disabled={isAdding}
                                                                    className="rounded-full bg-primary text-white text-xs font-semibold px-3 py-1.5 hover:brightness-110 transition disabled:opacity-60"
                                                                >
                                                                    {isAdding ? "Adding..." : "Add"}
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })
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
