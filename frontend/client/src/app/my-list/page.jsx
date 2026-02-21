"use client";

import AccountSidebar from "@/components/AccountSiderbar";
import { useCart } from "@/context/CartContext";
import { useWishlist } from "@/context/WishlistContext";
import { Alert, Button, CircularProgress, Snackbar } from "@mui/material";
import Rating from "@mui/material/Rating";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FaHeart } from "react-icons/fa";
import { IoMdClose } from "react-icons/io";

const MyWishlistPage = () => {
  const router = useRouter();
  const { addToCart } = useCart();
  const { wishlistItems, wishlistCount, loading, removeFromWishlist, removingItems } =
    useWishlist();
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success",
  });

  const getProduct = (item) =>
    item.product && typeof item.product === "object"
      ? item.product
      : item.productData || item;

  const getDisplayQuantity = (item) => {
    const parsed = Number(item?.quantity || 1);
    if (!Number.isFinite(parsed) || parsed < 1) return 1;
    return Math.floor(parsed);
  };

  const getDisplayPrice = (item, product) => {
    const snapshot = Number(item?.priceSnapshot || 0);
    if (snapshot > 0) return snapshot;
    return Number(product?.price || 0);
  };

  const getOldPrice = (item, product, price) => {
    const snapshot = Number(item?.originalPriceSnapshot || 0);
    if (snapshot > 0) return snapshot;
    const fallback = Number(product?.originalPrice || product?.oldPrice || 0);
    return fallback > 0 ? fallback : price;
  };

  const calcDiscount = (price, oldPrice) => {
    if (!oldPrice || oldPrice <= price) return 0;
    return Math.round(((oldPrice - price) / oldPrice) * 100);
  };

  const handleAddToCart = async (item) => {
    try {
      const product = getProduct(item);
      const quantity = getDisplayQuantity(item);
      const variantId = item?.variantId || null;
      const variantName = String(item?.variantName || "").trim();
      const price = getDisplayPrice(item, product);
      const originalPrice = getOldPrice(item, product, price);

      const cartProduct = {
        ...product,
        price,
        originalPrice,
        variantId,
        selectedVariant: variantId
          ? {
              _id: variantId,
              name: variantName,
              price,
            }
          : undefined,
      };
      await addToCart(cartProduct, quantity);
      return true;
    } catch (error) {
      setSnackbar({
        open: true,
        message: "Failed to add to cart",
        severity: "error",
      });
      return false;
    }
  };

  const handleDirectOrder = async (item) => {
    try {
      const added = await handleAddToCart(item);
      if (!added) return;
      router.push("/checkout");
    } catch (error) {
      setSnackbar({
        open: true,
        message: "Unable to start direct order",
        severity: "error",
      });
    }
  };

  return (
    <section className="min-h-screen bg-gradient-to-b from-[#f5fbff] to-[#eefbf3] py-8">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
          <div>
            <AccountSidebar />
          </div>

          <div className="rounded-3xl border border-white/60 bg-white/80 backdrop-blur-xl shadow-[0_30px_80px_-45px_rgba(15,23,42,0.4)] p-4 md:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
              <div>
                <h1 className="text-2xl md:text-3xl font-semibold text-slate-900">
                  My Wishlist
                </h1>
                <p className="text-sm text-slate-600 mt-1">
                  {wishlistCount > 0
                    ? `${wishlistCount} ${wishlistCount === 1 ? "item" : "items"} saved for later`
                    : "No items saved yet"}
                </p>
              </div>
            </div>

            {loading && (
              <div className="flex items-center justify-center py-16">
                <CircularProgress />
              </div>
            )}

            {!loading && wishlistItems.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <FaHeart className="text-slate-300 text-6xl" />
                <p className="text-slate-500">Your wishlist is empty</p>
                <Link href="/products">
                  <Button variant="contained" className="!bg-primary !text-white">
                    Discover Products
                  </Button>
                </Link>
              </div>
            )}

            {!loading && wishlistItems.length > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-5">
                {wishlistItems.map((item, index) => {
                  const product = getProduct(item);
                  const productId = product._id || product.id || item.product;
                  const isRemoving = Boolean(removingItems[String(productId || "")]);
                  const price = getDisplayPrice(item, product);
                  const oldPrice = getOldPrice(item, product, price);
                  const discount = calcDiscount(price, oldPrice);
                  const quantity = getDisplayQuantity(item);
                  const variantLabel = String(item?.variantName || "").trim();
                  const imageUrl =
                    product.images?.[0] ||
                    product.image ||
                    product.thumbnail ||
                    "/product_1.png";

                  return (
                    <article
                      key={productId || index}
                      className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md transition"
                    >
                      <div className="flex gap-4">
                        <Link href={`/product/${productId}`} className="shrink-0">
                          <div className="w-[108px] h-[108px] rounded-xl overflow-hidden bg-slate-50">
                            <img
                              src={imageUrl}
                              alt={product.name || "Product"}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        </Link>

                        <div className="flex-1 min-w-0">
                          <span className="text-xs uppercase tracking-wide text-slate-500">
                            {product.brand || "Healthy One Gram"}
                          </span>
                          <Link href={`/product/${productId}`}>
                            <h3 className="text-sm md:text-base font-semibold text-slate-900 hover:text-primary mt-1 line-clamp-2">
                              {product.name || "Product"}
                            </h3>
                          </Link>
                          {(variantLabel || quantity > 1) && (
                            <p className="mt-1 text-xs text-slate-500">
                              {variantLabel ? `Variant: ${variantLabel}` : "Variant: Standard"}
                              {quantity > 1 ? ` | Qty: ${quantity}` : ""}
                            </p>
                          )}

                          <div className="mt-2">
                            <Rating
                              name={`rating-${productId}`}
                              value={Number(product.rating || 5)}
                              readOnly
                              size="small"
                            />
                          </div>

                          <div className="mt-2 flex items-center gap-3 flex-wrap">
                            <span className="text-lg font-semibold text-slate-900">
                              ₹{price || 0}
                            </span>
                            {oldPrice > 0 && oldPrice > price && (
                              <>
                                <span className="text-sm text-slate-400 line-through">
                                  ₹{oldPrice}
                                </span>
                                <span className="text-xs font-semibold text-primary bg-[var(--flavor-glass)] px-2 py-0.5 rounded-full">
                                  {discount}% OFF
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        <button
                          onClick={() => {
                            removeFromWishlist({
                              product: item?.product?._id || item?.product,
                              variantId: item?.variantId || null,
                            });
                          }}
                          disabled={isRemoving}
                          className="h-9 w-9 rounded-full grid place-items-center text-slate-500 hover:text-red-600 hover:bg-red-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
                          aria-label="Remove from wishlist"
                        >
                          <IoMdClose size={20} />
                        </button>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-2">
                        <Button
                          onClick={() => handleAddToCart(item)}
                          variant="outlined"
                          className="!border-slate-300 !text-slate-700 !font-medium !normal-case"
                        >
                          Add to Cart
                        </Button>
                        <Button
                          onClick={() => handleDirectOrder(item)}
                          variant="contained"
                          className="!bg-primary hover:brightness-110 !font-medium !normal-case"
                        >
                          Direct Order
                        </Button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert severity={snackbar.severity}>{snackbar.message}</Alert>
      </Snackbar>
    </section>
  );
};

export default MyWishlistPage;
