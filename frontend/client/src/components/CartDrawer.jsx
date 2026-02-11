"use client";

import { useCart } from "@/context/CartContext";
import { useProducts } from "@/context/ProductContext";
import { useSettings } from "@/context/SettingsContext";
import { round2 } from "@/utils/gst";
import { getImageUrl } from "@/utils/imageUtils";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { IoBagCheckOutline, IoCartOutline, IoClose } from "react-icons/io5";
import { MdAdd, MdRemove, MdDeleteOutline } from "react-icons/md";
import ProductItem from "./ProductItem";

import "swiper/css";
import "swiper/css/navigation";

const CartDrawer = () => {
    const {
        isDrawerOpen,
        setIsDrawerOpen,
        cartItems,
        removeFromCart,
        updateQuantity,
        cartSubTotalAmount,
        orderNote,
        setOrderNote,
    } = useCart();
    const { products } = useProducts();
    const { calculateShipping } = useSettings();
    const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);
    const router = useRouter();
    const subtotal = round2(cartSubTotalAmount || 0);
    const shippingCost =
        cartItems.length > 0 ? round2(calculateShipping(subtotal)) : 0;
    const total = round2(subtotal + shippingCost);
    const isFreeShipping = shippingCost === 0;

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

    // Find related products (simple logic: same category or just first few)
    const relatedProducts = products?.slice(0, 5) || [];

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

    // Helper to normalize cart item data
    const getItemData = (item) => {
        const product = resolveProductData(item);
        const productId = resolveProductId(item);

        return {
            id: productId || product?._id || product?.id || item._id || item.id,
            name: product?.name || item?.name || item?.title || "Product",
            image:
                product?.thumbnail ||
                product?.images?.[0] ||
                item?.image ||
                "/product_1.png",
            price: Number(product?.price || item?.price || 0),
            brand: product?.brand || item?.brand || "BOG",
            quantity: Number(item?.quantity || 1),
            quantityUnit:
                product?.quantityUnit || item?.quantityUnit || "Per Unit",
        };
    };

    return (
        <>
            {/* Backdrop */}
            <div
                className={`fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm transition-opacity duration-300 ${isDrawerOpen ? "opacity-100" : "opacity-0 pointer-events-none"
                    }`}
                onClick={handleCloseCart}
            />

            {/* Drawer */}
            <div
                className={`fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl transition-transform duration-300 z-[101] flex flex-col ${isDrawerOpen ? "translate-x-0" : "translate-x-full"
                    }`}
                style={{ background: "#ffffff" }}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-gray-100">
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

                {/* Cart Items */}
                <div className="flex-1 overflow-y-auto px-5 py-2">
                    {cartItems.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
                            <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center">
                                <IoCartOutline size={40} className="text-gray-300" />
                            </div>
                            <div>
                                <p className="text-lg font-bold text-gray-900">Your cart is empty</p>
                                <p className="text-sm text-gray-500">Looks like you haven't added anything yet.</p>
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
                        <div className="space-y-4 mt-2">
                            {cartItems.map((item, index) => {
                                const data = getItemData(item);
                                const productId = resolveProductId(item);
                                return (
                                    <div key={data.id} className="flex gap-4 p-3 rounded-2xl bg-white border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                                        {/* Image */}
                                        <div className="w-20 h-20 shrink-0 bg-white rounded-xl flex items-center justify-center p-2 border border-gray-100">
                                            <img
                                                src={getImageUrl(data.image)}
                                                alt={data.name}
                                                className="w-full h-full object-contain"
                                            />
                                        </div>

                                        {/* Details */}
                                        <div className="flex-1 flex flex-col justify-between">
                                            <div>
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="min-w-0">
                                                        <h4 className="text-sm font-bold text-gray-900 line-clamp-1">{data.name}</h4>
                                                        <p className="text-xs text-gray-500">{data.brand}</p>
                                                    </div>
                                                    <button
                                                        onClick={() => removeFromCart(productId || data.id)}
                                                        className="p-1.5 rounded-full text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all active:scale-90"
                                                        aria-label="Remove item"
                                                    >
                                                        <MdDeleteOutline size={16} />
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-between mt-2">
                                                <div className="flex items-center gap-3 bg-gray-50 rounded-full px-2 py-1">
                                                    <button
                                                        onClick={() => updateQuantity(productId || data.id, Number(data.quantity) - 1)}
                                                        className="w-6 h-6 flex items-center justify-center rounded-full bg-white shadow-sm text-gray-600 hover:text-red-500 active:scale-90 transition-all"
                                                    >
                                                        <MdRemove size={14} />
                                                    </button>
                                                    <span className="text-sm font-bold w-4 text-center">{data.quantity}</span>
                                                    <button
                                                        onClick={() => updateQuantity(productId || data.id, Number(data.quantity) + 1)}
                                                        disabled={Number(data.quantity) >= (item.product?.stock || item.productData?.stock || item.stock || Infinity)}
                                                        className="w-6 h-6 flex items-center justify-center rounded-full bg-white shadow-sm text-gray-600 hover:text-primary active:scale-90 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                                                    >
                                                        <MdAdd size={14} />
                                                    </button>
                                                </div>
                                                <span className="text-sm font-bold text-primary">₹{data.price * data.quantity}</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* You might like */}
                    {cartItems.length > 0 && (
                        <div className="mt-8 mb-4">
                            <h3 className="text-sm font-bold text-gray-900 mb-3">You might also like</h3>
                            <div className="flex gap-3 overflow-x-auto pb-4 -mx-5 px-5 scrollbar-none">
                                {relatedProducts.map((product, idx) => (
                                    <div key={product._id || product.id || idx} className="min-w-[140px]">
                                        <ProductItem id={product._id || product.id} {...product} />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                {cartItems.length > 0 && (
                    <div className="p-5 border-t border-gray-100 bg-gray-50/50">
                        <div className="space-y-2 mb-4">
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-500">Subtotal</span>
                                <span className="font-bold text-gray-900">₹{subtotal}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-500">Shipping</span>
                                <span className={isFreeShipping ? "font-bold text-primary" : "font-bold text-gray-900"}>
                                    {isFreeShipping ? "FREE" : `₹${shippingCost}`}
                                </span>
                            </div>
                            <div className="flex justify-between text-lg font-extrabold mt-2 pt-2 border-t border-gray-200">
                                <span>Total</span>
                                <span>₹{total}</span>
                            </div>
                        </div>

                        {/* Note Input */}
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
                    </div>
                )}
            </div >
        </>
    );
};

export default CartDrawer;
