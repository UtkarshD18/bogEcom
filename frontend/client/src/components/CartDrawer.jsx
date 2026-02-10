"use client";

import { useCart } from "@/context/CartContext";
import { fetchDataFromApi } from "@/utils/api";
import { Button, Drawer, IconButton, TextField } from "@mui/material";
import Link from "next/link";
import { memo, useCallback, useEffect, useState } from "react";
import { MdClose, MdDeleteOutline, MdShoppingCart } from "react-icons/md";

const API_URL = process.env.NEXT_PUBLIC_APP_API_URL || "http://localhost:8000";

/**
 * Memoized CartItemRow — prevents re-renders of all items
 * when only one item's quantity changes
 */
const CartItemRow = memo(function CartItemRow({
  item,
  product,
  productId,
  updateQuantity,
  removeFromCart,
  loading,
}) {
  const productName = product.name || "Product";
  const productImage =
    product.image ||
    product.images?.[0] ||
    product.thumbnail ||
    "/product_1.png";
  const price = item.price || product.price || 0;
  const quantity = item.quantity || 1;

  return (
    <div
      className="bg-white rounded-lg p-3 shadow-sm border border-gray-100 transition-all duration-200 ease-out"
      style={{ animation: "cartItemSlideIn 200ms ease-out" }}
    >
      <div className="flex gap-3">
        <img
          src={productImage}
          alt={productName}
          className="w-16 h-16 object-cover rounded-md"
          loading="lazy"
        />
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-gray-800 truncate">
            {productName}
          </h3>
          <p className="text-xs text-gray-500 mt-1">
            ₹{price} × {quantity}
          </p>
          <p className="text-sm font-bold text-gray-900 mt-1">
            ₹{(price * quantity).toFixed(2)}
          </p>

          {/* Quantity Controls */}
          <div className="flex items-center gap-2 mt-2">
            <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden select-none">
              <button
                onClick={() => updateQuantity(productId, quantity - 1)}
                disabled={loading || quantity <= 1}
                className="px-2.5 py-1 text-gray-600 hover:bg-gray-100 active:bg-gray-200 disabled:opacity-40 transition-colors duration-100 text-base font-medium"
              >
                −
              </button>
              <span className="px-3 py-1 border-l border-r border-gray-300 text-sm font-semibold min-w-9 text-center tabular-nums">
                {quantity}
              </span>
              <button
                onClick={() => updateQuantity(productId, quantity + 1)}
                disabled={loading}
                className="px-2.5 py-1 text-gray-600 hover:bg-gray-100 active:bg-gray-200 disabled:opacity-40 transition-colors duration-100 text-base font-medium"
              >
                +
              </button>
            </div>
            <button
              onClick={() => removeFromCart(productId)}
              disabled={loading}
              className="text-red-400 hover:text-red-600 p-1 transition-colors duration-150"
              title="Remove"
            >
              <MdDeleteOutline size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

/**
 * CartDrawer Component
 * Auto-opens when items are added to cart
 * Includes order note and similar products cross-sell
 */
const CartDrawer = () => {
  const {
    cartItems,
    cartCount,
    cartTotal,
    updateQuantity,
    removeFromCart,
    addToCart,
    isDrawerOpen,
    setIsDrawerOpen,
    orderNote,
    setOrderNote,
    loading,
  } = useCart();

  const [similarProducts, setSimilarProducts] = useState([]);
  const [loadingSimilar, setLoadingSimilar] = useState(false);

  // Fetch similar products when drawer opens
  useEffect(() => {
    if (isDrawerOpen && cartItems.length > 0) {
      fetchSimilarProducts();
    }
  }, [isDrawerOpen, cartItems]);

  const fetchSimilarProducts = async () => {
    try {
      setLoadingSimilar(true);
      // Get category from first cart item
      const firstItem = cartItems[0];
      const productData = firstItem.productData || firstItem.product;

      if (productData) {
        const categoryId = productData.category?._id || productData.category;
        if (categoryId) {
          const response = await fetchDataFromApi(
            `/api/products?category=${categoryId}&limit=4`,
          );

          if (response && !response.error) {
            const products = response.data || response.products || [];
            // Filter out products already in cart
            const cartProductIds = cartItems.map(
              (item) => item.product?._id || item.product,
            );
            const filtered = products.filter(
              (p) => !cartProductIds.includes(p._id),
            );
            setSimilarProducts(filtered.slice(0, 3));
          }
        }
      }
    } catch (error) {
      console.error("Error fetching similar products:", error);
    } finally {
      setLoadingSimilar(false);
    }
  };

  const handleAddSimilarProduct = async (product) => {
    await addToCart(product, 1);
    // Remove from similar products list
    setSimilarProducts((prev) => prev.filter((p) => p._id !== product._id));
  };

  const handleClose = useCallback(() => {
    setIsDrawerOpen(false);
  }, [setIsDrawerOpen]);

  return (
    <Drawer
      anchor="right"
      open={isDrawerOpen}
      onClose={handleClose}
      transitionDuration={{ enter: 250, exit: 200 }}
      PaperProps={{
        sx: {
          width: { xs: "100%", sm: "400px", md: "450px" },
          maxWidth: "100vw",
          willChange: "transform",
        },
      }}
      sx={{
        "& .MuiBackdrop-root": {
          backgroundColor: "rgba(0, 0, 0, 0.35)",
          transition: "opacity 250ms ease-in-out !important",
        },
      }}
    >
      <div className="h-full flex flex-col bg-gray-50">
        {/* Header */}
        <div className="bg-white px-4 py-4 shadow-sm flex items-center justify-between border-b sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <MdShoppingCart className="text-2xl text-gray-700" />
            <h2 className="text-lg font-bold text-gray-800">
              Shopping Cart ({cartCount})
            </h2>
          </div>
          <IconButton onClick={handleClose} size="small">
            <MdClose />
          </IconButton>
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto p-4">
          {cartItems.length === 0 ? (
            <div className="text-center py-12">
              <MdShoppingCart className="text-6xl text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 text-sm">Your cart is empty</p>
            </div>
          ) : (
            <>
              <div className="space-y-3 mb-4">
                {cartItems.map((item, index) => {
                  const product = item.productData || item.product || {};
                  const productId = product._id || item.product;
                  return (
                    <CartItemRow
                      key={productId || index}
                      item={item}
                      product={product}
                      productId={productId}
                      updateQuantity={updateQuantity}
                      removeFromCart={removeFromCart}
                      loading={loading}
                    />
                  );
                })}
              </div>

              {/* Order Note */}
              <div className="mb-4">
                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  label="Add a note (optional)"
                  placeholder="Any special instructions for your order?"
                  value={orderNote}
                  onChange={(e) => setOrderNote(e.target.value)}
                  variant="outlined"
                  size="small"
                  sx={{
                    backgroundColor: "white",
                    "& .MuiOutlinedInput-root": {
                      fontSize: "14px",
                    },
                  }}
                />
              </div>

              {/* Similar Products */}
              {similarProducts.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-sm font-bold text-gray-800 mb-3">
                    You may also like
                  </h3>
                  <div className="space-y-2">
                    {similarProducts.map((product) => (
                      <div
                        key={product._id}
                        className="bg-white rounded-lg p-3 shadow-sm border border-gray-100 flex gap-3"
                      >
                        <img
                          src={
                            product.image ||
                            product.images?.[0] ||
                            product.thumbnail ||
                            "/product_1.png"
                          }
                          alt={product.name}
                          className="w-14 h-14 object-cover rounded"
                        />
                        <div className="flex-1 min-w-0">
                          <h4 className="text-xs font-semibold text-gray-800 truncate">
                            {product.name}
                          </h4>
                          <p className="text-sm font-bold text-gray-900 mt-1">
                            ₹{product.price}
                          </p>
                        </div>
                        <button
                          onClick={() => handleAddSimilarProduct(product)}
                          className="px-3 py-1 bg-[#059669] text-white text-xs font-bold rounded hover:bg-[#047857] transition-colors self-center"
                        >
                          Add
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {cartItems.length > 0 && (
          <div className="bg-white border-t p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-gray-700 font-semibold">Subtotal:</span>
              <span className="text-xl font-bold text-gray-900">
                ₹{cartTotal.toFixed(2)}
              </span>
            </div>

            <Link href="/checkout" onClick={handleClose}>
              <Button
                fullWidth
                variant="contained"
                size="large"
                sx={{
                  backgroundColor: "#059669",
                  "&:hover": { backgroundColor: "#047857" },
                  fontWeight: "bold",
                  textTransform: "none",
                  py: 1.5,
                }}
              >
                Proceed to Checkout
              </Button>
            </Link>

            <Link href="/cart" onClick={handleClose}>
              <Button
                fullWidth
                variant="outlined"
                size="medium"
                sx={{
                  borderColor: "#059669",
                  color: "#059669",
                  "&:hover": {
                    borderColor: "#047857",
                    backgroundColor: "rgba(5, 150, 105, 0.05)",
                  },
                  fontWeight: "600",
                  textTransform: "none",
                }}
              >
                View Full Cart
              </Button>
            </Link>
          </div>
        )}
      </div>
    </Drawer>
  );
};

export default CartDrawer;
