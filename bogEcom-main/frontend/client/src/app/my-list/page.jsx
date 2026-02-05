"use client";
import AccountSidebar from "@/components/AccountSiderbar";
import { useWishlist } from "@/context/WishlistContext";
import { Button, CircularProgress } from "@mui/material";
import Rating from "@mui/material/Rating";
import Link from "next/link";
import { FaHeart } from "react-icons/fa";
import { IoMdClose } from "react-icons/io";

const MyList = () => {
  const { wishlistItems, wishlistCount, loading, removeFromWishlist } =
    useWishlist();

  // Helper to get product data from wishlist item
  const getProduct = (item) => {
    // item.product can be populated object or just ID
    // item.productData is the full product for local storage items
    return item.product && typeof item.product === "object"
      ? item.product
      : item.productData || item;
  };

  // Get the original/old price (API uses originalPrice, frontend may use oldPrice)
  const getOldPrice = (product) => {
    return product.originalPrice || product.oldPrice || 0;
  };

  // Calculate discount percentage
  const calcDiscount = (price, oldPrice) => {
    if (!oldPrice || oldPrice <= price) return 0;
    return Math.round(((oldPrice - price) / oldPrice) * 100);
  };

  return (
    <section className="bg-gray-100 py-8">
      <div className="container flex gap-5">
        {/* Sidebar */}
        <div className="w-[20%]">
          <AccountSidebar />
        </div>

        {/* Center Content */}
        <div className="flex-1 flex justify-center wrapper w-[60%]">
          <div className="bg-white shadow-md rounded-md mb-5 w-[70%]">
            <div className="p-4 flex items-center justify-between border-b border-[rgba(0,0,0,0.2)]">
              <div className="info">
                <h4 className="text-[20px] font-[500] text-gray-700">
                  My List
                </h4>
                <p className="text-[15px] text-gray-500">
                  {wishlistCount > 0 ? (
                    <>
                      there are{" "}
                      <span className="text-primary font-bold">
                        {wishlistCount}
                      </span>{" "}
                      {wishlistCount === 1 ? "product" : "products"} in your My
                      List
                    </>
                  ) : (
                    "Your wishlist is empty"
                  )}
                </p>
              </div>
            </div>

            {/* Loading State */}
            {loading && (
              <div className="flex justify-center items-center py-10">
                <CircularProgress />
              </div>
            )}

            {/* Empty State */}
            {!loading && wishlistItems.length === 0 && (
              <div className="flex flex-col items-center justify-center py-10 gap-4">
                <FaHeart className="text-gray-300 text-6xl" />
                <p className="text-gray-500">No items in your wishlist yet</p>
                <Link href="/products">
                  <Button
                    variant="contained"
                    className="!bg-primary !text-white"
                  >
                    Browse Products
                  </Button>
                </Link>
              </div>
            )}

            {/* Wishlist Items */}
            {!loading && wishlistItems.length > 0 && (
              <div className="flex flex-col gap-2 py-3 px-3">
                {wishlistItems.map((item, index) => {
                  const product = getProduct(item);
                  const productId = product._id || product.id || item.product;
                  const oldPrice = getOldPrice(product);
                  const discount = calcDiscount(product.price, oldPrice);
                  const imageUrl =
                    product.images?.[0] ||
                    product.image ||
                    product.thumbnail ||
                    "/product_1.png";

                  return (
                    <div
                      key={productId || index}
                      className="myListBox flex items-center gap-3 border-b border-[rgba(0,0,0,0.2)] py-3"
                    >
                      <Link href={`/product/${productId}`}>
                        <div className="img w-[80px] h-[100px] group">
                          <img
                            src={imageUrl}
                            alt={product.name || "Product"}
                            className="w-full h-full object-cover transition-all group-hover:scale-105 cursor-pointer"
                          />
                        </div>
                      </Link>
                      <div className="info flex-col gap-[5px] flex-1">
                        <span className="text-[13px] text-gray-600">
                          {product.brand || "Healthy One Gram"}
                        </span>
                        <Link href={`/product/${productId}`}>
                          <h3 className="text-[13px] text-gray-800 font-[500] hover:text-primary cursor-pointer">
                            {product.name || "Product Name"}
                          </h3>
                        </Link>
                        <Rating
                          name="read-only"
                          value={product.rating || 5}
                          readOnly
                          size="small"
                        />
                        <div className="flex items-center gap-5">
                          <span className="text-lg font-semibold text-gray-900">
                            ₹{product.price || 0}
                          </span>
                          {oldPrice > 0 && oldPrice > product.price && (
                            <>
                              <span className="text-sm text-gray-400 line-through">
                                ₹{oldPrice}
                              </span>
                              <span className="text-primary font-bold text-gray-900 text-[16px]">
                                {discount}% OFF
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      <Button
                        className="!w-[50px] !h-[50px] !min-w-[50px] !rounded-full !p-0 text-gray-700 !ml-auto hover:!bg-red-50 hover:!text-red-500"
                        onClick={() => removeFromWishlist(productId)}
                        disabled={loading}
                      >
                        <IoMdClose size={20} />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default MyList;
