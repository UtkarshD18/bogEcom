"use client";

import { useCart } from "@/context/CartContext";
import { useProducts } from "@/context/ProductContext";
import { useShippingDisplayCharge } from "@/hooks/useShippingDisplayCharge";
import { round2 } from "@/utils/gst";
import { getImageUrl } from "@/utils/imageUtils";
import Link from "next/link";
import { MdAdd, MdDeleteOutline, MdRemove, MdShoppingBag } from "react-icons/md";

export default function CartPage() {
    const {
        cartItems,
        removeFromCart,
        updateQuantity,
        cartSubTotalAmount,
    } = useCart();
    const { products } = useProducts();
    const { displayShippingCharge } = useShippingDisplayCharge();
    const subtotal = round2(cartSubTotalAmount || 0);
    const shippingCost = 0; // DISPLAY-ONLY shipping is shown struck-through below.
    const total = round2(subtotal + shippingCost);

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
        };
    };

    const cartSavings = round2(
        cartItems.reduce((sum, item) => {
            const data = getItemData(item);
            if (data.originalPrice > data.price) {
                return sum + (data.originalPrice - data.price) * data.quantity;
            }
            return sum;
        }, 0),
    );

    if (cartItems.length === 0) {
        return (
            <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center">
                <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center mb-6 animate-bounce">
                    <MdShoppingBag size={48} className="text-gray-300" />
                </div>
                <h1 className="text-2xl font-black text-gray-900 mb-2">Your cart is empty</h1>
                <p className="text-gray-500 mb-8 max-w-xs">Looks like you haven't added any peanut butter goodness yet!</p>
                <Link
                    href="/products"
                    className="px-8 py-4 bg-primary text-white font-black rounded-2xl shadow-lg shadow-primary/20 hover:brightness-110 transition-all active:scale-95"
                >
                    Start Shopping
                </Link>
            </div>
        );
    }

    return (
        <div className="min-h-screen pb-20 pt-10 px-4">
            <div className="max-w-6xl mx-auto">
                <h1 className="text-4xl md:text-5xl font-black text-gray-900 tracking-tight mb-10">
                    Your <span className="text-primary">Cart</span>
                </h1>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                    {/* Cart Items List */}
                    <div className="lg:col-span-2 space-y-6">
                        {cartItems.filter(item => {
                            const pid = resolveProductId(item);
                            const pd = resolveProductData(item);
                            return pid && pd?.name;
                        }).map((item, index) => {
                            const data = getItemData(item);
                            const productId = resolveProductId(item);
                            return (
                                <div
                                    key={`${data.id || index}-${item?.variant || item?.variantId || "base"}`}
                                    className="group relative flex flex-col sm:flex-row gap-6 p-6 rounded-[2.5rem] bg-white border border-gray-100 shadow-sm hover:shadow-xl hover:border-primary/20 transition-all duration-500"
                                >
                                    {/* Image */}
                                    <div className="w-full sm:w-32 h-32 rounded-3xl overflow-hidden bg-white flex items-center justify-center shrink-0 border border-gray-100 group-hover:scale-105 transition-transform duration-500 p-2">
                                        <img
                                            src={getImageUrl(data.image)}
                                            alt={data.name}
                                            className="w-full h-full object-contain"
                                        />
                                    </div>

                                    {/* Details */}
                                    <div className="flex-1 flex flex-col justify-between py-2">
                                        <div>
                                            <div className="flex justify-between items-start mb-2">
                                                <div>
                                                    <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-1">{data.brand}</p>
                                                    <h3 className="text-lg font-black text-gray-900 leading-tight group-hover:text-primary transition-colors uppercase tracking-tight">
                                                        {data.name}
                                                    </h3>
                                                </div>
                                                <button
                                                    onClick={() =>
                                                      removeFromCart(
                                                        productId || data.id,
                                                        item?.variant || null,
                                                      )
                                                    }
                                                    className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-all active:scale-90"
                                                >
                                                    <MdDeleteOutline size={24} />
                                                </button>
                                            </div>
                                            <p className="text-sm text-gray-400 font-medium">Quantity Basis: {data.quantityUnit}</p>
                                        </div>

                                        <div className="flex items-center justify-between mt-auto">
                                            <div className="flex items-center gap-4 bg-gray-50 p-1 rounded-2xl border border-gray-100">
                                                <button
                                                    onClick={() =>
                                                      updateQuantity(
                                                        productId || data.id,
                                                        Number(data.quantity) - 1,
                                                        item?.variant || null,
                                                      )
                                                    }
                                                    className="w-10 h-10 flex items-center justify-center rounded-xl bg-white shadow-sm text-gray-600 hover:text-primary active:scale-90 transition-all"
                                                >
                                                    <MdRemove size={18} />
                                                </button>
                                                <span className="text-lg font-black w-6 text-center text-gray-900">{data.quantity}</span>
                                                <button
                                                    onClick={() =>
                                                      updateQuantity(
                                                        productId || data.id,
                                                        Number(data.quantity) + 1,
                                                        item?.variant || null,
                                                      )
                                                    }
                                                    className="w-10 h-10 flex items-center justify-center rounded-xl bg-white shadow-sm text-gray-600 hover:text-primary active:scale-90 transition-all"
                                                >
                                                    <MdAdd size={18} />
                                                </button>
                                            </div>
                                            <div className="text-right">
                                                {data.originalPrice > data.price && (
                                                    <p className="text-xs text-gray-400 font-bold line-through">
                                                        ₹{round2(data.originalPrice * data.quantity)}
                                                    </p>
                                                )}
                                                <p className="text-2xl font-black text-primary tracking-tight">
                                                    ₹{round2(data.price * data.quantity)}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Order Summary */}
                    <div className="lg:col-span-1">
                        <div className="sticky top-32 p-8 rounded-[3rem] bg-gray-900 text-white shadow-2xl overflow-hidden">
                            {/* Decorative Glow */}
                            <div className="absolute top-[-20%] right-[-20%] w-40 h-40 bg-primary/20 blur-[80px] rounded-full pointer-events-none" />

                            <h2 className="text-2xl font-black mb-8 border-b border-white/10 pb-4 tracking-tight">Summary</h2>

                            <div className="space-y-4 mb-8">
                                <div className="flex justify-between text-gray-400 font-bold uppercase tracking-widest text-[11px]">
                                    <span>Subtotal</span>
                                    <span className="text-white">₹{subtotal}</span>
                                </div>
                                <div className="flex justify-between text-gray-400 font-bold uppercase tracking-widest text-[11px]">
                                    <span>Shipping</span>
                                    <span className="text-primary flex items-center gap-2">
                                        {displayShippingCharge > 0 && (
                                            <span className="line-through text-gray-500">
                                                &#8377;{displayShippingCharge.toFixed(2)}
                                            </span>
                                        )}
                                        <span>&#8377;0.00</span>
                                    </span>
                                </div>
                                <div className="pt-6 border-t border-white/10 flex justify-between items-end">
                                    <div>
                                        <p className="text-gray-400 font-bold uppercase tracking-widest text-[11px] mb-1">Total Amount</p>
                                        <p className="text-3xl font-black text-white tracking-tight">₹{total}</p>
                                    </div>
                                    <div className="text-right">
                                        {cartSavings > 0 && (
                                            <p className="text-primary font-black text-xs">
                                                SAVING ₹{round2(cartSavings)}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <Link
                                href="/checkout"
                                className="w-full py-5 bg-primary text-white font-black text-center rounded-2xl block shadow-xl shadow-primary/20 hover:brightness-110 transform hover:scale-[1.02] active:scale-95 transition-all"
                            >
                                CHECKOUT NOW
                            </Link>

                            <p className="text-center text-[10px] text-gray-500 mt-6 font-bold uppercase tracking-widest">
                                🔒 Secure Checkout
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
