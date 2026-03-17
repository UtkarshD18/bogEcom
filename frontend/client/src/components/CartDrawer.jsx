"use client";

import { useCart } from "@/context/CartContext";
import { useShippingDisplayCharge } from "@/hooks/useShippingDisplayCharge";
import { round2 } from "@/utils/gst";
import { getImageUrl } from "@/utils/imageUtils";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { IoBagCheckOutline, IoCartOutline, IoClose } from "react-icons/io5";
import { MdAdd, MdDeleteOutline, MdRemove } from "react-icons/md";

const CartDrawer = () => {
  const {
    isDrawerOpen,
    setIsDrawerOpen,
    cartItems,
    removeFromCart,
    removeComboFromCart,
    updateQuantity,
    updateComboQuantity,
    isComboCartItem,
    cartSubTotalAmount,
    orderNote,
    setOrderNote,
  } = useCart();
  const { displayShippingCharge } = useShippingDisplayCharge();
  const router = useRouter();

  const subtotal = round2(cartSubTotalAmount || 0);
  const shippingCost = 0;
  const total = round2(subtotal + shippingCost);

  const handleCloseCart = () => setIsDrawerOpen(false);
  const handleStartShopping = () => setIsDrawerOpen(false);

  const handleCheckout = () => {
    setIsDrawerOpen(false);
    router.push("/checkout");
  };

  const resolveProductId = (item) => {
    if (!item) return null;
    if (item.product && typeof item.product === "object") {
      return item.product._id || item.product.id || null;
    }
    if (item.product) return item.product;
    if (item.productData) return item.productData._id || item.productData.id || null;
    return item._id || item.id || null;
  };

  const getItemData = (item) => {
    if (isComboCartItem(item)) {
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

      const preview = comboItems
        .map((entry) => entry?.productTitle || entry?.name)
        .filter(Boolean)
        .slice(0, 2)
        .join(", ");

      return {
        id: comboId,
        name: combo?.comboName || combo?.name || "Combo Bundle",
        image: combo?.thumbnail || combo?.image || item?.image || "/combo_placeholder.png",
        price: Number(item?.price ?? combo?.comboPrice ?? 0),
        originalPrice: Number(item?.originalPrice ?? combo?.originalPrice ?? combo?.originalTotal ?? 0),
        brand: "Combo Deal",
        quantity: Number(item?.quantity || 1),
        quantityUnit: preview || "Bundle",
        itemType: "combo",
      };
    }

    const product = item?.productData || item?.product || item;
    const productId = resolveProductId(item);
    const variantName = item?.variantName || item?.selectedVariant?.name || "";

    return {
      id: productId || item?._id || item?.id,
      name: product?.name || item?.name || "Product",
      image: product?.thumbnail || product?.images?.[0] || item?.image || "/product_1.png",
      price: Number(item?.price ?? product?.price ?? 0),
      originalPrice: Number(item?.originalPrice ?? product?.originalPrice ?? 0),
      brand: product?.brand || "BOG",
      quantity: Number(item?.quantity || 1),
      quantityUnit: variantName || "Per Unit",
      itemType: "product",
    };
  };

  const cartSavings = round2(
    cartItems.reduce((sum, item) => {
      const data = getItemData(item);
      const qty = Number(data?.quantity || 1);
      const discountedPrice = Number(data?.price || 0);
      const originalPrice = Number(data?.originalPrice || 0);
      if (originalPrice > discountedPrice) {
        return sum + (originalPrice - discountedPrice) * qty;
      }
      return sum;
    }, 0),
  );

  return (
    <>
      <div
        className={`fixed inset-0 z-[120] bg-black/45 backdrop-blur-[2px] transition-opacity duration-300 ${
          isDrawerOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={handleCloseCart}
      />

      <div
        className={`fixed inset-y-0 right-0 z-[121] h-full w-full bg-white shadow-2xl transition-transform duration-300 md:max-w-md flex flex-col ${
          isDrawerOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <IoCartOutline size={24} className="text-primary" />
            Shopping Cart
            <span className="text-sm font-normal text-gray-500 ml-2">
              ({cartItems.length} items)
            </span>
          </h2>
          <button
            onClick={handleCloseCart}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors"
          >
            <IoClose size={24} />
          </button>
        </div>

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
                        <img src={getImageUrl(data.image)} alt={data.name} className="w-full h-full object-contain" />
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
                                : removeFromCart(productId || data.id, item?.variant || null)
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
                                  ? updateComboQuantity(data.id, Number(data.quantity) - 1)
                                  : updateQuantity(productId || data.id, Number(data.quantity) - 1, item?.variant || null)
                              }
                              className="w-6 h-6 flex items-center justify-center rounded-full bg-white shadow-sm text-gray-600 hover:text-red-500 active:scale-90 transition-all"
                            >
                              <MdRemove size={14} />
                            </button>
                            <span className="text-sm font-bold w-4 text-center">{data.quantity}</span>
                            <button
                              onClick={() =>
                                isComboLine
                                  ? updateComboQuantity(data.id, Number(data.quantity) + 1)
                                  : updateQuantity(productId || data.id, Number(data.quantity) + 1, item?.variant || null)
                              }
                              className="w-6 h-6 flex items-center justify-center rounded-full bg-white shadow-sm text-gray-600 hover:text-primary active:scale-90 transition-all"
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
                        <span className="line-through text-gray-500">₹{displayShippingCharge.toFixed(2)}</span>
                      )}
                      <span>₹0.00</span>
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
                    onChange={(event) => setOrderNote(event.target.value)}
                    className="w-full text-sm p-3 rounded-xl border border-gray-200 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary resize-none h-20 bg-white"
                  />
                </div>

                <button
                  onClick={handleCheckout}
                  className="w-full py-4 rounded-full bg-linear-to-r from-primary to-[var(--flavor-hover)] text-white font-bold text-lg shadow-lg shadow-primary/30 hover:shadow-xl hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  Checkout <IoBagCheckOutline size={20} />
                </button>
                <p className="text-[10px] text-center text-gray-400 mt-3 flex items-center justify-center gap-1">
                  <IoCartOutline /> Secure Checkout
                </p>
              </section>
            </>
          )}
        </div>
      </div>
    </>
  );
};

export default CartDrawer;
