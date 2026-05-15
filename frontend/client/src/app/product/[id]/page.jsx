"use client";

/* eslint-disable @next/next/no-img-element */

import ComboCard from "@/components/ComboCard";
import ProductImage from "@/components/ProductImage";
import ShareButton from "@/components/ShareButton";
import StockNotificationButton from "@/components/StockNotificationButton";
import {
  DEMO_PRODUCT_ID,
  buildDemoProduct,
  buildDemoReviews,
} from "@/components/productDetail/demoLiveData";
import {
  mergeCardCopyWithDefaults,
  mergeListWithDefaults,
  mergeTextOverride,
  normalizeProductPageConfig,
} from "@/components/productDetail/pageConfig";
import { formatPrice } from "@/config/siteConfig";
import { useCart } from "@/context/CartContext";
import useIndiaPincodeLookup from "@/hooks/useIndiaPincodeLookup";
import {
  subscribeToStockConnection,
  subscribeToStockUpdates,
} from "@/realtime/stockSocket";
import { normalizePincode } from "@/utils/addressForm";
import { trackEvent } from "@/utils/analyticsTracker";
import { fetchDataFromApi, postData } from "@/utils/api";
import { getImageUrl } from "@/utils/imageUtils";
import { sanitizeHTML } from "@/utils/sanitize";
import {
  applyStockUpdateToProduct,
  getResolvedAvailableStock,
} from "@/utils/stockRealtime";
import {
  formatWeight,
  getVariantWeightLabel,
  getWeightInGrams,
  stripWeightRange,
} from "@/utils/weightDisplay";
import { Alert, CircularProgress, Rating, Snackbar } from "@mui/material";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  startTransition,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  FiChevronLeft,
  FiChevronRight,
  FiMaximize2,
  FiX,
} from "react-icons/fi";
import { IoMdCart } from "react-icons/io";
import {
  MdLocalShipping,
  MdOutlineInventory2,
  MdOutlineSecurity,
  MdVerified,
} from "react-icons/md";

const DEFAULT_TABS = [
  { id: "description", label: "Description" },
  { id: "details", label: "Product Details" },
  { id: "shipping", label: "Shipping & Trust" },
];
const FALLBACK_POLL_INTERVAL_MS = 30000;
const DEFAULT_REVIEW_SETTINGS = {
  allowPublicSubmissions: true,
  autoPublishPublicReviews: true,
  showPublicReviewForm: true,
  showOrderReviewActions: true,
};

const normalizePublicReviewSettings = (value = {}) => ({
  allowPublicSubmissions: value?.allowPublicSubmissions !== false,
  autoPublishPublicReviews: value?.autoPublishPublicReviews !== false,
  showPublicReviewForm: value?.showPublicReviewForm !== false,
  showOrderReviewActions: value?.showOrderReviewActions !== false,
});

const isExclusiveProduct = (value) => {
  const product = value?.product || value;
  return (
    product?.isExclusive === true ||
    product?.isMembersExclusive === true ||
    product?.membersExclusive === true
  );
};

const isExclusiveCombo = (combo) => {
  const audience = String(
    combo?.audience || combo?.visibility || combo?.access || combo?.tag || "",
  )
    .trim()
    .toLowerCase();
  return (
    combo?.isExclusive === true ||
    combo?.isMembersExclusive === true ||
    combo?.membersExclusive === true ||
    audience === "members_exclusive"
  );
};

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeWeightUnit = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();

const convertWeightToGrams = (value, unit) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue <= 0) return 0;

  switch (normalizeWeightUnit(unit)) {
    case "kg":
    case "kilogram":
    case "kilograms":
      return Math.round(numericValue * 1000);
    case "mg":
    case "milligram":
    case "milligrams":
      return Math.max(Math.round(numericValue / 1000), 0);
    case "lb":
    case "lbs":
    case "pound":
    case "pounds":
      return Math.round(numericValue * 453.59237);
    case "g":
    case "gram":
    case "grams":
    default:
      return Math.round(numericValue);
  }
};

const buildStaticDeliveryMessage = (pincode) => {
  const normalized = normalizePincode(pincode);
  return normalized.length === 6
    ? `Estimated delivery to ${normalized}: 2-4 business days.`
    : "Enter a 6-digit pincode to preview delivery timing.";
};

const isPossibleIndianPincode = (value) => /^[1-9][0-9]{5}$/.test(value);

const getResolvedProductId = (product) => product?._id || product?.id || "";

const formatVariantWeight = (variant = {}) => {
  return getVariantWeightLabel(variant);
};

const formatVariantLabel = (variant = {}) => {
  const baseName = stripWeightRange(variant?.name);
  const weightLabel = formatVariantWeight(variant);
  const skuLabel = String(variant?.sku || "").trim();

  const normalizeToken = (value) =>
    String(value || "")
      .toLowerCase()
      .replace(/\s+/g, "")
      .replace(/[^a-z0-9]/g, "");

  const baseToken = normalizeToken(baseName);
  const weightToken = normalizeToken(weightLabel);
  const looksLikeBadRange =
    baseName &&
    weightLabel &&
    /\b\d+(?:\.\d+)?\s*(?:mg|g|kg|ml|l|pcs?)\s*-\s*\d+(?:\.\d+)?\s*(?:mg|g|kg|ml|l|pcs?)\b/i.test(
      baseName,
    );

  if (looksLikeBadRange) {
    return weightLabel;
  }

  if (baseName && weightLabel && baseToken && weightToken) {
    if (baseToken.includes(weightToken) || weightToken.includes(baseToken)) {
      return baseName;
    }
  }

  const fullName = [baseName, weightLabel].filter(Boolean).join(" - ");
  if (fullName) return fullName;
  if (weightLabel) return weightLabel;
  if (baseName) return baseName;
  if (skuLabel) return skuLabel;
  return "Variant";
};

const stripHtml = (value) =>
  String(value || "")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

const splitTextParagraphs = (value) =>
  String(value || "")
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}|\n/)
    .map((part) => stripHtml(part))
    .filter(Boolean);

const normalizeComparableText = (value) =>
  stripHtml(value).toLowerCase().replace(/\s+/g, " ").trim();

const getAvailabilityLabel = (availableQty, demandStatus) => {
  if (availableQty > 0) {
    return String(demandStatus || "")
      .trim()
      .toUpperCase() === "HIGH"
      ? "Selling fast"
      : "In stock";
  }

  if (
    String(demandStatus || "")
      .trim()
      .toUpperCase() === "HIGH"
  ) {
    return "High demand";
  }

  return "Currently unavailable";
};

const getHeroStatusLabel = (product, reviewCount) => {
  if (product?.isBestSeller) return "Best seller";
  if (product?.isNewArrival) return "New arrival";
  if (product?.highDemand) return "High Demand";
  if (
    String(product?.demandStatus || "")
      .trim()
      .toUpperCase() === "HIGH"
  ) {
    return "High demand";
  }
  if (Number(reviewCount || 0) > 0) return "Top rated";
  return "Healthy One Gram";
};

const buildDescriptionParagraphs = (product) => {
  const descriptionText = stripHtml(
    product?.description || product?.shortDescription || "",
  );

  if (descriptionText) {
    const sentences = descriptionText
      .split(/(?<=[.!?])\s+/)
      .map((part) => part.trim())
      .filter(Boolean);

    if (sentences.length <= 2) {
      return [descriptionText];
    }

    const grouped = [];
    for (let index = 0; index < sentences.length; index += 2) {
      grouped.push(sentences.slice(index, index + 2).join(" "));
    }
    return grouped.slice(0, 3);
  }

  const name = String(product?.name || product?.title || "This product").trim();
  return [
    `${name} now has a cleaner product detail presentation with clearer image hierarchy, stronger pricing emphasis, and a more readable information flow.`,
    "The refreshed layout gives customers a faster path from product discovery to purchase while still leaving room for supporting content below the fold.",
  ];
};

const buildDetailCards = ({
  product,
  selectedVariant,
  availableQty,
  avgRating,
  reviewCount,
}) => {
  const categoryLabel = product?.category?.name || product?.categoryName || "";
  const selectedLabel = selectedVariant
    ? getVariantWeightLabel(selectedVariant)
    : formatVariantWeight(product);
  const normalizedReviewCount = Math.max(Number(reviewCount || 0), 0);
  const ratingText =
    normalizedReviewCount === 0
      ? "No reviews yet"
      : `${Number(avgRating || 0).toFixed(1)} (${normalizedReviewCount})`;
  const selectedStock = Number(
    selectedVariant?.stock_quantity ??
      selectedVariant?.stock ??
      selectedVariant?.available_quantity ??
      availableQty ??
      0,
  );

  return [
    {
      label: "Category",
      value: categoryLabel,
      helper: "Live product taxonomy",
    },
    {
      label: "Selected Pack",
      value: selectedLabel,
      helper: "Variant-aware display",
    },
    {
      label: "Customer Reviews",
      value: ratingText,
      helper: "Visible social proof",
    },
    {
      label: "Availability",
      value: selectedStock > 0 ? "In stock" : "Out of stock",
      helper: "Real-time stock signal",
    },
  ];
};

const buildShippingPoints = () => [
  "Standard delivery typically lands within 3-5 business days after dispatch.",
  "All checkout flows run through secure payment handling and verified order tracking.",
  "Packaging is designed to keep product quality protected throughout transit.",
];

const DEFAULT_SUPPORT_CARDS = [
  {
    title: "Free Delivery",
    description: "Stronger utility near the CTA block.",
    Icon: MdLocalShipping,
  },
  {
    title: "Secure Payment",
    description: "Checkout trust signal stays visible.",
    Icon: MdOutlineSecurity,
  },
  {
    title: "Authentic Product",
    description: "Premium surface with useful proof points.",
    Icon: MdVerified,
  },
  {
    title: "Clear Inventory",
    description: "Variant-aware stock display for better decisions.",
    Icon: MdOutlineInventory2,
  },
];

const resolveVariantLabel = (variant, baseProduct) => {
  const weightLabel = getVariantWeightLabel(variant);
  if (weightLabel) return weightLabel;
  const fallbackWeight = getWeightInGrams(baseProduct);
  return fallbackWeight > 0
    ? formatWeight(fallbackWeight, baseProduct?.unit || "g")
    : "";
};

const resolveProductImages = (
  product,
  selectedVariant,
  fallbackImages = [],
) => {
  const variantImages = Array.isArray(selectedVariant?.images)
    ? selectedVariant.images
    : [];
  const productImages = Array.isArray(product?.images) ? product.images : [];

  return [
    selectedVariant?.image,
    ...variantImages,
    product?.thumbnail,
    ...productImages,
    ...fallbackImages,
  ]
    .filter(Boolean)
    .map((image) => getImageUrl(image))
    .filter(Boolean)
    .filter((image, index, allImages) => allImages.indexOf(image) === index);
};

const averageReviewRating = (reviews = []) => {
  if (!Array.isArray(reviews) || reviews.length === 0) return 0;
  const total = reviews.reduce(
    (sum, review) => sum + Math.max(Number(review?.rating || 0), 0),
    0,
  );
  return total > 0 ? total / reviews.length : 0;
};

const formatReviewDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const getReviewInitials = (review) => {
  const source = String(review?.userName || review?.name || "Customer").trim();
  return source
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
};

const ReviewCard = ({ review, compact = false }) => (
  <article className="product-review-card h-full rounded-[28px] border border-[#e7dad1] bg-[#fbf7f2] p-6 shadow-[0_24px_50px_-42px_rgba(42,28,20,0.28)]">
    <div className="flex items-center gap-4">
      {review?.avatar ? (
        <img
          src={getImageUrl(review.avatar)}
          alt={review?.userName || "Customer"}
          className="h-14 w-14 rounded-2xl object-cover"
        />
      ) : (
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#2f1b12] text-base font-semibold text-white">
          {getReviewInitials(review)}
        </div>
      )}
      <div className="min-w-0">
        <p className="font-semibold text-[#24150f]">
          {review?.userName || "Customer"}
        </p>
        <p className="text-sm text-[#6d584a]">
          {[review?.city, formatReviewDate(review?.createdAt)]
            .filter(Boolean)
            .join(" - ")}
        </p>
      </div>
    </div>
    <div className="mt-4">
      <Rating
        value={Math.max(Number(review?.rating || 0), 0)}
        readOnly
        size="small"
      />
    </div>
    <p
      className={`mt-4 text-sm leading-7 text-[#4b392f] ${
        compact ? "line-clamp-4" : ""
      }`}
    >
      {review?.comment || "No written comment available."}
    </p>
  </article>
);

const ProductDetailPage = () => {
  const { id } = useParams();
  const router = useRouter();
  const routeId = String(id || "").trim();
  const isDemoPreview = routeId.toLowerCase() === DEMO_PRODUCT_ID;
  const { addToCart, removeFromCart, isInCart, cartItems, isComboCartItem } =
    useCart();

  const [product, setProduct] = useState(null);
  const [customerReviews, setCustomerReviews] = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [showAllReviewsModal, setShowAllReviewsModal] = useState(false);
  const [reviewPage, setReviewPage] = useState(1);
  const [reviewVariantFilter, setReviewVariantFilter] = useState("");
  const [reviewSort, setReviewSort] = useState("highest");
  const [reviewSettings, setReviewSettings] = useState(DEFAULT_REVIEW_SETTINGS);
  const [publicReviewForm, setPublicReviewForm] = useState({
    userName: "",
    city: "",
    rating: 5,
    comment: "",
  });
  const [submittingPublicReview, setSubmittingPublicReview] = useState(false);
  const [frequentlyBought, setFrequentlyBought] = useState([]);
  const [fbtLoading, setFbtLoading] = useState(false);
  const [recommendedCombos, setRecommendedCombos] = useState([]);
  const [recommendedLoading, setRecommendedLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [activeTab, setActiveTab] = useState("description");
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [isImageZoomOpen, setIsImageZoomOpen] = useState(false);
  const [deliveryPincode, setDeliveryPincode] = useState("");
  const [deliveryPreview, setDeliveryPreview] = useState({
    status: "idle",
    message: "Enter a 6-digit pincode to preview delivery timing.",
    courierName: "",
    estimatedDelivery: "",
  });
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success",
  });
  const fallbackPollRef = useRef(null);
  const reviewScrollerRef = useRef(null);
  const galleryTouchStartXRef = useRef(null);
  const { lookupPincode } = useIndiaPincodeLookup();

  const defaultVariant =
    product?.hasVariants && Array.isArray(product?.variants)
      ? product.variants.find((variant) => variant?.isDefault) ||
        product.variants[0] ||
        null
      : null;
  const selectedVariantId = selectedVariant?._id || selectedVariant?.id || null;
  const resolvedSelectedVariant =
    product?.hasVariants &&
    Array.isArray(product?.variants) &&
    selectedVariantId
      ? product.variants.find(
          (variant) =>
            String(variant?._id || variant?.id || "") ===
            String(selectedVariantId),
        ) || selectedVariant
      : selectedVariant;

  const activePrice = resolvedSelectedVariant
    ? resolvedSelectedVariant.price
    : product?.price;
  const activeOriginalPrice = resolvedSelectedVariant
    ? resolvedSelectedVariant.originalPrice
    : product?.originalPrice;
  const activeDiscountPercent =
    toNumber(activeOriginalPrice, 0) > toNumber(activePrice, 0)
      ? Math.round(
          ((toNumber(activeOriginalPrice, 0) - toNumber(activePrice, 0)) /
            toNumber(activeOriginalPrice, 0)) *
            100,
        )
      : 0;
  const demoReviewFallback = isDemoPreview ? buildDemoReviews() : [];
  const pageConfig = normalizeProductPageConfig(product?.productPage);
  const activeStock = resolvedSelectedVariant
    ? getResolvedAvailableStock(resolvedSelectedVariant)
    : null;
  const availableQty =
    activeStock !== null
      ? activeStock
      : product
        ? Math.max(
            typeof product.available_quantity === "number"
              ? product.available_quantity
              : Number(product.stock_quantity ?? product.stock ?? 0) -
                  Number(product.reserved_quantity ?? 0),
            0,
          )
        : 0;
  const maxQty = availableQty > 0 ? availableQty : 1;
  const displaySku =
    resolvedSelectedVariant?.sku || defaultVariant?.sku || product?.sku || "";
  const productId = getResolvedProductId(product);
  const currentVariantInCart =
    productId && isInCart(productId, selectedVariantId);
  const effectiveReviewVariantId = product?.hasVariants
    ? reviewVariantFilter ||
      selectedVariantId ||
      defaultVariant?._id ||
      defaultVariant?.id ||
      ""
    : "";
  const variantFilteredReviews = (
    customerReviews.length > 0 ? customerReviews : demoReviewFallback
  ).filter((review) => {
    if (!product?.hasVariants) return true;
    return (
      String(review?.variantId || "") === String(effectiveReviewVariantId || "")
    );
  });
  const variantReviewCount = variantFilteredReviews.length;
  const variantAverageRating =
    variantReviewCount > 0
      ? variantFilteredReviews.reduce(
          (sum, review) => sum + Math.max(Number(review?.rating || 0), 0),
          0,
        ) / variantReviewCount
      : 0;
  const displayReviews = variantFilteredReviews.slice().sort((a, b) => {
    if (reviewSort === "latest") {
      return (
        new Date(b?.createdAt || 0).getTime() -
        new Date(a?.createdAt || 0).getTime()
      );
    }
    const ratingDelta =
      reviewSort === "lowest"
        ? Number(a?.rating || 0) - Number(b?.rating || 0)
        : Number(b?.rating || 0) - Number(a?.rating || 0);
    if (ratingDelta !== 0) return ratingDelta;
    return (
      new Date(b?.createdAt || 0).getTime() -
      new Date(a?.createdAt || 0).getTime()
    );
  });
  const productRating = variantReviewCount > 0 ? variantAverageRating : 0;
  const reviewCarouselItems = displayReviews.slice(0, 10);
  const allReviewsPageSize = 6;
  const allReviewsTotalPages = Math.max(
    1,
    Math.ceil(displayReviews.length / allReviewsPageSize),
  );
  const paginatedReviews = displayReviews.slice(
    (reviewPage - 1) * allReviewsPageSize,
    reviewPage * allReviewsPageSize,
  );
  const displayReviewCount = variantReviewCount;
  const tabs = [
    pageConfig?.tabs?.showDescription !== false
      ? {
          id: "description",
          label: mergeTextOverride(
            pageConfig?.tabs?.descriptionLabel,
            DEFAULT_TABS[0].label,
          ),
        }
      : null,
    pageConfig?.tabs?.showDetails !== false
      ? {
          id: "details",
          label: mergeTextOverride(
            pageConfig?.tabs?.detailsLabel,
            DEFAULT_TABS[1].label,
          ),
        }
      : null,
    pageConfig?.tabs?.showShipping !== false
      ? {
          id: "shipping",
          label: mergeTextOverride(
            pageConfig?.tabs?.shippingLabel,
            DEFAULT_TABS[2].label,
          ),
        }
      : null,
  ].filter(Boolean);
  const productDescriptionParagraphs = splitTextParagraphs(
    product?.description || "",
  );
  const productStoryText = stripHtml(product?.productStory || "");
  const storyEyebrowText = pageConfig?.hero?.storyEyebrow || "";
  const storyTitleText = pageConfig?.hero?.storyTitle || "";
  const storyDescriptionOverride = pageConfig?.hero?.storyDescription || "";
  const storyDescriptionText = storyDescriptionOverride || productStoryText;
  const showStoryHeader = [storyEyebrowText, storyTitleText, storyDescriptionText].some(
    Boolean,
  );
  const fallbackDescriptionParagraphs =
    productDescriptionParagraphs.length > 0
      ? []
      : buildDescriptionParagraphs(product);
  const editorialDescriptionText =
    pageConfig?.descriptionSection?.editorialDescription || "";
  const descriptionParagraphs = mergeListWithDefaults(
    pageConfig?.descriptionSection?.extraParagraphs || [],
    fallbackDescriptionParagraphs,
  ).filter((paragraph, index, allParagraphs) => {
    const normalized = normalizeComparableText(paragraph);
    if (!normalized) return false;
    if (normalized === normalizeComparableText(editorialDescriptionText)) {
      return false;
    }
    if (
      productDescriptionParagraphs.some(
        (productParagraph) =>
          normalizeComparableText(productParagraph) === normalized,
      )
    ) {
      return false;
    }
    return (
      allParagraphs.findIndex(
        (item) => normalizeComparableText(item) === normalized,
      ) === index
    );
  });
  const defaultDetailCards = buildDetailCards({
    product,
    selectedVariant: resolvedSelectedVariant,
    availableQty,
    avgRating: productRating,
    reviewCount: displayReviewCount,
  });
  const detailCards = mergeCardCopyWithDefaults(
    defaultDetailCards,
    pageConfig?.detailsSection?.cards || [],
  );
  const defaultShippingPoints = buildShippingPoints();
  const shippingPoints = mergeListWithDefaults(
    pageConfig?.shippingSection?.points || [],
    defaultShippingPoints,
  );
  const images = resolveProductImages(
    product,
    selectedVariant,
    isDemoPreview ? buildDemoProduct().images : [],
  );
  const activeImage = images[activeImageIndex] || images[0] || "/product_1.png";
  const visibleGalleryImages = images.slice(0, 4);
  const remainingGalleryCount = Math.max(images.length - 4, 0);
  const selectedPackLabel =
    resolveVariantLabel(selectedVariant, product) ||
    resolveVariantLabel(defaultVariant, product) ||
    "Default option";
  const activeWeightGrams = resolvedSelectedVariant
    ? getWeightInGrams(resolvedSelectedVariant) ||
      convertWeightToGrams(
        resolvedSelectedVariant.weight ?? product?.weight,
        resolvedSelectedVariant.unit ?? product?.unit,
      )
    : getWeightInGrams(product) ||
      convertWeightToGrams(product?.weight, product?.unit);
  const deliveryPreviewWeightGrams =
    activeWeightGrams > 0 ? activeWeightGrams : 500;
  const deliveryPreviewOrderAmount = Math.max(toNumber(activePrice, 0), 0);
  const reviewSummaryLabel =
    displayReviewCount > 0
      ? `${displayReviewCount} review${displayReviewCount === 1 ? "" : "s"}`
      : "No reviews yet";
  const heroStatusLabel = getHeroStatusLabel(product, displayReviewCount);
  const deliveryReady = deliveryPincode.length === 6;
  const deliveryIdleMessage = mergeTextOverride(
    pageConfig?.hero?.deliveryHelperText,
    "Enter a 6-digit pincode to preview delivery timing.",
  );
  const deliveryMessage =
    deliveryPreview.status === "idle"
      ? deliveryIdleMessage
      : deliveryPreview.message;
  const showDescriptionSection =
    pageConfig?.tabs?.showDescription !== false &&
    pageConfig?.descriptionSection?.show !== false;
  const showDetailsSection =
    pageConfig?.tabs?.showDetails !== false &&
    pageConfig?.detailsSection?.show !== false;
  const showShippingSection =
    pageConfig?.tabs?.showShipping !== false &&
    pageConfig?.shippingSection?.show !== false;
  const showHeroStoryCard = pageConfig?.hero?.showStoryCard !== false;
  const showHeroInsightCards = pageConfig?.hero?.showInsightCards !== false;
  const showHeroSupportCards = pageConfig?.hero?.showSupportCards !== false;
  const showHeroDeliveryPreview =
    pageConfig?.hero?.showDeliveryPreview !== false;
  const supportCards = mergeCardCopyWithDefaults(
    DEFAULT_SUPPORT_CARDS,
    pageConfig?.hero?.supportCards || [],
  );
  const showReviewsSection = pageConfig?.reviewsSection?.show !== false;
  const showPublicReviewForm =
    !isDemoPreview &&
    showReviewsSection &&
    reviewSettings.allowPublicSubmissions !== false &&
    reviewSettings.showPublicReviewForm !== false;
  const showFrequentlyBoughtSection =
    !isDemoPreview && pageConfig?.frequentlyBoughtSection?.show !== false;
  const showRecommendedCombosSection =
    !isDemoPreview && pageConfig?.recommendedCombosSection?.show !== false;
  const galleryGridClassName = showHeroStoryCard
    ? "relative mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-stretch"
    : "relative mt-6";
  const imageStageClassName = showHeroStoryCard
    ? "product-image-stage relative flex min-h-[480px] overflow-hidden rounded-[30px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.92)_0%,rgba(244,236,229,0.88)_100%)] p-0 lg:h-full lg:min-h-[540px]"
    : "product-image-stage relative mx-auto flex min-h-[420px] max-w-[840px] overflow-hidden rounded-[30px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.92)_0%,rgba(244,236,229,0.88)_100%)] p-0";

  const fetchReviewSettings = useCallback(async () => {
    try {
      const response = await fetchDataFromApi(
        "/api/settings/public/reviewSettings",
      );
      if (response?.success) {
        const nextValue = response?.data?.value || response?.data || {};
        setReviewSettings(normalizePublicReviewSettings(nextValue));
        return;
      }
    } catch (error) {
      console.error("Error fetching review settings:", error);
    }

    setReviewSettings(DEFAULT_REVIEW_SETTINGS);
  }, []);

  const fetchProductReviews = useCallback(
    async (productValueId, variantId = "") => {
      if (!productValueId) {
        setCustomerReviews([]);
        return;
      }

      try {
        setReviewsLoading(true);
        const variantQuery = variantId
          ? `?variantId=${encodeURIComponent(String(variantId))}`
          : "";
        const response = await fetchDataFromApi(
          `/api/reviews/${productValueId}${variantQuery}`,
        );
        if (response?.success && Array.isArray(response?.data)) {
          setCustomerReviews(response.data);
        } else {
          setCustomerReviews([]);
        }
      } catch (error) {
        console.error("Error fetching product reviews:", error);
        setCustomerReviews([]);
      } finally {
        setReviewsLoading(false);
      }
    },
    [],
  );

  const handleSubmitPublicReview = async () => {
    const activeProductId = getResolvedProductId(product);
    const userName = String(publicReviewForm.userName || "").trim();
    const comment = String(publicReviewForm.comment || "").trim();
    const city = String(publicReviewForm.city || "").trim();
    const rating = Number(publicReviewForm.rating || 0);

    if (!activeProductId) {
      setSnackbar({
        open: true,
        message: "Product context missing. Please refresh and try again.",
        severity: "error",
      });
      return;
    }

    if (!userName) {
      setSnackbar({
        open: true,
        message: "Please enter your name before submitting a review.",
        severity: "error",
      });
      return;
    }

    if (!comment) {
      setSnackbar({
        open: true,
        message: "Please write a short review comment.",
        severity: "error",
      });
      return;
    }

    if (!rating || rating < 1 || rating > 5) {
      setSnackbar({
        open: true,
        message: "Please select a rating between 1 and 5.",
        severity: "error",
      });
      return;
    }

    setSubmittingPublicReview(true);
    try {
      const response = await postData("/api/reviews", {
        productId: activeProductId,
        variantId: selectedVariantId || null,
        userName,
        city,
        rating,
        comment,
      });

      if (!response?.success) {
        throw new Error(response?.message || "Failed to submit review.");
      }

      const nextReview = response?.data || null;
      if (nextReview) {
        setCustomerReviews((current) => [nextReview, ...current]);
      }

      setPublicReviewForm({
        userName: "",
        city: "",
        rating: 5,
        comment: "",
      });
      setSnackbar({
        open: true,
        message: "Review submitted successfully.",
        severity: "success",
      });
    } catch (error) {
      setSnackbar({
        open: true,
        message: error?.message || "Failed to submit review.",
        severity: "error",
      });
    } finally {
      setSubmittingPublicReview(false);
    }
  };

  const fetchFallbackProducts = useCallback(
    async ({ categoryId = "", excludeId = "", limit = 5 } = {}) => {
      const categoryQuery = categoryId
        ? `category=${encodeURIComponent(String(categoryId))}&`
        : "";
      const excludeQuery = excludeId
        ? `&exclude=${encodeURIComponent(String(excludeId))}`
        : "";
      const urls = [
        categoryId
          ? `/api/products?${categoryQuery}sortBy=popular&order=desc&limit=${limit}${excludeQuery}`
          : "",
        `/api/products?bestSeller=true&sortBy=popular&order=desc&limit=${limit}${excludeQuery}`,
        `/api/products?sortBy=createdAt&order=desc&limit=${limit}${excludeQuery}`,
      ].filter(Boolean);

      for (const url of urls) {
        try {
          const response = await fetchDataFromApi(url);
          const items = Array.isArray(response?.data) ? response.data : [];
          const visibleItems = items.filter(
            (item) => !isExclusiveProduct(item),
          );
          if (visibleItems.length > 0) return visibleItems;
        } catch {
          // Try the next fallback source.
        }
      }
      return [];
    },
    [],
  );

  const fetchFrequentlyBought = useCallback(
    async (productValueId, categoryId = "") => {
      if (!productValueId) {
        setFrequentlyBought([]);
        return;
      }

      try {
        setFbtLoading(true);
        const response = await fetchDataFromApi(
          `/api/products/${productValueId}/frequently-bought?limit=3`,
        );
        if (response?.success && Array.isArray(response?.data)) {
          const items = response.data.filter(
            (item) => !isExclusiveProduct(item),
          );
          if (items.length > 0) {
            setFrequentlyBought(items);
            return;
          }
        } else {
          const fallbackProducts = await fetchFallbackProducts({
            categoryId,
            excludeId: productValueId,
            limit: 3,
          });
          setFrequentlyBought(
            fallbackProducts.map((fallbackProduct) => ({
              product: fallbackProduct,
              recommendation: { product: fallbackProduct },
            })),
          );
          return;
        }
        const fallbackProducts = await fetchFallbackProducts({
          categoryId,
          excludeId: productValueId,
          limit: 3,
        });
        setFrequentlyBought(
          fallbackProducts.map((fallbackProduct) => ({
            product: fallbackProduct,
            recommendation: { product: fallbackProduct },
          })),
        );
      } catch (error) {
        console.error("Error fetching frequently bought together:", error);
        const fallbackProducts = await fetchFallbackProducts({
          categoryId,
          excludeId: productValueId,
          limit: 3,
        });
        setFrequentlyBought(
          fallbackProducts.map((fallbackProduct) => ({
            product: fallbackProduct,
            recommendation: { product: fallbackProduct },
          })),
        );
      } finally {
        setFbtLoading(false);
      }
    },
    [fetchFallbackProducts],
  );

  const fetchRecommendedCombos = useCallback(async (productValueId) => {
    if (!productValueId) {
      setRecommendedCombos([]);
      return;
    }

    try {
      setRecommendedLoading(true);
      const response = await fetchDataFromApi(
        `/api/combos/sections?productId=${productValueId}`,
      );
      if (response?.success) {
        const combos = (response?.data?.recommendedCombos || []).filter(
          (combo) => !isExclusiveCombo(combo),
        );
        setRecommendedCombos(combos);
      } else {
        setRecommendedCombos([]);
      }
    } catch (error) {
      console.error("Error fetching recommended combos:", error);
      setRecommendedCombos([]);
    } finally {
      setRecommendedLoading(false);
    }
  }, []);

  const fetchProduct = useCallback(
    async ({ showLoader = true, preserveCurrent = false } = {}) => {
      try {
        if (showLoader) {
          setLoading(true);
        }
        const response = await fetchDataFromApi(`/api/products/${routeId}`, {
          skipCache: true,
        });

        if (response?.error !== true && response?.data) {
          const resolvedProduct = response.data;
          const resolvedProductId = getResolvedProductId(resolvedProduct);
          const resolvedPageConfig = normalizeProductPageConfig(
            resolvedProduct?.productPage,
          );

          setProduct(resolvedProduct);
          setSelectedVariant((previous) => {
            if (
              !resolvedProduct?.hasVariants ||
              !Array.isArray(resolvedProduct?.variants)
            ) {
              return null;
            }

            const previousVariantId = previous?._id || previous?.id;
            if (previousVariantId) {
              const matchedVariant =
                resolvedProduct.variants.find(
                  (variant) =>
                    String(variant?._id || variant?.id || "") ===
                    String(previousVariantId),
                ) || null;
              if (matchedVariant) {
                return matchedVariant;
              }
            }

            return (
              resolvedProduct.variants.find((variant) => variant?.isDefault) ||
              resolvedProduct.variants[0] ||
              null
            );
          });

          trackEvent("product_view", {
            productId: String(resolvedProductId || ""),
            productName: String(
              resolvedProduct?.name || resolvedProduct?.title || "",
            ),
            categoryId: String(
              resolvedProduct?.category?._id || resolvedProduct?.category || "",
            ),
            price: Number(resolvedProduct?.price || 0),
          });

          if (resolvedPageConfig?.reviewsSection?.show === false) {
            setCustomerReviews([]);
          }

          if (resolvedPageConfig?.frequentlyBoughtSection?.show !== false) {
            fetchFrequentlyBought(
              resolvedProductId,
              resolvedProduct?.category?._id || resolvedProduct?.category || "",
            );
          } else {
            setFrequentlyBought([]);
          }

          if (resolvedPageConfig?.recommendedCombosSection?.show !== false) {
            fetchRecommendedCombos(resolvedProductId);
          } else {
            setRecommendedCombos([]);
          }
        } else {
          if (!preserveCurrent) {
            setProduct(null);
          }
        }
      } catch (error) {
        console.error("Error fetching product:", error);
        if (!preserveCurrent) {
          setProduct(null);
          setCustomerReviews([]);
          setFrequentlyBought([]);
          setRecommendedCombos([]);
        }
      } finally {
        if (showLoader) {
          setLoading(false);
        }
      }
    },
    [fetchFrequentlyBought, fetchRecommendedCombos, routeId],
  );

  const stopFallbackPolling = useCallback(() => {
    if (fallbackPollRef.current && typeof window !== "undefined") {
      window.clearInterval(fallbackPollRef.current);
    }
    fallbackPollRef.current = null;
  }, []);

  const startFallbackPolling = useCallback(() => {
    if (
      typeof window === "undefined" ||
      fallbackPollRef.current ||
      isDemoPreview
    ) {
      return;
    }

    fallbackPollRef.current = window.setInterval(() => {
      void fetchProduct({ showLoader: false, preserveCurrent: true });
    }, FALLBACK_POLL_INTERVAL_MS);
  }, [fetchProduct, isDemoPreview]);

  useEffect(() => {
    setActiveTab("description");
    setActiveImageIndex(0);
    setIsImageZoomOpen(false);
    setDeliveryPincode("");
    setQuantity(1);

    if (!routeId) return;

    if (isDemoPreview) {
      setLoading(true);
      const demoProduct = buildDemoProduct();
      setProduct(demoProduct);
      setSelectedVariant(
        demoProduct.variants.find((variant) => variant?.isDefault) ||
          demoProduct.variants[0] ||
          null,
      );
      setCustomerReviews(buildDemoReviews());
      setFrequentlyBought([]);
      setRecommendedCombos([]);
      setLoading(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    void fetchProduct();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [fetchProduct, routeId, isDemoPreview]);

  useEffect(() => {
    if (isDemoPreview) {
      setReviewSettings(DEFAULT_REVIEW_SETTINGS);
      return;
    }

    void fetchReviewSettings();
  }, [fetchReviewSettings, isDemoPreview, routeId]);

  useEffect(() => {
    if (isDemoPreview || !productId) return;

    if (showReviewsSection) {
      void fetchProductReviews(
        productId,
        product?.hasVariants ? effectiveReviewVariantId : "",
      );
    } else {
      setCustomerReviews([]);
    }
  }, [
    effectiveReviewVariantId,
    fetchProductReviews,
    isDemoPreview,
    product?.hasVariants,
    productId,
    showReviewsSection,
  ]);

  useEffect(() => {
    setReviewPage(1);
  }, [reviewVariantFilter, customerReviews.length]);

  useEffect(() => {
    if (!product?.hasVariants || !Array.isArray(product?.variants)) {
      setReviewVariantFilter("");
      return;
    }

    const nextVariantId =
      selectedVariantId || defaultVariant?._id || defaultVariant?.id || "";
    setReviewVariantFilter((previous) =>
      String(previous || "") === String(nextVariantId || "")
        ? previous
        : String(nextVariantId || ""),
    );
  }, [
    defaultVariant,
    product?.hasVariants,
    product?.variants,
    selectedVariantId,
  ]);

  useEffect(() => {
    if (!product?.hasVariants || !Array.isArray(product?.variants)) return;

    setSelectedVariant((previous) => {
      const currentVariantId = previous?._id || previous?.id;
      if (!currentVariantId) return previous;

      const nextVariant =
        product.variants.find(
          (variant) =>
            String(variant?._id || variant?.id || "") ===
            String(currentVariantId),
        ) || null;

      return nextVariant || previous;
    });
  }, [product]);

  useEffect(() => {
    if (!routeId || isDemoPreview) return undefined;

    const unsubscribeStock = subscribeToStockUpdates((payload) => {
      startTransition(() => {
        setProduct((previous) => applyStockUpdateToProduct(previous, payload));
      });
    });

    const unsubscribeConnection = subscribeToStockConnection((event) => {
      if (event?.type === "fallback_active") {
        startFallbackPolling();
        return;
      }

      if (event?.type !== "connected" && event?.type !== "reconnected") {
        return;
      }

      stopFallbackPolling();
      if (event?.type === "reconnected") {
        void fetchProduct({ showLoader: false, preserveCurrent: true });
      }
    });

    return () => {
      stopFallbackPolling();
      unsubscribeStock();
      unsubscribeConnection();
    };
  }, [
    fetchProduct,
    isDemoPreview,
    routeId,
    startFallbackPolling,
    stopFallbackPolling,
  ]);

  useEffect(() => {
    if (activeImageIndex >= images.length) {
      setActiveImageIndex(0);
    }
  }, [activeImageIndex, images.length]);

  useEffect(() => {
    if (tabs.length === 0) return;

    const hasActiveTab = tabs.some((tab) => tab.id === activeTab);
    if (!hasActiveTab) {
      setActiveTab(tabs[0].id);
    }
  }, [activeTab, tabs]);

  useEffect(() => {
    if (quantity > maxQty) {
      setQuantity(maxQty);
    }
  }, [maxQty, quantity]);

  useEffect(() => {
    const pincode = normalizePincode(deliveryPincode);

    if (!pincode) {
      setDeliveryPreview({
        status: "idle",
        message: "Enter a 6-digit pincode to preview delivery timing.",
        courierName: "",
        estimatedDelivery: "",
      });
      return undefined;
    }

    if (pincode.length < 6) {
      setDeliveryPreview({
        status: "typing",
        message: "Enter a 6-digit pincode to preview delivery timing.",
        courierName: "",
        estimatedDelivery: "",
      });
      return undefined;
    }

    if (!isPossibleIndianPincode(pincode)) {
      setDeliveryPreview({
        status: "invalid",
        message: "Enter Right Pincode",
        courierName: "",
        estimatedDelivery: "",
      });
      return undefined;
    }

    if (isDemoPreview) {
      setDeliveryPreview({
        status: "unavailable",
        message: buildStaticDeliveryMessage(pincode),
        courierName: "",
        estimatedDelivery: "",
      });
      return undefined;
    }

    let isCancelled = false;
    const timer = setTimeout(async () => {
      setDeliveryPreview({
        status: "validating",
        message: "Validating pincode...",
        courierName: "",
        estimatedDelivery: "",
      });

      const lookupResult = await lookupPincode(pincode);
      if (isCancelled) return;

      if (!lookupResult) {
        setDeliveryPreview({
          status: "unavailable",
          message: buildStaticDeliveryMessage(pincode),
          courierName: "",
          estimatedDelivery: "",
        });
        return;
      }

      if (lookupResult?.status === "empty") {
        setDeliveryPreview({
          status: "invalid",
          message: "Enter Right Pincode",
          courierName: "",
          estimatedDelivery: "",
        });
        return;
      }

      setDeliveryPreview({
        status: "checking",
        message: "Checking live delivery timing...",
        courierName: "",
        estimatedDelivery: "",
      });

      const response = await postData("/api/shipping/delivery-preview", {
        pincode,
        orderAmount: deliveryPreviewOrderAmount,
        weightGrams: deliveryPreviewWeightGrams,
        productId,
        variantId: selectedVariantId,
      });

      if (isCancelled) return;

      if (response?.success && response?.data?.available) {
        const previewData = response.data;
        const estimatedDelivery = String(
          previewData.estimatedDelivery ||
            previewData.estimatedDeliveryDate ||
            "",
        ).trim();
        const courierName = String(previewData.courierName || "").trim();
        const message = estimatedDelivery
          ? `Estimated delivery to ${pincode}: ${estimatedDelivery}.`
          : courierName
            ? `Delivery preview available via ${courierName}.`
            : `Delivery preview available for ${pincode}.`;

        setDeliveryPreview({
          status: "live",
          message,
          courierName,
          estimatedDelivery,
        });
        return;
      }

      setDeliveryPreview({
        status: "unavailable",
        message: buildStaticDeliveryMessage(pincode),
        courierName: "",
        estimatedDelivery: "",
      });
    }, 350);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [
    deliveryPincode,
    deliveryPreviewOrderAmount,
    deliveryPreviewWeightGrams,
    isDemoPreview,
    lookupPincode,
    productId,
    selectedVariantId,
  ]);

  useEffect(() => {
    if (!isImageZoomOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsImageZoomOpen(false);
        return;
      }

      if (images.length <= 1) return;

      if (event.key === "ArrowLeft") {
        setActiveImageIndex((previous) =>
          previous === 0 ? images.length - 1 : previous - 1,
        );
      }

      if (event.key === "ArrowRight") {
        setActiveImageIndex((previous) =>
          previous === images.length - 1 ? 0 : previous + 1,
        );
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isImageZoomOpen, images.length]);

  const buildCartProduct = () => {
    if (!product) return null;
    if (!selectedVariant) return product;

    return {
      ...product,
      price: selectedVariant.price,
      originalPrice: selectedVariant.originalPrice || product.originalPrice,
      selectedVariant: {
        _id: selectedVariant._id || selectedVariant.id,
        name: selectedVariant.name,
        sku: selectedVariant.sku,
        price: selectedVariant.price,
        weightInGrams: selectedVariant.weightInGrams,
        label: selectedVariant.label,
        weight: selectedVariant.weight,
        unit: selectedVariant.unit,
      },
      variantId: selectedVariant._id || selectedVariant.id,
    };
  };

  const getRecommendationPayload = (item) => {
    const recommendation = item?.recommendation || {};
    const recProduct = recommendation?.product || item?.product || null;
    if (!recProduct) return null;

    const variant = recommendation?.variant || item?.variant || null;
    const fallbackPrice = Number(recProduct?.price ?? 0);
    const rawPrice = Number(
      item?.price ?? recommendation?.price ?? variant?.price ?? fallbackPrice,
    );
    const safePrice =
      Number.isFinite(rawPrice) && rawPrice > 0
        ? rawPrice
        : Number.isFinite(fallbackPrice) && fallbackPrice > 0
          ? fallbackPrice
          : 0;

    const rawOriginalPrice = Number(
      item?.originalPrice ??
        recommendation?.originalPrice ??
        variant?.originalPrice ??
        recProduct?.originalPrice ??
        safePrice,
    );
    const safeOriginalPrice = Number.isFinite(rawOriginalPrice)
      ? Math.max(rawOriginalPrice, safePrice)
      : safePrice;

    return {
      product: recProduct,
      variant,
      variantId: variant?._id || variant?.id || null,
      label: resolveVariantLabel(variant, recProduct),
      price: safePrice > 0 ? safePrice : safeOriginalPrice,
      originalPrice: Math.max(safeOriginalPrice, safePrice),
      image:
        item?.image ||
        recommendation?.image ||
        variant?.image ||
        recProduct?.thumbnail ||
        recProduct?.images?.[0] ||
        "",
    };
  };

  const buildCartProductFromRecommendation = (item) => {
    const recommendation = getRecommendationPayload(item);
    if (!recommendation?.product) return null;

    const recProduct = recommendation.product;
    const variant = recommendation.variant;
    const price = Number(recommendation.price || 0);
    const originalPrice = Number(recommendation.originalPrice || price);

    if (recommendation.variantId) {
      return {
        ...recProduct,
        price,
        originalPrice,
        selectedVariant: {
          _id: recommendation.variantId,
          name: variant?.name,
          sku: variant?.sku,
          price,
          weightInGrams: variant?.weightInGrams,
          label: variant?.label,
          weight: variant?.weight,
          unit: variant?.unit,
        },
        variantId: recommendation.variantId,
      };
    }

    return {
      ...recProduct,
      price,
      originalPrice,
    };
  };

  const hasSelectedVariantInCart = (targetProductId, variantId) => {
    if (!targetProductId) return false;

    return cartItems.some((item) => {
      if (typeof isComboCartItem === "function" && isComboCartItem(item)) {
        return false;
      }

      const itemProductId =
        item?.product?._id || item?.product?.id || item?.product || item?.id;
      if (String(itemProductId) !== String(targetProductId)) return false;

      if (!variantId) return true;

      const itemVariantId =
        item?.variant?._id ||
        item?.variant?.id ||
        item?.variantId ||
        item?.variant ||
        item?.selectedVariant?._id ||
        item?.selectedVariant?.id ||
        null;

      return String(itemVariantId || "") === String(variantId);
    });
  };

  const openSnackbar = (message, severity = "success") => {
    setSnackbar({
      open: true,
      message,
      severity,
    });
  };

  const handleDemoAction = (message) => {
    openSnackbar(message, "success");
  };

  const handleAddToCart = async () => {
    if (!product) return;

    if (isDemoPreview) {
      handleDemoAction(
        "Demo preview only. Use this route to review the layout and interaction flow.",
      );
      return;
    }

    try {
      setActionLoading(true);

      if (currentVariantInCart) {
        await removeFromCart(productId, selectedVariantId);
        openSnackbar("Removed from cart!");
        return;
      }

      if (availableQty < quantity) {
        openSnackbar(
          availableQty > 0
            ? "Limited stock available for this selected pack."
            : "This product is currently unavailable.",
          "error",
        );
        return;
      }

      const cartProduct = buildCartProduct();
      if (!cartProduct) return;

      const addResult = await addToCart(cartProduct, quantity);
      if (addResult?.success === false) {
        openSnackbar(addResult?.message || "Unable to add this item", "error");
        return;
      }
      openSnackbar("Added to cart!");
    } catch (error) {
      console.error("Error updating cart:", error);
      openSnackbar("Failed to update cart", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleBuyNow = async () => {
    if (!product) return;

    if (isDemoPreview) {
      handleDemoAction(
        "Buy Now is preview-only on /product/demo-live so the mock route does not affect real carts.",
      );
      return;
    }

    try {
      setActionLoading(true);

      if (!currentVariantInCart) {
        if (availableQty < quantity) {
          openSnackbar(
            availableQty > 0
              ? "Limited stock available for this selected pack."
              : "This product is currently unavailable.",
            "error",
          );
          return;
        }

        const cartProduct = buildCartProduct();
        if (!cartProduct) return;
        const addResult = await addToCart(cartProduct, quantity);
        if (addResult?.success === false) {
          openSnackbar(
            addResult?.message || "Unable to add this item",
            "error",
          );
          return;
        }
      }

      router.push("/checkout");
    } catch (error) {
      console.error("Error proceeding to checkout:", error);
      openSnackbar("Unable to proceed to checkout", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddAllToCart = async () => {
    if (!product || frequentlyBought.length === 0) return;

    try {
      let addedCount = 0;
      const currentProductPayload = buildCartProduct();

      if (currentProductPayload) {
        const targetVariantId = currentProductPayload?.variantId || null;
        if (!hasSelectedVariantInCart(productId, targetVariantId)) {
          const addResult = await addToCart(currentProductPayload, quantity);
          if (addResult?.success !== false) {
            addedCount += 1;
          }
        }
      }

      for (const item of frequentlyBought) {
        const payload = buildCartProductFromRecommendation(item);
        if (!payload) continue;

        const targetProductId = getResolvedProductId(payload);
        if (!targetProductId) continue;
        if (hasSelectedVariantInCart(targetProductId, payload?.variantId)) {
          continue;
        }

        const addResult = await addToCart(payload, 1);
        if (addResult?.success !== false) {
          addedCount += 1;
        }
      }

      openSnackbar(
        addedCount > 0
          ? "Added bundle items to cart!"
          : "All bundle items are already in your cart.",
      );
    } catch (error) {
      console.error("Error adding bundle items:", error);
      openSnackbar("Failed to add bundle items", "error");
    }
  };

  const handleAddSingleRecommendation = async (item) => {
    const payload = buildCartProductFromRecommendation(item);
    if (!payload) {
      openSnackbar("Unable to add this item right now", "error");
      return;
    }

    const targetProductId = getResolvedProductId(payload);
    const targetVariantId = payload?.variantId || null;
    if (hasSelectedVariantInCart(targetProductId, targetVariantId)) {
      openSnackbar("Item already in your cart");
      return;
    }

    try {
      const addResult = await addToCart(payload, 1);
      if (addResult?.success === false) {
        openSnackbar(addResult?.message || "Unable to add this item", "error");
        return;
      }
      openSnackbar("Added to cart!");
    } catch (error) {
      console.error("Error adding recommendation:", error);
      openSnackbar("Failed to add item", "error");
    }
  };

  const isBuyNowDisabled =
    actionLoading || (!currentVariantInCart && availableQty === 0);
  const isOutOfStock = availableQty === 0;
  const selectedVariantStockQuantity = Math.max(
    Number(
      resolvedSelectedVariant?.stock_quantity ??
        resolvedSelectedVariant?.stock ??
        0,
    ),
    0,
  );
  const selectedVariantReservedQuantity = Math.max(
    Number(resolvedSelectedVariant?.reserved_quantity ?? 0),
    0,
  );
  const isReservedForCheckout =
    isOutOfStock && selectedVariantReservedQuantity > 0;
  const notifyVariantId = selectedVariantId || defaultVariant?._id || null;
  const notifyVariantName =
    (resolvedSelectedVariant
      ? formatVariantLabel(resolvedSelectedVariant)
      : "") || (defaultVariant ? formatVariantLabel(defaultVariant) : "");
  const notifyRequested = Boolean(
    resolvedSelectedVariant?.stockNotificationRequested ||
    defaultVariant?.stockNotificationRequested ||
    product?.stockNotificationRequested,
  );
  const showPreviousImage = () => {
    if (images.length <= 1) return;
    setActiveImageIndex((previous) =>
      previous === 0 ? images.length - 1 : previous - 1,
    );
  };
  const showNextImage = () => {
    if (images.length <= 1) return;
    setActiveImageIndex((previous) =>
      previous === images.length - 1 ? 0 : previous + 1,
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8f2ec]">
        <CircularProgress style={{ color: "var(--primary)" }} />
      </div>
    );
  }

  if (!product) {
    return (
      <section className="min-h-screen bg-[#f8f2ec] px-4 py-16">
        <div className="mx-auto max-w-3xl rounded-[32px] border border-[#e7d7cb] bg-white p-10 text-center shadow-[0_28px_80px_-48px_rgba(52,32,20,0.35)]">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#7c5e4e]">
            Product Detail
          </p>
          <h1 className="mt-3 text-3xl font-semibold text-[#23150f]">
            Product not found
          </h1>
          <p className="mt-4 text-base text-[#6a5548]">
            The item you are trying to open is unavailable right now. Please
            return to the catalog and choose another product.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section
      className="product-page-shell min-h-screen pb-20"
      style={{
        fontFamily: "var(--font-poppins), var(--font-inter), sans-serif",
        background:
          "var(--flavor-page-bg, radial-gradient(circle_at_top, #f7efe5 0%, #fffaf5 42%, #f4eee7 100%))",
      }}
    >
      <div className="mx-auto max-w-[1320px] px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center gap-2 text-sm text-[#7f6657]">
          <Link href="/" className="hover:text-[#23150f]">
            Home
          </Link>
          <span>/</span>
          <Link href="/products" className="hover:text-[#23150f]">
            Products
          </Link>
          <span>/</span>
          <span className="font-medium text-[#23150f]">
            {product?.name || product?.title}
          </span>
        </div>

        <div className="mt-6 grid gap-6 xl:items-start xl:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)]">
          <div className="space-y-4">
            <div className="product-hero-shell product-reveal product-reveal-delay-1 relative overflow-hidden rounded-[36px] border border-[#e1cdbf] bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.96)_0%,_rgba(250,240,231,0.95)_38%,_rgba(238,225,210,0.92)_100%)] p-4 shadow-[0_34px_90px_-55px_rgba(44,29,20,0.45)] sm:p-6">
              <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.55)_0%,rgba(255,255,255,0)_55%)]" />
              <div className="relative flex flex-wrap items-start justify-between gap-3">
                <div className="inline-flex items-center gap-2 rounded-full border border-[#eadfd5] bg-white/90 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#6a4b39] backdrop-blur">
                  Product gallery
                </div>
                {images.length > 1 ? (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={showPreviousImage}
                      className="slider-nav border border-white/70 transition hover:-translate-y-0.5"
                      aria-label="Previous image"
                    >
                      <FiChevronLeft />
                    </button>
                    <button
                      type="button"
                      onClick={showNextImage}
                      className="slider-nav border border-white/70 transition hover:-translate-y-0.5"
                      aria-label="Next image"
                    >
                      <FiChevronRight />
                    </button>
                  </div>
                ) : null}
              </div>

              <div className={galleryGridClassName}>
                <div className={imageStageClassName}>
                  <button
                    type="button"
                    onClick={() => setIsImageZoomOpen(true)}
                    onKeyDown={(event) => {
                      if (event.key === "ArrowLeft") showPreviousImage();
                      if (event.key === "ArrowRight") showNextImage();
                    }}
                    onTouchStart={(event) => {
                      galleryTouchStartXRef.current =
                        event.touches?.[0]?.clientX ?? null;
                    }}
                    onTouchEnd={(event) => {
                      const startX = galleryTouchStartXRef.current;
                      const endX = event.changedTouches?.[0]?.clientX ?? null;
                      galleryTouchStartXRef.current = null;
                      if (startX == null || endX == null) return;
                      const delta = endX - startX;
                      if (Math.abs(delta) < 36) return;
                      if (delta > 0) showPreviousImage();
                      else showNextImage();
                    }}
                    className="group relative z-10 flex h-full w-full cursor-zoom-in overflow-hidden rounded-[28px]"
                    aria-label="Open product image zoom"
                  >
                    <ProductImage
                      src={activeImage}
                      alt={product?.name || product?.title || "Product image"}
                      fit="cover"
                      aspect=""
                      rounded="rounded-[28px]"
                      className="h-full w-full bg-transparent"
                      imgClassName="transition duration-300 ease-out group-hover:scale-[1.03]"
                    />
                    <span className="pointer-events-none absolute bottom-3 right-3 inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/85 px-3 py-1.5 text-xs font-semibold text-[#1d3740] opacity-0 transition group-hover:opacity-100">
                      <FiMaximize2 className="text-sm" />
                      Click to zoom
                    </span>
                  </button>
                  {images.length > 1 ? (
                    <>
                      <button
                        type="button"
                        onClick={showPreviousImage}
                        className="slider-nav absolute left-4 top-1/2 -translate-y-1/2 transition hover:bg-white"
                        aria-label="Previous product image"
                      >
                        <FiChevronLeft />
                      </button>
                      <button
                        type="button"
                        onClick={showNextImage}
                        className="slider-nav absolute right-4 top-1/2 -translate-y-1/2 transition hover:bg-white"
                        aria-label="Next product image"
                      >
                        <FiChevronRight />
                      </button>
                    </>
                  ) : null}
                </div>

                {showHeroStoryCard ? (
                  <div className="product-story-card product-reveal product-reveal-delay-2 rounded-[30px] border border-[#86614f] bg-[linear-gradient(155deg,_#3d2316_0%,_#6a4331_52%,_#8c634f_100%)] p-6 text-white shadow-[0_28px_60px_-45px_rgba(61,35,22,0.92)] lg:flex lg:h-full lg:flex-col">
                    {showStoryHeader ? (
                      <>
                        {storyEyebrowText ? (
                          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#f1d9c9]">
                            {storyEyebrowText}
                          </p>
                        ) : null}
                        {storyTitleText ? (
                          <h2 className="mt-3 text-2xl font-semibold leading-tight">
                            {storyTitleText}
                          </h2>
                        ) : null}
                        {storyDescriptionText ? (
                          <p className="mt-4 text-sm leading-6 text-[#f8ebe2]">
                            {storyDescriptionText}
                          </p>
                        ) : null}
                      </>
                    ) : null}
                    <div className={`grid gap-3 ${showStoryHeader ? "mt-6" : ""}`}>
                      {detailCards.slice(0, 2).map((card) => (
                        <div
                          key={card.label}
                          className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3"
                        >
                          <p className="text-[11px] uppercase tracking-[0.16em] text-[#bad8e2]">
                            {card.label}
                          </p>
                          <p className="mt-1 text-lg font-semibold">
                            {card.value}
                          </p>
                          <p className="text-xs text-[#d9edf2]">
                            {card.helper}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            {images.length > 1 ? (
              <div className="grid grid-cols-4 gap-3">
                {visibleGalleryImages.map((image, index) => {
                  const showMoreOverlay =
                    index === 3 && remainingGalleryCount > 0;
                  return (
                    <button
                      key={`${image}-${index}`}
                      type="button"
                      onClick={() => {
                        setActiveImageIndex(index);
                        if (showMoreOverlay) {
                          setIsImageZoomOpen(true);
                        }
                      }}
                      className={`overflow-hidden rounded-[22px] border bg-white p-2 shadow-sm transition ${
                        activeImageIndex === index
                          ? "border-[#123b4a] shadow-[0_18px_40px_-28px_rgba(18,59,74,0.7)]"
                          : "border-[#eadcd1] hover:-translate-y-0.5 hover:border-[#b9d0d8]"
                      }`}
                    >
                      <ProductImage
                        src={image}
                        alt={`Preview ${index + 1}`}
                        aspect="aspect-square"
                        fit="cover"
                        padding="p-1"
                        rounded="rounded-[16px]"
                        className="w-full"
                      >
                        {showMoreOverlay ? (
                          <span className="absolute inset-2 flex items-center justify-center rounded-[16px] bg-black/55 text-lg font-semibold text-white">
                            +{remainingGalleryCount}
                          </span>
                        ) : null}
                      </ProductImage>
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>

          <div className="xl:sticky xl:top-[calc(var(--header-height)+20px)]">
            <div className="product-reveal product-reveal-delay-2 rounded-[36px] border border-[#e1cdbf] bg-white/88 p-6 shadow-[0_34px_90px_-55px_rgba(44,29,20,0.38)] backdrop-blur sm:p-8">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#7b6355]">
                {product?.brand || "Healthy One Gram"}
              </p>
              <h1 className="mt-3 text-3xl font-semibold leading-tight text-[#24150f] sm:text-[2.55rem]">
                {product?.name || product?.title}
              </h1>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <div className="inline-flex items-center gap-2 rounded-full border border-[#eaded5] bg-[#faf6f1] px-4 py-2 text-sm font-medium text-[#2f190f]">
                  <Rating
                    value={productRating}
                    precision={0.5}
                    readOnly
                    size="small"
                  />
                  <span>({displayReviewCount})</span>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-[#eaded5] bg-[#f4eadf] px-4 py-2 text-sm font-medium text-[#6a4b39]">
                  <MdVerified className="text-base" />
                  {heroStatusLabel}
                </div>
                <div className="ml-auto">
                  <ShareButton
                    productId={productId || DEMO_PRODUCT_ID}
                    productName={product?.name || product?.title}
                    variant="icon"
                    iconSizeClass="h-11 w-11"
                    iconGlyphClass="h-4 w-4"
                  />
                </div>
              </div>

              <p className="mt-5 text-base leading-7 text-[#5d4b41]">
                {product?.shortDescription ||
                  "A richer product detail layout with stronger visual storytelling, better CTA placement, and a cleaner lower content section."}
              </p>

              <div className="mt-7 flex flex-wrap items-end gap-3">
                <p className="text-4xl font-semibold text-[#24150f]">
                  {formatPrice(toNumber(activePrice, 0))}
                </p>
                {toNumber(activeOriginalPrice, 0) > toNumber(activePrice, 0) ? (
                  <p className="pb-1 text-lg font-medium text-[#9a8476] line-through">
                    {formatPrice(toNumber(activeOriginalPrice, 0))}
                  </p>
                ) : null}
                {activeDiscountPercent > 0 ? (
                  <span
                    className="rounded-full px-4 py-2 text-sm font-semibold"
                    style={{
                      backgroundColor: "var(--primary)",
                      color: "var(--flavor-text, #ffffff)",
                    }}
                  >
                    Save {activeDiscountPercent}%
                  </span>
                ) : null}
              </div>

              {product?.hasVariants &&
              Array.isArray(product?.variants) &&
              product.variants.length > 1 ? (
                <div className="mt-8">
                  <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#7b6355]">
                    Weight / Pack
                  </p>
                  <div className="mt-3 flex flex-wrap gap-3">
                    {product.variants.map((variant) => {
                      const variantId = variant?._id || variant?.id;
                      const isSelected =
                        String(variantId || "") ===
                        String(selectedVariantId || "");

                      return (
                        <button
                          key={variantId || variant.name}
                          type="button"
                          onClick={() => {
                            setSelectedVariant(variant);
                            setActiveImageIndex(0);
                            setQuantity(1);
                          }}
                          className={`rounded-2xl border px-5 py-3 text-left text-sm font-semibold transition ${
                            isSelected
                              ? ""
                              : "border-[#d5c3b7] bg-white text-[#38231a] hover:-translate-y-0.5"
                          }`}
                          style={
                            isSelected
                              ? {
                                  borderColor: "var(--primary)",
                                  backgroundColor: "var(--primary)",
                                  color: "var(--flavor-text, #ffffff)",
                                }
                              : undefined
                          }
                        >
                          {formatVariantLabel(variant)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              <div
                className={`mt-8 grid gap-4 ${showHeroDeliveryPreview ? "xl:grid-cols-2" : ""}`}
              >
                {showHeroDeliveryPreview ? (
                  <div className="h-full rounded-[28px] border border-[#e3d4c9] bg-[#fbf7f2] p-5">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#7b6355]">
                        {mergeTextOverride(
                          pageConfig?.hero?.deliveryEyebrow,
                          "Delivery Preview",
                        )}
                      </p>
                      <span className="text-xs font-medium text-[#5d4b41]">
                        {deliveryPreview.status === "live"
                          ? "Live"
                          : deliveryPreview.status === "checking" ||
                              deliveryPreview.status === "validating"
                            ? "Checking"
                            : deliveryPreview.status === "invalid"
                              ? "Invalid"
                              : deliveryReady
                                ? mergeTextOverride(
                                    pageConfig?.hero?.deliveryReadyLabel,
                                    "Ready",
                                  )
                                : mergeTextOverride(
                                    pageConfig?.hero?.deliveryOptionalLabel,
                                    "Optional",
                                  )}
                      </span>
                    </div>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={deliveryPincode}
                      onChange={(event) =>
                        setDeliveryPincode(normalizePincode(event.target.value))
                      }
                      placeholder={mergeTextOverride(
                        pageConfig?.hero?.deliveryInputPlaceholder,
                        "Enter pincode",
                      )}
                      className="product-delivery-input mt-4 h-14 w-full rounded-2xl border border-[#d8c6bb] bg-white px-4 text-base text-[#24150f] outline-none transition"
                    />
                    <p
                      className={`mt-3 text-sm ${
                        deliveryPreview.status === "invalid"
                          ? "font-semibold text-[#b42318]"
                          : "text-[#5d4b41]"
                      }`}
                    >
                      {deliveryMessage}
                    </p>
                  </div>
                ) : null}

                <div className="h-full rounded-[28px] border border-[#e3d4c9] bg-[#fbf7f2] p-5">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#7b6355]">
                      Quantity
                    </p>
                    <div className="mt-3 inline-flex items-center gap-3 rounded-2xl border border-[#d8c6bb] bg-white p-2">
                      <button
                        type="button"
                        onClick={() =>
                          setQuantity((previous) => Math.max(previous - 1, 1))
                        }
                        disabled={isOutOfStock}
                        className="product-qty-action flex h-10 w-10 items-center justify-center rounded-xl text-lg font-semibold transition disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        -
                      </button>
                      <span className="min-w-[40px] text-center text-lg font-semibold text-[#24150f]">
                        {quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setQuantity((previous) =>
                            Math.min(previous + 1, maxQty),
                          )
                        }
                        disabled={isOutOfStock}
                        className="product-qty-action flex h-10 w-10 items-center justify-center rounded-xl text-lg font-semibold transition disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        +
                      </button>
                    </div>
                    <p className="mt-4 text-xs font-semibold uppercase tracking-[0.16em] text-[#7b6355]">
                      SKU
                    </p>
                    <p className="mt-1 break-all text-sm font-semibold text-[#5d4b41]">
                      {displaySku || "-"}
                    </p>
                  </div>
                </div>
              </div>

              {isOutOfStock ? (
                <div className="mt-8 rounded-[28px] border border-[#f3d2c9] bg-[linear-gradient(135deg,#fff8f5_0%,#fffdf9_100%)] p-5 shadow-[0_24px_60px_-46px_rgba(77,33,20,0.42)]">
                  <div className="inline-flex rounded-full bg-[#fef2f2] px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-[#cb1f1f]">
                    {isReservedForCheckout
                      ? "Reserved for checkout"
                      : "Out of stock"}
                  </div>
                  <p className="mt-3 text-lg font-semibold text-[#24150f]">
                    {isReservedForCheckout
                      ? "This pack is temporarily reserved"
                      : "We&apos;re restocking soon"}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-[#6b5144]">
                    {isReservedForCheckout
                      ? "Another customer has this pack in checkout right now. If payment is not completed, the reservation will expire and the pack will return automatically."
                      : "This pack is currently unavailable, but we can alert you the moment it is ready to order again."}
                  </p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl border border-[#ead7cb] bg-white px-4 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8b6b5b]">
                        Selected stock
                      </p>
                      <p className="mt-1 text-sm font-semibold text-[#24150f]">
                        {selectedVariantStockQuantity}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-[#ead7cb] bg-white px-4 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8b6b5b]">
                        Reserved
                      </p>
                      <p className="mt-1 text-sm font-semibold text-[#24150f]">
                        {selectedVariantReservedQuantity}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-[#ead7cb] bg-white px-4 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8b6b5b]">
                        Status
                      </p>
                      <p className="mt-1 text-sm font-semibold text-[#24150f]">
                        {isReservedForCheckout
                          ? "Temporarily locked"
                          : "Unavailable"}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-[180px_minmax(0,1fr)]">
                    <button
                      type="button"
                      disabled
                      className="min-h-[56px] rounded-[18px] border border-[#ead7cb] bg-[#f7efe8] px-5 py-4 text-base font-semibold text-[#b34d39] opacity-80"
                    >
                      {isReservedForCheckout ? "Reserved" : "Out of stock"}
                    </button>
                    <StockNotificationButton
                      productId={productId}
                      productName={product?.name || product?.title || "Product"}
                      variantId={notifyVariantId}
                      variantName={notifyVariantName}
                      initialRequested={notifyRequested}
                    />
                  </div>
                </div>
              ) : (
                <div className="mt-8 grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={handleAddToCart}
                    disabled={actionLoading}
                    className="flex min-h-[58px] items-center justify-center gap-3 rounded-2xl border bg-white px-5 py-4 text-base font-semibold transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                    style={
                      currentVariantInCart
                        ? { borderColor: "#dc2626", color: "#dc2626" }
                        : {
                            borderColor: "var(--primary)",
                            color: "var(--primary)",
                          }
                    }
                  >
                    <IoMdCart className="text-xl" />
                    {currentVariantInCart ? "Remove from Cart" : "Add to Cart"}
                  </button>
                  <button
                    type="button"
                    onClick={handleBuyNow}
                    disabled={isBuyNowDisabled}
                    className="product-cta-primary min-h-[58px] rounded-2xl px-5 py-4 text-base font-semibold transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                    style={{
                      backgroundColor: "var(--primary)",
                      color: "var(--flavor-text, #ffffff)",
                    }}
                  >
                    Buy Now
                  </button>
                </div>
              )}

              {showHeroSupportCards ? (
                <div className="mt-8 grid gap-3 sm:grid-cols-2">
                  {supportCards.map((card, index) => {
                    const TrustIcon =
                      card.Icon || DEFAULT_SUPPORT_CARDS[index]?.Icon;

                    return (
                      <div
                        key={`${card.title}-${index}`}
                        className="rounded-[24px] border border-[#e7dad1] bg-[#faf6f2] p-4"
                      >
                        <div className="flex items-center gap-3">
                          <div className="product-trust-icon flex h-11 w-11 items-center justify-center rounded-2xl">
                            {TrustIcon ? <TrustIcon className="text-xl" /> : null}
                          </div>
                          <div>
                            <p className="font-semibold text-[#24150f]">
                              {card.title}
                            </p>
                            <p className="text-sm text-[#5d4b41]">
                              {card.description}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {showHeroInsightCards ? (
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <div className="rounded-[26px] border border-[#e4d5ca] bg-white/85 p-5 shadow-[0_24px_50px_-40px_rgba(42,28,20,0.45)]">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#876958]">
                {mergeTextOverride(
                  pageConfig?.hero?.priceCardEyebrow,
                  "Price Focus",
                )}
              </p>
              <p className="mt-2 text-3xl font-semibold text-[#24150f]">
                {formatPrice(toNumber(activePrice, 0))}
              </p>
              <p className="mt-2 text-sm text-[#6d584a]">
                {mergeTextOverride(
                  pageConfig?.hero?.priceCardDescription,
                  "Clean, high-contrast pricing with supporting variant context.",
                )}
              </p>
            </div>
            <div className="rounded-[26px] border border-[#e4d5ca] bg-white/85 p-5 shadow-[0_24px_50px_-40px_rgba(42,28,20,0.45)]">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#876958]">
                {mergeTextOverride(
                  pageConfig?.hero?.variantCardEyebrow,
                  "Variant View",
                )}
              </p>
              <p className="mt-2 text-xl font-semibold text-[#24150f]">
                {selectedPackLabel}
              </p>
              <p className="mt-2 text-sm text-[#6d584a]">
                {mergeTextOverride(
                  pageConfig?.hero?.variantCardDescription,
                  "Easy-to-scan options that stay near the CTA block.",
                )}
              </p>
            </div>
            <div className="rounded-[26px] border border-[#e4d5ca] bg-white/85 p-5 shadow-[0_24px_50px_-40px_rgba(42,28,20,0.45)]">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#876958]">
                {mergeTextOverride(
                  pageConfig?.hero?.socialProofEyebrow,
                  "Social Proof",
                )}
              </p>
              <p className="mt-2 text-xl font-semibold text-[#24150f]">
                {reviewSummaryLabel}
              </p>
              <p className="mt-2 text-sm text-[#6d584a]">
                {mergeTextOverride(
                  pageConfig?.hero?.socialProofDescription,
                  "Reviews move closer to the content shoppers read before buying.",
                )}
              </p>
            </div>
          </div>
        ) : null}

        {tabs.length > 0 ? (
          <div className="mt-8 rounded-[36px] border border-[#e1cdbf] bg-white/88 p-4 shadow-[0_34px_90px_-55px_rgba(44,29,20,0.38)] backdrop-blur sm:p-6">
            <div className="flex flex-wrap gap-3">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`rounded-2xl px-5 py-3 text-sm font-semibold transition ${
                    activeTab === tab.id
                      ? "product-tab-active"
                      : "border border-[#d6c5b9] bg-white text-[#38231a] hover:-translate-y-0.5"
                  }`}
                  style={
                    activeTab === tab.id
                      ? {
                          backgroundColor: "var(--primary)",
                          color: "var(--flavor-text, #ffffff)",
                        }
                      : undefined
                  }
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="mt-6">
              {activeTab === "description" && showDescriptionSection ? (
                <div className="grid items-start gap-6 xl:grid-cols-2">
                  {pageConfig?.descriptionSection?.showEditorialBanner !==
                  false ? (
                    <div className="self-start overflow-hidden rounded-[32px] bg-[linear-gradient(135deg,_#2f1b12_0%,_#6b4331_42%,_#9a6b54_100%)] p-6 text-white sm:p-8">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#f2dbc7]">
                        {mergeTextOverride(
                          pageConfig?.descriptionSection?.editorialEyebrow,
                          "Featured Overview",
                        )}
                      </p>
                      <div
                        className={`mt-5 grid items-start gap-6 ${
                          pageConfig?.descriptionSection
                            ?.showFeaturedBannerImage !== false &&
                          pageConfig?.descriptionSection?.featuredBannerImage
                            ? "lg:grid-cols-[260px_minmax(0,1fr)]"
                            : "grid-cols-1"
                        }`}
                      >
                        {pageConfig?.descriptionSection
                          ?.showFeaturedBannerImage !== false &&
                        pageConfig?.descriptionSection?.featuredBannerImage ? (
                          <ProductImage
                            src={
                              pageConfig.descriptionSection.featuredBannerImage
                            }
                            alt={
                              product?.name ||
                              product?.title ||
                              "Product showcase"
                            }
                            fit="cover"
                            aspect="aspect-[4/3]"
                            className="w-full bg-white/10"
                            imgClassName="object-cover"
                          />
                        ) : null}
                        <div>
                          <h2 className="text-3xl font-semibold leading-tight">
                            {mergeTextOverride(
                              pageConfig?.descriptionSection?.editorialTitle,
                              "A stronger product story can live right beside the product without overwhelming the transaction.",
                            )}
                          </h2>
                          <p className="mt-4 text-base leading-7 text-[#f8ebe2]">
                            {mergeTextOverride(
                              pageConfig?.descriptionSection
                                ?.editorialDescription,
                              "This section gives longer-form content a more intentional home, helping the product feel more premium while keeping the purchase path above it calm and focused.",
                            )}
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {pageConfig?.descriptionSection?.showDescriptionFlow !==
                  false ? (
                    <div className="self-start rounded-[32px] border border-[#e7dad1] bg-[#fbf7f2] p-6 sm:p-8">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#7b6355]">
                        {mergeTextOverride(
                          pageConfig?.descriptionSection?.flowEyebrow,
                          "Description Flow",
                        )}
                      </p>
                      <div className="mt-5 max-w-[68ch] space-y-5 text-base leading-8 text-[#4b392f]">
                        {product?.description &&
                        /<\/?[a-z][\s\S]*>/i.test(product.description) ? (
                          <div
                            className="max-w-none text-[#4b392f]"
                            dangerouslySetInnerHTML={{
                              __html: sanitizeHTML(product.description),
                            }}
                          />
                        ) : null}
                        {product?.description &&
                        !/<\/?[a-z][\s\S]*>/i.test(product.description)
                          ? productDescriptionParagraphs.map((paragraph) => (
                              <p key={paragraph}>{paragraph}</p>
                            ))
                          : null}
                        {descriptionParagraphs.map((paragraph) => (
                          <p key={paragraph}>{paragraph}</p>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {activeTab === "details" && showDetailsSection ? (
                <div>
                  {pageConfig?.detailsSection?.showCards !== false ? (
                    <div className="grid gap-4 sm:grid-cols-2">
                      {detailCards.map((card) => (
                        <div
                          key={card.label}
                          className="rounded-[28px] border border-[#e7dad1] bg-[#fbf7f2] p-6"
                        >
                          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#7b6355]">
                            {card.label}
                          </p>
                          <p className="mt-3 text-2xl font-semibold text-[#24150f]">
                            {card.value}
                          </p>
                          <p className="mt-2 text-sm leading-6 text-[#5d4b41]">
                            {card.helper}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {activeTab === "shipping" && showShippingSection ? (
                <div className="grid gap-6 xl:grid-cols-[minmax(0,0.88fr)_minmax(320px,0.82fr)]">
                  {pageConfig?.shippingSection?.showPoints !== false ? (
                    <div className="rounded-[32px] border border-[#e7dad1] bg-white p-6 shadow-[0_24px_50px_-42px_rgba(42,28,20,0.3)] sm:p-8">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#7b6355]">
                        {mergeTextOverride(
                          pageConfig?.shippingSection?.pointsEyebrow,
                          "Shipping & Trust",
                        )}
                      </p>
                      <div className="mt-5 space-y-4">
                        {shippingPoints.map((item) => (
                          <div
                            key={item}
                            className="rounded-2xl border border-[#efe4dc] bg-[#fbf7f2] px-4 py-4 text-sm leading-6 text-[#4b392f]"
                          >
                            {item}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {pageConfig?.shippingSection?.showReasonsPanel !== false ? (
                    <div className="rounded-[32px] bg-[linear-gradient(135deg,_#f1e5da_0%,_#fffdfb_46%,_#efe1d2_100%)] p-6 shadow-[0_24px_50px_-42px_rgba(42,28,20,0.3)] sm:p-8">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#6f5a4c]">
                        {mergeTextOverride(
                          pageConfig?.shippingSection?.reasonsEyebrow,
                          "Why This Feels Better",
                        )}
                      </p>
                      <div className="mt-5 space-y-4 text-sm leading-6 text-[#4b392f]">
                        {mergeListWithDefaults(
                          pageConfig?.shippingSection?.reasonsParagraphs || [],
                          [
                            "The refreshed structure keeps support information within reach without drowning the buyer in a wall of plain text.",
                            "Trust markers, delivery context, and review content now sit in a more natural sequence after the hero instead of feeling detached from the decision point.",
                            "The result is a calmer, more premium product page that still stays conversion-focused.",
                          ],
                        ).map((paragraph) => (
                          <p key={paragraph}>{paragraph}</p>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {showReviewsSection ? (
          <div className="product-reveal product-reveal-delay-3 mt-10 rounded-[36px] border border-[#e1cdbf] bg-white/88 p-6 shadow-[0_34px_90px_-55px_rgba(44,29,20,0.38)] backdrop-blur sm:p-8">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#7b6355]">
                  {mergeTextOverride(
                    pageConfig?.reviewsSection?.eyebrow,
                    "Review Section",
                  )}
                </p>
                <h2 className="mt-2 text-3xl font-semibold text-[#24150f]">
                  {mergeTextOverride(
                    pageConfig?.reviewsSection?.title,
                    "Ratings and reviews",
                  )}
                </h2>
              </div>
              {product?.hasVariants &&
              Array.isArray(product?.variants) &&
              product.variants.length > 1 ? (
                <label className="min-w-[190px] text-sm font-semibold text-[#4b392f]">
                  <span className="mb-2 block text-xs uppercase tracking-[0.16em] text-[#7b6355]">
                    Variant
                  </span>
                  <select
                    value={reviewVariantFilter}
                    onChange={(event) => {
                      setReviewVariantFilter(event.target.value);
                      setReviewPage(1);
                    }}
                    className="w-full rounded-2xl border border-[#d8c6bb] bg-white px-4 py-3 text-sm outline-none"
                  >
                    {product.variants.map((variant) => {
                      const variantId = variant?._id || variant?.id;
                      return (
                        <option key={variantId} value={variantId}>
                          {formatVariantLabel(variant)}
                        </option>
                      );
                    })}
                  </select>
                </label>
              ) : null}
              <label className="min-w-[180px] text-sm font-semibold text-[#4b392f]">
                <span className="mb-2 block text-xs uppercase tracking-[0.16em] text-[#7b6355]">
                  Sort
                </span>
                <select
                  value={reviewSort}
                  onChange={(event) => {
                    setReviewSort(event.target.value);
                    setReviewPage(1);
                  }}
                  className="w-full rounded-2xl border border-[#d8c6bb] bg-white px-4 py-3 text-sm outline-none"
                >
                  <option value="latest">Latest</option>
                  <option value="highest">Highest rating</option>
                  <option value="lowest">Lowest rating</option>
                </select>
              </label>
              <div className="rounded-[24px] border border-[#eaded5] bg-[#f6efe7] px-5 py-4 text-right">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#6a4b39]">
                  Average Rating
                </p>
                <div className="mt-2 flex items-center justify-end gap-3">
                  <span className="text-2xl font-semibold text-[#2f1b12]">
                    {productRating > 0 ? productRating.toFixed(1) : "0.0"}
                  </span>
                  <Rating
                    value={productRating}
                    precision={0.5}
                    readOnly
                    size="small"
                  />
                </div>
              </div>
            </div>

            <div className="mt-6">
              {reviewsLoading ? (
                <p className="text-sm text-[#6d584a]">Loading reviews...</p>
              ) : displayReviews.length > 0 ? (
                <div>
                  <div className="mb-4 flex items-center justify-end gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        reviewScrollerRef.current?.scrollBy({
                          left: -320,
                          behavior: "smooth",
                        })
                      }
                      className="slider-nav border border-[#d8c6bb] transition"
                      aria-label="Previous reviews"
                    >
                      <FiChevronLeft />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        reviewScrollerRef.current?.scrollBy({
                          left: 320,
                          behavior: "smooth",
                        })
                      }
                      className="slider-nav border border-[#d8c6bb] transition"
                      aria-label="Next reviews"
                    >
                      <FiChevronRight />
                    </button>
                  </div>
                  <div
                    ref={reviewScrollerRef}
                    className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-3 [scrollbar-width:thin]"
                  >
                    {reviewCarouselItems.map((review, index) => (
                      <article
                        key={
                          review?._id ||
                          `${review?.userName || "review"}-${index}`
                        }
                        className="product-review-card min-w-[280px] snap-start rounded-[28px] border border-[#e7dad1] bg-[#fbf7f2] p-6 sm:min-w-[320px] lg:min-w-[360px]"
                      >
                        <div className="flex items-center gap-4">
                          {review?.avatar ? (
                            <img
                              src={getImageUrl(review.avatar)}
                              alt={review?.userName || "Customer"}
                              className="h-14 w-14 rounded-2xl object-cover"
                            />
                          ) : (
                            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#2f1b12] text-base font-semibold text-white">
                              {getReviewInitials(review)}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="font-semibold text-[#24150f]">
                              {review?.userName || "Customer"}
                            </p>
                            <p className="text-sm text-[#6d584a]">
                              {[
                                review?.city,
                                formatReviewDate(review?.createdAt),
                              ]
                                .filter(Boolean)
                                .join("  •  ")}
                            </p>
                          </div>
                        </div>
                        <div className="mt-4">
                          <Rating
                            value={Math.max(Number(review?.rating || 0), 0)}
                            readOnly
                            size="small"
                          />
                        </div>
                        <p className="mt-4 text-sm leading-7 text-[#4b392f]">
                          {review?.comment || "No written comment available."}
                        </p>
                      </article>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAllReviewsModal(true)}
                    className="mt-5 w-full rounded-2xl border border-[#d8c6bb] bg-white px-5 py-3 text-sm font-semibold text-[#2f1b12] transition hover:bg-[#fbf7f2]"
                  >
                    View All Reviews
                  </button>
                </div>
              ) : (
                <p className="text-sm font-semibold text-[#6d584a]">
                  No reviews yet
                </p>
              )}
            </div>

            {showPublicReviewForm ? (
              <div className="mt-8 rounded-[28px] border border-[#eaded5] bg-[#f8f2eb] p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#7b6355]">
                      Share Feedback
                    </p>
                    <h3 className="mt-2 text-2xl font-semibold text-[#24150f]">
                      Help Others by Sharing Your Review and experience
                    </h3>
                  </div>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <label className="text-sm text-[#4b392f]">
                    <span className="mb-2 block font-semibold">Your Name</span>
                    <input
                      type="text"
                      value={publicReviewForm.userName}
                      onChange={(event) =>
                        setPublicReviewForm((current) => ({
                          ...current,
                          userName: event.target.value,
                        }))
                      }
                      placeholder="Enter your name"
                      className="w-full rounded-2xl border border-[#d8c6bb] bg-white px-4 py-3 outline-none transition focus:border-[#b18062]"
                    />
                  </label>

                  <label className="text-sm text-[#4b392f]">
                    <span className="mb-2 block font-semibold">City</span>
                    <input
                      type="text"
                      value={publicReviewForm.city}
                      onChange={(event) =>
                        setPublicReviewForm((current) => ({
                          ...current,
                          city: event.target.value,
                        }))
                      }
                      placeholder="Jaipur, Delhi, Mumbai"
                      className="w-full rounded-2xl border border-[#d8c6bb] bg-white px-4 py-3 outline-none transition focus:border-[#b18062]"
                    />
                  </label>

                  <div className="md:col-span-2">
                    <p className="text-sm font-semibold text-[#4b392f]">
                      Your Rating
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <Rating
                        value={publicReviewForm.rating}
                        onChange={(_event, value) =>
                          setPublicReviewForm((current) => ({
                            ...current,
                            rating: value || 1,
                          }))
                        }
                      />
                      <span className="text-sm text-[#6d584a]">
                        {Number(publicReviewForm.rating || 0).toFixed(1)} / 5
                      </span>
                    </div>
                  </div>

                  <label className="text-sm text-[#4b392f] md:col-span-2">
                    <span className="mb-2 block font-semibold">
                      Review Comment
                    </span>
                    <textarea
                      value={publicReviewForm.comment}
                      onChange={(event) =>
                        setPublicReviewForm((current) => ({
                          ...current,
                          comment: event.target.value,
                        }))
                      }
                      placeholder="Tell other customers what stood out for you"
                      rows={5}
                      className="w-full rounded-[24px] border border-[#d8c6bb] bg-white px-4 py-3 outline-none transition focus:border-[#b18062]"
                    />
                  </label>
                </div>

                <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={handleSubmitPublicReview}
                    disabled={submittingPublicReview}
                    className="rounded-full bg-[#2f1b12] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#1f120d] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {submittingPublicReview ? "Submitting..." : "Submit Review"}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {!isDemoPreview ? (
          <>
            {showFrequentlyBoughtSection ? (
              <div className="product-reveal product-reveal-delay-3 mt-12 rounded-[36px] border border-[#e1cdbf] bg-white/88 p-6 shadow-[0_34px_90px_-55px_rgba(44,29,20,0.38)] backdrop-blur sm:p-8">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#7b6355]">
                      {mergeTextOverride(
                        pageConfig?.frequentlyBoughtSection?.eyebrow,
                        "Frequently Bought Together",
                      )}
                    </p>
                    <h2 className="mt-2 text-3xl font-semibold text-[#24150f]">
                      {mergeTextOverride(
                        pageConfig?.frequentlyBoughtSection?.title,
                        "Helpful add-ons close to the primary product",
                      )}
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddAllToCart}
                    disabled={frequentlyBought.length === 0}
                    className="rounded-2xl px-5 py-3 text-sm font-semibold transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
                    style={{
                      backgroundColor: "var(--primary)",
                      color: "var(--flavor-text, #ffffff)",
                    }}
                  >
                    {mergeTextOverride(
                      pageConfig?.frequentlyBoughtSection?.buttonText,
                      "Add All To Cart",
                    )}
                  </button>
                </div>

                <div className="mt-6">
                  {fbtLoading ? (
                    <p className="text-sm text-[#6d584a]">
                      Loading suggestions...
                    </p>
                  ) : frequentlyBought.length > 0 ? (
                    <div className="grid gap-4 lg:grid-cols-4">
                      <div className="rounded-[28px] border border-[#e7dad1] bg-[#fbf7f2] p-5">
                        <div className="flex items-center gap-4">
                          <ProductImage
                            src={activeImage}
                            alt={product?.name || product?.title}
                            aspect="aspect-square"
                            fit="cover"
                            className="h-[72px] w-[72px] flex-shrink-0 border border-[#efe4dc]"
                          />
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#7b6355]">
                              Main Product
                            </p>
                            <h3 className="mt-1 text-sm font-semibold text-[#24150f]">
                              {product?.name || product?.title}
                            </h3>
                            <p
                              className="mt-2 text-sm font-semibold"
                              style={{ color: "var(--primary)" }}
                            >
                              {formatPrice(toNumber(activePrice, 0))}
                            </p>
                          </div>
                        </div>
                      </div>

                      {frequentlyBought.map((item, index) => {
                        const recommendation = getRecommendationPayload(item);
                        if (!recommendation?.product) return null;

                        const recProduct = recommendation.product;
                        const recProductId = getResolvedProductId(recProduct);
                        const isAdded = hasSelectedVariantInCart(
                          recProductId,
                          recommendation.variantId,
                        );

                        return (
                          <div
                            key={`${String(recProductId)}:${String(recommendation.variantId || "base")}:${index}`}
                            className="rounded-[28px] border border-[#e7dad1] bg-[#fbf7f2] p-5"
                          >
                            <div className="flex items-center gap-4">
                              <ProductImage
                                src={getImageUrl(recommendation.image)}
                                alt={recProduct?.name || "Suggested product"}
                                aspect="aspect-square"
                                fit="cover"
                                className="h-[72px] w-[72px] flex-shrink-0 border border-[#efe4dc]"
                              />
                              <div className="min-w-0">
                                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#7b6355]">
                                  Add-on
                                </p>
                                <h3 className="line-clamp-2 text-sm font-semibold text-[#24150f]">
                                  {recProduct?.name || recProduct?.title}
                                </h3>
                                {recommendation.label ? (
                                  <p className="mt-1 text-xs text-[#6d584a]">
                                    {recommendation.label}
                                  </p>
                                ) : null}
                                <p
                                  className="mt-2 text-sm font-semibold"
                                  style={{ color: "var(--primary)" }}
                                >
                                  {formatPrice(
                                    toNumber(recommendation.price, 0),
                                  )}
                                </p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                handleAddSingleRecommendation(item)
                              }
                              disabled={isAdded}
                              className={`mt-4 w-full rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                                isAdded ? "bg-white" : "hover:-translate-y-0.5"
                              }`}
                              style={
                                isAdded
                                  ? {
                                      borderColor: "var(--primary)",
                                      color: "var(--primary)",
                                    }
                                  : {
                                      borderColor: "var(--primary)",
                                      backgroundColor: "var(--primary)",
                                      color: "var(--flavor-text, #ffffff)",
                                    }
                              }
                            >
                              {isAdded ? "Added" : "Add to Cart"}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-[#6d584a]">
                      Loading products...
                    </p>
                  )}
                </div>
              </div>
            ) : null}

            {showRecommendedCombosSection &&
            (recommendedLoading || recommendedCombos.length > 0) ? (
              <div className="product-reveal product-reveal-delay-3 mt-12 rounded-[36px] border border-[#e1cdbf] bg-white/88 p-6 shadow-[0_34px_90px_-55px_rgba(44,29,20,0.38)] backdrop-blur sm:p-8">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#7b6355]">
                      {mergeTextOverride(
                        pageConfig?.recommendedCombosSection?.eyebrow,
                        "Recommended Combos",
                      )}
                    </p>
                    <h2 className="mt-2 text-3xl font-semibold text-[#24150f]">
                      {mergeTextOverride(
                        pageConfig?.recommendedCombosSection?.title,
                        "Bundle options that support the same buying flow",
                      )}
                    </h2>
                  </div>
                  <Link
                    href="/combo-deals"
                    className="text-sm font-semibold"
                    style={{ color: "var(--primary)" }}
                  >
                    {mergeTextOverride(
                      pageConfig?.recommendedCombosSection?.linkText,
                      "View all combos",
                    )}
                  </Link>
                </div>

                <div className="mt-6">
                  {recommendedLoading ? (
                    <p className="text-sm text-[#6d584a]">Loading combos...</p>
                  ) : recommendedCombos.length > 0 ? (
                    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
                      {recommendedCombos.map((combo) => (
                        <ComboCard
                          key={combo._id || combo.slug}
                          combo={combo}
                          context="product_recommended_combos"
                        />
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}
          </>
        ) : null}
      </div>

      {showAllReviewsModal ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="All product reviews"
          className="fixed inset-0 z-[1390] overflow-y-auto bg-black/70 p-4 sm:p-8"
          onClick={() => setShowAllReviewsModal(false)}
        >
          <div
            className="mx-auto max-w-5xl rounded-[32px] bg-white p-5 shadow-2xl sm:p-8"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#7b6355]">
                  All Reviews
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-[#24150f]">
                  {reviewSummaryLabel}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowAllReviewsModal(false)}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-[#f6efe7] text-[#2f1b12]"
                aria-label="Close all reviews"
              >
                <FiX />
              </button>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {paginatedReviews.map((review, index) => (
                <ReviewCard
                  key={
                    review?._id || `${review?.userName || "review"}-${index}`
                  }
                  review={review}
                />
              ))}
            </div>

            <div className="mt-6 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() =>
                  setReviewPage((current) => Math.max(1, current - 1))
                }
                disabled={reviewPage <= 1}
                className="rounded-2xl border border-[#d8c6bb] px-5 py-3 text-sm font-semibold text-[#2f1b12] disabled:opacity-40"
              >
                Previous
              </button>
              <span className="text-sm font-semibold text-[#6d584a]">
                Page {reviewPage} of {allReviewsTotalPages}
              </span>
              <button
                type="button"
                onClick={() =>
                  setReviewPage((current) =>
                    Math.min(allReviewsTotalPages, current + 1),
                  )
                }
                disabled={reviewPage >= allReviewsTotalPages}
                className="rounded-2xl border border-[#d8c6bb] px-5 py-3 text-sm font-semibold text-[#2f1b12] disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isImageZoomOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Zoomed product image"
          className="fixed inset-0 z-[1400] bg-black/95 p-4 sm:p-8"
          onClick={() => setIsImageZoomOpen(false)}
        >
          <div className="relative mx-auto flex h-full w-full max-w-[1280px] items-center justify-center">
            <button
              type="button"
              onClick={() => setIsImageZoomOpen(false)}
              className="slider-nav absolute right-0 top-0 transition hover:bg-white"
              aria-label="Close image zoom"
            >
              <FiX className="text-xl" />
            </button>

            {images.length > 1 ? (
              <>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    setActiveImageIndex((previous) =>
                      previous === 0 ? images.length - 1 : previous - 1,
                    );
                  }}
                  className="slider-nav absolute left-0 transition hover:bg-white"
                  aria-label="Previous zoomed image"
                >
                  <FiChevronLeft className="text-xl" />
                </button>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    setActiveImageIndex((previous) =>
                      previous === images.length - 1 ? 0 : previous + 1,
                    );
                  }}
                  className="slider-nav absolute right-0 transition hover:bg-white"
                  aria-label="Next zoomed image"
                >
                  <FiChevronRight className="text-xl" />
                </button>
              </>
            ) : null}

            <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 rounded-full bg-white/15 px-4 py-1.5 text-sm font-semibold text-white">
              100%
            </div>

            <ProductImage
              src={activeImage}
              alt={product?.name || product?.title || "Zoomed product image"}
              onClick={(event) => event.stopPropagation()}
              aspect=""
              padding="p-0"
              fit="cover"
              rounded="rounded-2xl"
              natural
              className="flex max-h-[88vh] max-w-[92vw] items-center justify-center bg-transparent"
              imgClassName="max-h-[88vh] max-w-[92vw] object-contain"
            />
          </div>
        </div>
      ) : null}

      <style jsx global>{`
        @keyframes productFadeUp {
          from {
            opacity: 0;
            transform: translate3d(0, 26px, 0) scale(0.985);
          }
          to {
            opacity: 1;
            transform: translate3d(0, 0, 0) scale(1);
          }
        }

        .product-page-shell {
          --pd-accent: var(--primary, #6a4331);
          --pd-accent-hover: var(--flavor-hover, #52382a);
          --pd-accent-text: var(--flavor-text, #ffffff);
          position: relative;
          overflow: clip;
        }

        .product-page-shell::before {
          content: "";
          position: absolute;
          top: 0;
          left: 50%;
          width: min(720px, 72vw);
          height: 420px;
          transform: translateX(-50%);
          background: radial-gradient(
            circle,
            rgba(106, 67, 49, 0.12) 0%,
            rgba(106, 67, 49, 0) 68%
          );
          filter: blur(10px);
          pointer-events: none;
        }

        .product-reveal {
          opacity: 0;
          animation: productFadeUp 0.72s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }

        .product-reveal-delay-1 {
          animation-delay: 0.06s;
        }

        .product-reveal-delay-2 {
          animation-delay: 0.14s;
        }

        .product-reveal-delay-3 {
          animation-delay: 0.22s;
        }

        .product-image-stage {
          isolation: isolate;
        }

        .product-story-card {
          position: relative;
          overflow: hidden;
        }

        .product-delivery-input:focus {
          border-color: var(--pd-accent);
          box-shadow: 0 0 0 2px var(--flavor-glass, rgba(106, 67, 49, 0.12));
        }

        .product-qty-action {
          background: var(--flavor-glass, #f5ece5);
          color: var(--pd-accent-text);
        }

        .product-qty-action:hover {
          filter: brightness(0.96);
        }

        .product-tab-active {
          background: var(--pd-accent);
          color: var(--pd-accent-text);
        }

        .product-cta-primary {
          position: relative;
        }

        .product-cta-primary:hover {
          background-color: var(--pd-accent-hover) !important;
        }

        .product-trust-icon {
          background: var(--pd-accent);
          color: var(--pd-accent-text);
        }

        .product-review-card {
          transition:
            transform 0.3s ease,
            box-shadow 0.3s ease;
        }

        .product-review-card:hover {
          transform: translateY(-4px);
        }

        @media (prefers-reduced-motion: reduce) {
          .product-reveal,
          .product-review-card {
            animation: none !important;
            opacity: 1 !important;
            transform: none !important;
          }
        }
      `}</style>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3200}
        onClose={() => setSnackbar((current) => ({ ...current, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          severity={snackbar.severity}
          onClose={() =>
            setSnackbar((current) => ({ ...current, open: false }))
          }
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </section>
  );
};

export default ProductDetailPage;
