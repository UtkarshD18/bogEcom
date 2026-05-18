"use client";

import { useCart } from "@/context/CartContext";
import { useShippingDisplayCharge } from "@/hooks/useShippingDisplayCharge";
import { fetchDataFromApi } from "@/utils/api";
import { round2 } from "@/utils/gst";
import { getImageUrl } from "@/utils/imageUtils";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
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
    addToCart,
    addComboToCart,
  } = useCart();
  const { displayShippingCharge } = useShippingDisplayCharge();
  const router = useRouter();
  const [upsellLoading, setUpsellLoading] = useState(false);
  const [upsellCombo, setUpsellCombo] = useState(null);
  const [upsellProducts, setUpsellProducts] = useState([]);
  const COMBO_FALLBACK_IMAGE = "/product_1.webp";

  const subtotal = round2(cartSubTotalAmount || 0);
  const shippingCost = 0;
  const total = round2(subtotal + shippingCost);
  const displaySubtotal = Math.max(Math.round(subtotal), 0);
  const displayTotal = Math.max(Math.round(total), 0);

  const handleCloseCart = () => setIsDrawerOpen(false);
  const handleStartShopping = () => setIsDrawerOpen(false);

  const handleCheckout = () => {
    setIsDrawerOpen(false);
    router.push("/checkout");
  };

  const resolveProductId = (item) => {
    if (!item) return null;
    if (item.parentProductId) return item.parentProductId;
    if (item.productId) return item.productId;
    if (item.product && typeof item.product === "object") {
      return item.product.parentProductId || item.product._id || item.product.id || null;
    }
    if (item.product) return item.product;
    if (item.productData)
      return (
        item.productData.parentProductId ||
        item.productData.productId ||
        item.productData._id ||
        item.productData.id ||
        null
      );
    return item._id || item.id || null;
  };

  const resolveVariantId = (item) => {
    if (!item) return null;
    const raw =
      item?.variant?._id ||
      item?.variant?.id ||
      item?.variantId ||
      (typeof item?.variant === "string" ? item.variant : null) ||
      item?.selectedVariant?._id ||
      item?.selectedVariant?.id ||
      null;
    return raw ? String(raw).trim() : null;
  };

  const normalizeVariantNameKey = (value) =>
    String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "");

  const getItemData = (item) => {
    if (isComboCartItem(item)) {
      const comboSnapshot =
        item?.comboSnapshot && typeof item.comboSnapshot === "object"
          ? item.comboSnapshot
          : {};
      const comboDoc =
        item?.combo && typeof item.combo === "object" ? item.combo : {};
      const combo = {
        ...comboDoc,
        ...comboSnapshot,
      };
      const comboItems = Array.isArray(combo?.items) ? combo.items : [];
      const comboId =
        combo?.comboId ||
        comboSnapshot?.comboId ||
        comboDoc?._id ||
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
        image:
          comboSnapshot?.comboThumbnail ||
          comboDoc?.comboThumbnail ||
          combo?.comboThumbnail ||
          comboSnapshot?.thumbnail ||
          comboDoc?.thumbnail ||
          combo?.thumbnail ||
          comboSnapshot?.image ||
          comboDoc?.image ||
          combo?.image ||
          comboSnapshot?.comboImages?.[0] ||
          comboDoc?.comboImages?.[0] ||
          combo?.comboImages?.[0] ||
          comboItems?.[0]?.image ||
          item?.image ||
          COMBO_FALLBACK_IMAGE,
        price: Number(item?.price ?? combo?.comboPrice ?? 0),
        originalPrice: Number(
          item?.originalPrice ??
            combo?.originalPrice ??
            combo?.originalTotal ??
            0,
        ),
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
      image:
        product?.thumbnail ||
        product?.images?.[0] ||
        item?.image ||
        "/product_1.webp",
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
  const displayCartSavings = Math.max(Math.round(cartSavings), 0);

  const upsellRequestItems = useMemo(() => {
    const normalized = [];
    for (const item of cartItems) {
      const isComboLine =
        item?.itemType === "combo" ||
        Boolean(item?.combo || item?.comboSnapshot?.comboId);

      if (isComboLine) {
        const comboSnapshot =
          item?.comboSnapshot && typeof item.comboSnapshot === "object"
            ? item.comboSnapshot
            : {};
        const comboDoc =
          item?.combo && typeof item.combo === "object" ? item.combo : {};
        const combo = {
          ...comboDoc,
          ...comboSnapshot,
        };
        const comboItems = Array.isArray(combo?.items) ? combo.items : [];
        for (const comboItem of comboItems) {
          const productId = String(comboItem?.productId || "").trim();
          if (!productId) continue;
          const variantId = String(comboItem?.variantId || "").trim();
          const variantName = String(comboItem?.variantName || "").trim();
          normalized.push({
            productId,
            variantId: variantId || undefined,
            variantName: variantName || undefined,
          });
        }
        continue;
      }

      const productId = String(resolveProductId(item) || "").trim();
      if (!productId) continue;
      const variantId = String(resolveVariantId(item) || "").trim();
      const variantName = String(
        item?.variantName || item?.selectedVariant?.name || "",
      ).trim();
      normalized.push({
        productId,
        variantId: variantId || undefined,
        variantName: variantName || undefined,
      });
    }

    const deduped = [];
    const seen = new Set();
    for (const entry of normalized) {
      const key = `${entry.productId}:${entry.variantId || ""}:${normalizeVariantNameKey(entry.variantName)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(entry);
    }
    return deduped;
  }, [cartItems]);

  const upsellRequestKey = useMemo(
    () =>
      upsellRequestItems
        .map(
          (item) =>
            `${String(item?.productId || "").trim()}:${String(item?.variantId || "").trim()}:${normalizeVariantNameKey(item?.variantName)}`,
        )
        .sort()
        .join("|"),
    [upsellRequestItems],
  );

  const normalizeUpsellCombo = (entry) => {
    if (!entry || typeof entry !== "object") return null;
    if (entry.combo && typeof entry.combo === "object") return entry;
    return {
      combo: entry,
      missingCount: Number(entry?.missingCount || 0),
      missingProductIds: Array.isArray(entry?.missingProductIds)
        ? entry.missingProductIds
        : [],
    };
  };

  const normalizeUpsellProduct = (entry) => {
    if (!entry || typeof entry !== "object") return null;
    if (entry.recommendation && typeof entry.recommendation === "object") {
      return entry;
    }
    if (entry.product && typeof entry.product === "object") {
      return { recommendation: entry };
    }
    return null;
  };

  useEffect(() => {
    let active = true;
    const fetchUpsells = async () => {
      if (!isDrawerOpen || upsellRequestItems.length < 2) {
        setUpsellCombo(null);
        setUpsellProducts([]);
        setUpsellLoading(false);
        return;
      }

      setUpsellLoading(true);
      try {
        const response = await fetchDataFromApi("/api/cart/recommendations", {
          skipCache: true,
          dedupe: false,
        });
        if (!active) return;

        if (response?.success) {
          const normalizedCombo = normalizeUpsellCombo(
            response?.data?.combo || null,
          );
          const normalizedProducts = Array.isArray(response?.data?.products)
            ? response.data.products
                .map((entry) => normalizeUpsellProduct(entry))
                .filter(Boolean)
                .slice(0, 2)
            : [];

          setUpsellCombo(normalizedCombo);
          setUpsellProducts(normalizedProducts);
        } else {
          setUpsellCombo(null);
          setUpsellProducts([]);
        }
      } catch {
        if (!active) return;
        setUpsellCombo(null);
        setUpsellProducts([]);
      } finally {
        if (active) setUpsellLoading(false);
      }
    };

    fetchUpsells();
    return () => {
      active = false;
    };
  }, [isDrawerOpen, upsellRequestItems, upsellRequestKey]);

  const upsellComboData = upsellCombo?.combo || null;
  const upsellComboSavings = round2(Number(upsellComboData?.totalSavings || 0));
  const upsellComboPrice = Number(
    upsellComboData?.comboPrice ?? upsellComboData?.price ?? 0,
  );
  const upsellComboOriginal = Number(
    upsellComboData?.originalPrice ??
      upsellComboData?.originalTotal ??
      upsellComboPrice,
  );
  const upsellComboTitle = String(
    upsellComboData?.name || upsellComboData?.comboName || "",
  ).trim();
  const displayUpsellComboPrice = Math.max(Math.round(upsellComboPrice), 0);
  const displayUpsellComboOriginal = Math.max(
    Math.round(upsellComboOriginal),
    0,
  );
  const displayUpsellComboSavings = Math.max(Math.round(upsellComboSavings), 0);

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
                <p className="text-lg font-bold text-gray-900">
                  Your cart is empty
                </p>
                <p className="text-sm text-gray-500">
                  Looks like you haven&apos;t added anything yet.
                </p>
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
                  const variantId = resolveVariantId(item);
                  const isComboLine = data.itemType === "combo";

                  return (
                    <div
                      key={`${data.id}-${variantId || "base"}`}
                      className="flex gap-4 p-3 rounded-2xl bg-white border border-gray-100 shadow-sm"
                    >
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
                            <h4 className="text-sm font-bold text-gray-900 line-clamp-1">
                              {data.name}
                            </h4>
                            <p className="text-xs text-gray-500">
                              {data.brand}
                              {data.quantityUnit
                                ? ` • ${data.quantityUnit}`
                                : ""}
                            </p>
                          </div>
                          <button
                            onClick={() =>
                              isComboLine
                                ? removeComboFromCart(data.id)
                                : removeFromCart(
                                    productId || data.id,
                                    variantId,
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
                                      variantId,
                                    )
                              }
                              className="w-6 h-6 flex items-center justify-center rounded-full bg-white shadow-sm text-gray-600 hover:text-red-500 active:scale-90 transition-all"
                            >
                              <MdRemove size={14} />
                            </button>
                            <span className="text-sm font-bold w-4 text-center">
                              {data.quantity}
                            </span>
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
                                      variantId,
                                    )
                              }
                              className="w-6 h-6 flex items-center justify-center rounded-full bg-white shadow-sm text-gray-600 hover:text-primary active:scale-90 transition-all"
                            >
                              <MdAdd size={14} />
                            </button>
                          </div>
                          <span className="text-sm font-bold text-primary">
                            ₹
                            {Math.max(
                              Math.round(data.price * data.quantity),
                              0,
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </section>

              <div className="my-6 border-t border-gray-200" />

              {cartItems.length >= 2 && (
                <section className="mb-6 rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <p className="text-sm font-bold uppercase tracking-[0.12em] text-gray-900 flex items-center gap-1">
                      <span className="text-amber-500">⚡</span> Limited Time
                      Offer
                    </p>
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold text-white bg-amber-500">
                      LIMITED TIME DEAL
                    </span>
                  </div>

                  <p className="text-sm text-gray-600 mb-1">
                    Limited time offer - grab this at a discounted price.
                  </p>
                  {cartSavings > 0 && (
                    <p className="text-sm font-semibold text-emerald-700 mb-2">
                      You&apos;re saving ₹{displayCartSavings} on this order.
                    </p>
                  )}

                  {upsellLoading &&
                    !upsellComboData &&
                    upsellProducts.length === 0 && (
                      <p className="text-sm text-gray-500">
                        Loading bundle suggestions...
                      </p>
                    )}

                  <div className="space-y-3">
                    {upsellComboData && (
                      <div className="rounded-xl bg-white border border-amber-100 p-3">
                        <div className="flex items-center gap-3">
                          <img
                            src={getImageUrl(
                              upsellComboData?.comboThumbnail ||
                                upsellComboData?.thumbnail ||
                                upsellComboData?.image ||
                                upsellComboData?.comboImages?.[0] ||
                                COMBO_FALLBACK_IMAGE,
                            )}
                            alt={upsellComboTitle || "Combo suggestion"}
                            className="w-14 h-14 rounded-lg object-cover bg-gray-100"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-gray-900 line-clamp-1">
                              {upsellComboTitle || "Suggested Combo"}
                            </p>
                            <p className="text-xs text-emerald-700 font-semibold">
                              Save ₹{displayUpsellComboSavings}
                              {Number(upsellCombo?.missingCount || 0) > 0
                                ? ` by adding ${upsellCombo.missingCount} item${
                                    Number(upsellCombo.missingCount) > 1
                                      ? "s"
                                      : ""
                                  }`
                                : ""}
                            </p>
                            <p className="text-xs font-semibold text-gray-900 mt-0.5">
                              ₹{displayUpsellComboPrice}
                              {upsellComboOriginal > upsellComboPrice && (
                                <span className="line-through text-gray-400 ml-2 font-medium">
                                  ₹{displayUpsellComboOriginal}
                                </span>
                              )}
                            </p>
                          </div>
                          <button
                            onClick={() => addComboToCart(upsellComboData, 1)}
                            className="px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
                          >
                            Add Combo
                          </button>
                        </div>
                      </div>
                    )}

                    {upsellProducts.map((upsellProduct, index) => {
                      const upsellProductData =
                        upsellProduct?.recommendation || null;
                      const upsellProductEntity =
                        upsellProductData?.product ||
                        upsellProduct?.product ||
                        null;
                      if (!upsellProductEntity) return null;

                      const upsellProductPrice = Number(
                        upsellProductData?.price || 0,
                      );
                      const upsellProductOriginal = Number(
                        upsellProductData?.originalPrice || upsellProductPrice,
                      );
                      const displayUpsellProductPrice = Math.max(
                        Math.round(upsellProductPrice),
                        0,
                      );
                      const displayUpsellProductOriginal = Math.max(
                        Math.round(upsellProductOriginal),
                        0,
                      );
                      const displayUpsellProductSavings = Math.max(
                        Math.round(
                          Math.max(
                            upsellProductOriginal - upsellProductPrice,
                            0,
                          ),
                        ),
                        0,
                      );

                      return (
                      <div
                        key={`${String(upsellProductEntity?._id || upsellProductEntity?.id || "addon")}-${String(upsellProductData?.variant?._id || "base")}-${index}`}
                        className="rounded-xl bg-white border border-amber-100 p-3"
                      >
                        <div className="flex items-center gap-3">
                          <img
                            src={getImageUrl(
                              upsellProductData?.image ||
                                upsellProductEntity?.thumbnail ||
                                upsellProductEntity?.images?.[0] ||
                                "/product_1.webp",
                            )}
                            alt={
                              upsellProductEntity?.name || "Product suggestion"
                            }
                            className="w-14 h-14 rounded-lg object-cover bg-gray-100"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-gray-900 line-clamp-1">
                              {upsellProductEntity?.name || "Suggested Product"}
                            </p>
                            <p className="text-xs text-emerald-700 font-semibold">
                              Save ₹{displayUpsellProductSavings} on this add-on
                            </p>
                            <p className="text-xs font-semibold text-gray-900 mt-0.5">
                              ₹{displayUpsellProductPrice}
                              {upsellProductOriginal > upsellProductPrice && (
                                <span className="line-through text-gray-400 ml-2 font-medium">
                                  ₹{displayUpsellProductOriginal}
                                </span>
                              )}
                            </p>
                          </div>
                          <button
                            onClick={() =>
                              addToCart(
                                {
                                  ...upsellProductEntity,
                                  price: upsellProductPrice,
                                  originalPrice: upsellProductOriginal,
                                  selectedVariant:
                                    upsellProductData?.variant || undefined,
                                  variantId:
                                    upsellProductData?.variant?._id ||
                                    undefined,
                                },
                                1,
                              )
                            }
                            className="px-3 py-1.5 rounded-full text-xs font-bold bg-sky-600 text-white hover:bg-sky-700 transition-colors"
                          >
                            Add Product
                          </button>
                        </div>
                      </div>
                      );
                    })}
                  </div>
                </section>
              )}

              <section className="rounded-2xl border border-gray-100 bg-gray-50/60 p-4">
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Subtotal</span>
                    <span className="font-bold text-gray-900">
                      ₹{displaySubtotal}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Shipping</span>
                    <span className="font-bold text-primary flex items-center gap-2">
                      {displayShippingCharge > 0 && (
                        <span className="line-through text-gray-500">
                          ₹{displayShippingCharge.toFixed(2)}
                        </span>
                      )}
                      <span>₹0.00</span>
                    </span>
                  </div>
                  {cartSavings > 0 && (
                    <div className="flex justify-between text-sm text-emerald-700">
                      <span>You&apos;re saving</span>
                      <span className="font-bold">₹{displayCartSavings}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-lg font-extrabold mt-2 pt-2 border-t border-gray-200">
                    <span>Total</span>
                    <span>₹{displayTotal}</span>
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
