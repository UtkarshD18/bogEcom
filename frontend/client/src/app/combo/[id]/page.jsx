"use client";

import ProductDetail from "@/components/productDetail/ProductDetail";
import DetailPriceBlock from "@/components/productDetail/PriceBlock";
import DetailRating from "@/components/productDetail/Rating";
import ProductZoom from "@/components/ProductZoom";
import QtyBox from "@/components/QtyBox";
import { formatPrice } from "@/config/siteConfig";
import { useCart } from "@/context/CartContext";
import { fetchDataFromApi } from "@/utils/api";
import { trackEvent } from "@/utils/analyticsTracker";
import { getImageUrl } from "@/utils/imageUtils";
import { sanitizeHTML } from "@/utils/sanitize";
import { Button } from "@mui/material";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { IoMdCart } from "react-icons/io";
import { MdLocalShipping, MdPolicy, MdVerified } from "react-icons/md";
import { toast } from "react-hot-toast";

const isObjectId = (value) => /^[0-9a-f]{24}$/i.test(String(value || ""));

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const isImageCandidate = (value) => {
  const normalized = String(value || "").trim();
  if (!normalized || /\s/.test(normalized)) return false;
  return (
    normalized.startsWith("http://") ||
    normalized.startsWith("https://") ||
    normalized.startsWith("res.cloudinary.com/") ||
    normalized.startsWith("/uploads/") ||
    normalized.startsWith("uploads/") ||
    normalized.startsWith("data:image/")
  );
};

const FALLBACK_COMBO_IMAGE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='700' height='700' viewBox='0 0 700 700'%3E%3Crect width='700' height='700' fill='%23f3f4f6'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%239ca3af' font-family='Arial,sans-serif' font-size='36'%3ECombo%20Image%3C/text%3E%3C/svg%3E";

const resolveComboGallery = (combo) => {
  const itemImages = (Array.isArray(combo?.items) ? combo.items : [])
    .map((item) => item?.image)
    .filter((entry) => isImageCandidate(entry));

  const candidates = [
    combo?.comboThumbnail,
    combo?.combo_thumbnail,
    combo?.thumbnail,
    combo?.image,
    ...(Array.isArray(combo?.comboImages) ? combo.comboImages : []),
    ...(Array.isArray(combo?.combo_images) ? combo.combo_images : []),
    ...itemImages,
  ].filter((entry) => isImageCandidate(entry));

  return [...new Set(candidates)].slice(0, 10);
};

const ComboDetailPage = () => {
  const { id } = useParams();
  const routeId = String(id || "").trim();
  const decodedRouteId = routeId ? decodeURIComponent(routeId) : "";
  const router = useRouter();
  const { addComboToCart } = useCart();

  const [combo, setCombo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [isAdding, setIsAdding] = useState(false);
  const [activeTab, setActiveTab] = useState("description");

  const galleryImages = useMemo(() => resolveComboGallery(combo), [combo]);
  const comboImage = galleryImages[0] || FALLBACK_COMBO_IMAGE;

  const originalTotal = toNumber(
    combo?.originalPrice ?? combo?.originalTotal,
    0,
  );
  const comboPrice = toNumber(combo?.price ?? combo?.comboPrice ?? combo?.suggestedPrice, 0);
  const discountPercent =
    originalTotal > 0
      ? Math.round(((originalTotal - comboPrice) / originalTotal) * 100)
      : Math.round(toNumber(combo?.discountPercentage, 0));
  const comboId = combo?._id || combo?.id || "";
  const availableStock = toNumber(combo?.availableStock ?? combo?.stockQuantity, 0);
  const isOutOfStock = availableStock <= 0;
  const maxPerOrder = toNumber(combo?.maxPerOrder, 0);
  const maxQty = maxPerOrder > 0 ? Math.min(maxPerOrder, Math.max(availableStock, 1)) : Math.max(availableStock, 1);
  const starRating = toNumber(combo?.adminStarRating ?? combo?.rating, 0);
  const reviewCount = toNumber(combo?.reviewCount, 0);
  const outOfStockItems = useMemo(() => {
    if (Array.isArray(combo?.outOfStockItems)) {
      return combo.outOfStockItems;
    }
    if (Array.isArray(combo?.availability?.outOfStockItems)) {
      return combo.availability.outOfStockItems;
    }
    return [];
  }, [combo]);

  useEffect(() => {
    if (!routeId) return;

    const loadCombo = async () => {
      setLoading(true);
      setError("");
      setCombo(null);
      try {
        const lookupChain = isObjectId(decodedRouteId)
          ? [`/api/combos/${decodedRouteId}`]
          : [
              `/api/combos/slug/${encodeURIComponent(decodedRouteId)}`,
              `/api/combos/${encodeURIComponent(decodedRouteId)}`,
            ];

        let payload = null;
        for (const endpoint of lookupChain) {
          const response = await fetchDataFromApi(endpoint);
          if (response?.success && response?.data) {
            payload = response.data;
            break;
          }
        }

        if (!payload) {
          setError("Combo not found.");
          return;
        }

        setCombo(payload);
        try {
          trackEvent("combo_view", {
            comboId: String(payload?._id || payload?.id || ""),
            comboName: payload?.name || "",
            comboSlug: payload?.slug || "",
            comboType: payload?.comboType || "",
            sectionName: "combo_detail",
          });
        } catch {
          // non-blocking analytics
        }
      } catch {
        setError("Unable to load combo details.");
      } finally {
        setLoading(false);
      }
    };

    loadCombo();
  }, [routeId, decodedRouteId]);

  useEffect(() => {
    if (comboId) {
      setQuantity(1);
    }
  }, [comboId]);

  const handleAddCombo = async () => {
    if (!combo || isAdding) return;
    const safeItems = Array.isArray(combo?.items) ? combo.items : [];
    if (safeItems.length === 0) {
      toast.error("Combo items are unavailable right now");
      return;
    }
    if (isOutOfStock) {
      toast.error("One of the items in this combo is out of stock");
      return;
    }
    setIsAdding(true);
    try {
      const result = await addComboToCart(combo, quantity);
      if (result?.success === false) {
        toast.error(result?.message || "Unable to add combo right now");
      }
      return result;
    } finally {
      setIsAdding(false);
    }
  };

  const handleBuyNow = async () => {
    if (!combo || isOutOfStock || isAdding) return;
    setIsAdding(true);
    try {
      const result = await addComboToCart(combo, quantity);
      if (result?.success === false) {
        toast.error(result?.message || "Unable to proceed to checkout");
        return;
      }
      if (result?.success !== false) {
        router.push("/checkout");
      }
    } catch {
      toast.error("Unable to proceed to checkout");
    } finally {
      setIsAdding(false);
    }
  };

  const breadcrumb = (
    <nav className="flex items-center gap-2 text-xs sm:text-sm text-gray-500 mb-4 sm:mb-6 overflow-x-auto whitespace-nowrap pb-2">
      <Link href="/" className="hover:text-primary">
        Home
      </Link>
      <span>/</span>
      <Link href="/combo-deals" className="hover:text-primary">
        Combo Deals
      </Link>
      <span>/</span>
      <span className="text-gray-800 font-medium truncate max-w-[200px]">
        {combo?.name || "Combo"}
      </span>
    </nav>
  );

  const hero = (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
      <div className="relative">
        <div className="relative">
          {discountPercent > 0 && (
            <span className="absolute top-4 left-4 bg-red-500 text-white text-sm font-bold px-3 py-1 rounded-full z-10">
              {discountPercent}% OFF
            </span>
          )}
          <ProductZoom
            images={galleryImages.length > 0 ? galleryImages : [comboImage]}
            productId={String(comboId || "")}
            zoomType="combo"
          />
        </div>
      </div>

      <div className="flex flex-col">
        {combo?.brand ? (
          <p className="text-xs font-bold uppercase tracking-wider text-primary mb-2">
            {combo.brand}
          </p>
        ) : (
          <p className="text-xs font-bold uppercase tracking-wider text-primary mb-2">
            Combo Deal
          </p>
        )}

        <h1 className="text-xl sm:text-2xl md:text-4xl font-semibold tracking-tight text-gray-900 mb-3">
          {combo?.name || "Combo Deal"}
        </h1>

        <DetailRating value={starRating} reviewCount={reviewCount} />

        <DetailPriceBlock
          finalPrice={comboPrice}
          originalPrice={originalTotal}
          discount={discountPercent}
        />

        {combo?.shortDescription && (
          <p className="text-gray-600 mb-6 leading-relaxed">
            {combo.shortDescription}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-4 mb-6">
          <div className="flex items-center gap-3">
            <span className="text-gray-700 font-medium">Qty:</span>
            <div className="flex flex-col">
              <QtyBox value={quantity} onChange={setQuantity} max={maxQty} />
              {availableStock === 0 ? (
                <span className="text-xs text-red-500 mt-1">Out of stock</span>
              ) : null}
            </div>
          </div>

          <Button
            variant="contained"
            size="large"
            startIcon={<IoMdCart />}
            onClick={handleAddCombo}
            disabled={isOutOfStock || isAdding}
            sx={{
              backgroundColor: "var(--primary)",
              "&:hover": { backgroundColor: "var(--flavor-hover)" },
              padding: "12px 32px",
              borderRadius: "14px",
              fontWeight: "bold",
              textTransform: "none",
              fontSize: "16px",
              boxShadow: "0 16px 30px -20px rgba(var(--flavor-badge),0.85)",
            }}
          >
            {isAdding ? "Adding..." : "Add to Cart"}
          </Button>

          <Button
            variant="contained"
            size="large"
            onClick={handleBuyNow}
            disabled={isOutOfStock || isAdding}
            sx={{
              backgroundColor: "#dc2626",
              color: "#fff",
              "&:hover": { backgroundColor: "#b91c1c" },
              padding: "12px 20px",
              borderRadius: "14px",
              textTransform: "none",
              fontWeight: 600,
              boxShadow: "0 16px 30px -20px rgba(220,38,38,0.7)",
            }}
          >
            Buy Now
          </Button>
        </div>

        {isOutOfStock && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 mb-6">
            <p>Out of stock because one product in this combo is unavailable.</p>
            {outOfStockItems.slice(0, 3).map((item, index) => (
              <p key={`${item.productId}-${index}`} className="text-xs mt-1">
                {item?.productTitle || "Product"}
                {item?.variantName ? ` ${item.variantName}` : ""} is currently out of stock.
              </p>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 py-6 border-t border-b border-gray-100">
          <div className="flex items-center gap-3">
            <MdLocalShipping className="text-2xl text-primary" />
            <div>
              <p className="font-semibold text-gray-800 text-sm">Free Delivery</p>
              <p className="text-xs text-gray-500">On all orders (₹0 shipping)</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <MdVerified className="text-2xl text-primary" />
            <div>
              <p className="font-semibold text-gray-800 text-sm">Quality Products</p>
              <p className="text-xs text-gray-500">Fresh & authentic items</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <MdPolicy className="text-2xl text-primary" />
            <div>
              <p className="font-semibold text-gray-800 text-sm">Secure Payment</p>
              <p className="text-xs text-gray-500">100% secure checkout</p>
            </div>
          </div>
        </div>

        <div className="mt-6 text-sm text-gray-500">
          {combo?.sku ? (
            <p>
              <span className="font-medium">SKU:</span> {combo.sku}
            </p>
          ) : null}
          <p>
            <span className="font-medium">Category:</span>{" "}
            <Link href="/combo-deals" className="text-primary hover:underline">
              {combo?.category || combo?.categoryName || "Combo Deals"}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );

  const tabs = (
    <>
      <div className="flex border-b border-gray-200">
        {["description", "reviews", "shipping"].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-6 py-3 font-semibold text-sm capitalize transition-colors ${
              activeTab === tab
                ? "text-primary border-b-2 border-primary"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab === "reviews" ? `Reviews (${reviewCount})` : tab}
          </button>
        ))}
      </div>

      <div className="py-6">
        {activeTab === "description" && (
          <div className="prose max-w-none text-gray-600">
            {combo?.description ? (
              <div
                dangerouslySetInnerHTML={{ __html: sanitizeHTML(combo.description) }}
              />
            ) : (
              <p>{combo?.shortDescription || "No description available."}</p>
            )}
          </div>
        )}

        {activeTab === "reviews" && (
          <div>
            <p className="text-gray-500">
              Customer reviews for this combo will appear here.
            </p>
          </div>
        )}

        {activeTab === "shipping" && (
          <div className="text-gray-600 space-y-4">
            <p>
              <strong>Delivery:</strong> Standard delivery within 3-5 business days.
            </p>
            <p>
              <strong>Shipping Charges:</strong> ₹0 on all orders.
            </p>
            <p>
              <strong>Packaging:</strong> Eco-friendly packaging to ensure product safety.
            </p>
          </div>
        )}
      </div>
    </>
  );

  const sections = (
    <div className="mt-12" data-track-section="combo_included_products">
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Products Included in this Combo</h2>
          <p className="text-sm text-gray-500">Everything included in this combo pack.</p>
        </div>
        <Link href="/combo-deals" className="text-sm text-primary font-semibold">
          View all combos
        </Link>
      </div>

      {Array.isArray(combo?.items) && combo.items.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {combo.items.map((item, index) => {
            const itemImage = item?.image || FALLBACK_COMBO_IMAGE;
            return (
              <div
                key={`${item.productId || "combo-item"}-${index}`}
                className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"
              >
                <div className="flex gap-4">
                  <div className="w-16 h-16 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center p-2 shrink-0">
                    <img
                      src={getImageUrl(itemImage)}
                      alt={item?.productTitle || "Product"}
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/product/${item?.productId || ""}`}
                      className="text-sm font-semibold text-gray-900 hover:text-primary"
                    >
                      {item?.productTitle || "Product"}
                    </Link>
                    {item?.variantName ? (
                      <p className="text-xs text-gray-500 mt-1">Variant: {item.variantName}</p>
                    ) : null}
                    <p className="text-xs text-gray-500 mt-1">Qty: {item?.quantity || 1}</p>
                    <div className="mt-2 flex items-center gap-2">
                      {toNumber(item?.originalPrice, 0) > toNumber(item?.price, 0) ? (
                        <span className="text-xs text-gray-400 line-through">
                          {formatPrice(toNumber(item?.originalPrice, 0))}
                        </span>
                      ) : null}
                      <span className="text-sm font-semibold text-gray-900">
                        {formatPrice(toNumber(item?.price, 0))}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-gray-500">Combo items are not available right now.</p>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-gray-500">
        Loading combo details...
      </div>
    );
  }

  if (error || !combo) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-red-500 px-4 text-center">
        {error || "Combo not found."}
      </div>
    );
  }

  return <ProductDetail breadcrumb={breadcrumb} hero={hero} tabs={tabs} sections={sections} />;
};

export default ComboDetailPage;
