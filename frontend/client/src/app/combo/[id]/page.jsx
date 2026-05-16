"use client";

/* eslint-disable @next/next/no-img-element */

import ComboCard from "@/components/ComboCard";
import {
  mergeCardsWithDefaults,
  mergeListWithDefaults,
  mergeTextOverride,
  normalizeProductPageConfig,
} from "@/components/productDetail/pageConfig";
import ProductImage from "@/components/ProductImage";
import ShareButton from "@/components/ShareButton";
import { formatPrice } from "@/config/siteConfig";
import { useCart } from "@/context/CartContext";
import { trackEvent } from "@/utils/analyticsTracker";
import { fetchDataFromApi, postData } from "@/utils/api";
import { getImageUrl } from "@/utils/imageUtils";
import { sanitizeHTML } from "@/utils/sanitize";
import { Rating } from "@mui/material";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import { FiChevronLeft, FiChevronRight } from "react-icons/fi";
import { IoMdCart } from "react-icons/io";
import {
  MdLocalShipping,
  MdOutlineInventory2,
  MdOutlineSecurity,
  MdVerified,
} from "react-icons/md";

const isObjectId = (value) => /^[0-9a-f]{24}$/i.test(String(value || ""));

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

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

const stripHtml = (value) =>
  String(value || "")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

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

  return [...new Set(candidates)]
    .slice(0, 10)
    .map((entry) => getImageUrl(entry));
};

const formatComboVariantLabel = (item = {}) => {
  const variantName = String(item?.variantName || "").trim();
  const variantSku = String(item?.variantSku || "").trim();
  const variantWeight = Number(item?.variantWeight || item?.weight || 0);
  const variantUnit = String(item?.variantUnit || item?.unit || "").trim();

  const weightLabel =
    variantWeight > 0 && variantUnit
      ? variantUnit.toLowerCase() === "g" && variantWeight >= 1000
        ? `${Number((variantWeight / 1000).toFixed(2))} kg`
        : `${variantWeight} ${variantUnit}`
      : "";

  const label = [variantName, weightLabel].filter(Boolean).join(" - ");
  if (label) return label;
  if (variantName) return variantName;
  if (weightLabel) return weightLabel;
  return variantSku;
};

const FALLBACK_COMBO_IMAGE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='700' height='700' viewBox='0 0 700 700'%3E%3Crect width='700' height='700' fill='%23f3f4f6'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%239ca3af' font-family='Arial,sans-serif' font-size='36'%3ECombo%20Image%3C/text%3E%3C/svg%3E";

const buildDescriptionParagraphs = (combo) => {
  const descriptionText = stripHtml(
    combo?.description || combo?.shortDescription || "",
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

  const name = String(combo?.name || "This combo").trim();
  return [
    `${name} is arranged to keep the key bundle value, included products, and delivery context close to the purchase decision.`,
    "The refreshed layout gives combo bundles the same calmer editorial structure used on product pages while still keeping the buying path direct.",
  ];
};

const getHeroStatusLabel = (combo, reviewCount) => {
  if (combo?.isBestSeller) return "Best seller";
  if (
    String(combo?.demandStatus || "")
      .trim()
      .toUpperCase() === "HIGH"
  ) {
    return "High demand";
  }
  if (reviewCount > 0) return "Top rated";
  return "Combo deal";
};

const buildDetailCards = ({
  combo,
  includedCount,
  reviewCount,
  availableStock,
}) => [
  {
    label: "Category",
    value: combo?.category || combo?.categoryName || "Combo Deals",
    helper: "Live combo taxonomy",
  },
  {
    label: "Items Included",
    value: `${includedCount}`,
    helper: "Products bundled in this deal",
  },
  {
    label: "Customer Reviews",
    value: `${reviewCount}`,
    helper: "Visible social proof",
  },
  {
    label: "Availability",
    value: availableStock > 0 ? "Bundle available" : "Currently unavailable",
    helper: "Bundle stock signal",
  },
];

const buildShippingPoints = () => [
  "Standard delivery typically lands within 3-5 business days after dispatch.",
  "Bundle packaging is prepared to keep every included product protected in transit.",
  "Checkout runs through secure payment handling with verified order tracking.",
];

const buildStaticDeliveryMessage = (pincode) => {
  const normalized = String(pincode || "")
    .replace(/\D/g, "")
    .slice(0, 6);

  if (!normalized) return "Enter a 6-digit pincode to preview delivery timing.";
  if (!/^[1-9][0-9]{5}$/.test(normalized)) return "Enter Right Pincode";
  return `Estimated delivery to ${normalized}: 2-4 business days.`;
};

const DEFAULT_REVIEW_SETTINGS = {
  allowPublicSubmissions: true,
  autoPublishPublicReviews: true,
  showPublicReviewForm: true,
};

const normalizePublicReviewSettings = (value = {}) => ({
  allowPublicSubmissions: value?.allowPublicSubmissions !== false,
  autoPublishPublicReviews: value?.autoPublishPublicReviews !== false,
  showPublicReviewForm: value?.showPublicReviewForm !== false,
});

const averageReviewRating = (reviews = []) => {
  if (!Array.isArray(reviews) || reviews.length === 0) return 0;
  const total = reviews.reduce(
    (sum, review) => sum + Math.max(Number(review?.rating || 0), 0),
    0,
  );
  return total > 0 ? total / reviews.length : 0;
};

const getReviewInitials = (review) =>
  String(review?.userName || "Customer")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

const formatReviewDate = (value) => {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(parsed);
};

export default function ComboDetailPage() {
  const { id } = useParams();
  const routeId = String(id || "").trim();
  const decodedRouteId = routeId ? decodeURIComponent(routeId) : "";
  const router = useRouter();
  const { addComboToCart, addToCart, cartItems, isComboCartItem } = useCart();

  const [combo, setCombo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [isAdding, setIsAdding] = useState(false);
  const [activeTab, setActiveTab] = useState("description");
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [deliveryPincode, setDeliveryPincode] = useState("");
  const [customerReviews, setCustomerReviews] = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewSort, setReviewSort] = useState("highest");
  const [reviewSettings, setReviewSettings] = useState(DEFAULT_REVIEW_SETTINGS);
  const [frequentlyBought, setFrequentlyBought] = useState([]);
  const [fbtLoading, setFbtLoading] = useState(false);
  const [recommendedCombos, setRecommendedCombos] = useState([]);
  const [recommendedLoading, setRecommendedLoading] = useState(false);
  const [publicReviewForm, setPublicReviewForm] = useState({
    userName: "",
    city: "",
    rating: 5,
    comment: "",
  });
  const [submittingPublicReview, setSubmittingPublicReview] = useState(false);
  const reviewSectionRef = useRef(null);
  const publicReviewFormRef = useRef(null);

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
        trackEvent("combo_view", {
          comboId: String(payload?._id || payload?.id || ""),
          comboName: payload?.name || "",
          comboSlug: payload?.slug || "",
          comboType: payload?.comboType || "",
          sectionName: "combo_detail",
        });
      } catch {
        setError("Unable to load combo details.");
      } finally {
        setLoading(false);
      }
    };

    loadCombo();
  }, [decodedRouteId, routeId]);

  const galleryImages = useMemo(() => resolveComboGallery(combo), [combo]);
  const images =
    galleryImages.length > 0 ? galleryImages : [FALLBACK_COMBO_IMAGE];
  const activeImage =
    images[activeImageIndex] || images[0] || FALLBACK_COMBO_IMAGE;
  const maxVisibleThumbnails = 3;
  const visibleGalleryImages = images.slice(0, maxVisibleThumbnails);
  const remainingGalleryCount = Math.max(
    images.length - maxVisibleThumbnails,
    0,
  );

  const originalTotal = toNumber(
    combo?.originalPrice ?? combo?.originalTotal,
    0,
  );
  const comboPrice = toNumber(
    combo?.price ?? combo?.comboPrice ?? combo?.suggestedPrice,
    0,
  );
  const savings = Math.max(originalTotal - comboPrice, 0);
  const discountPercent =
    originalTotal > 0
      ? Math.round(((originalTotal - comboPrice) / originalTotal) * 100)
      : Math.round(toNumber(combo?.discountPercentage, 0));
  const comboDiscountPercent = Math.max(discountPercent, 0);
  const comboId = combo?._id || combo?.id || "";
  const availableStock = toNumber(
    combo?.availableStock ?? combo?.stockQuantity,
    0,
  );
  const isOutOfStock = availableStock <= 0;
  const maxPerOrder = toNumber(combo?.maxPerOrder, 0);
  const maxQty =
    maxPerOrder > 0
      ? Math.min(maxPerOrder, Math.max(availableStock, 1))
      : Math.max(availableStock, 1);
  const starRating = toNumber(combo?.adminStarRating ?? combo?.rating, 0);
  const sortedReviews = customerReviews.slice().sort((a, b) => {
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
  const reviewCount = sortedReviews.length || toNumber(combo?.reviewCount, 0);
  const reviewRating = sortedReviews.length
    ? averageReviewRating(sortedReviews)
    : starRating;
  const outOfStockItems = useMemo(() => {
    if (Array.isArray(combo?.outOfStockItems)) return combo.outOfStockItems;
    if (Array.isArray(combo?.availability?.outOfStockItems)) {
      return combo.availability.outOfStockItems;
    }
    return [];
  }, [combo]);
  const includedItems = Array.isArray(combo?.items) ? combo.items : [];
  const primaryProductId =
    includedItems.find((item) => item?.productId)?.productId || "";

  const pageConfig = normalizeProductPageConfig(combo?.productPage);
  const defaultDescriptionParagraphs = buildDescriptionParagraphs(combo);
  const descriptionParagraphs = mergeListWithDefaults(
    pageConfig?.descriptionSection?.extraParagraphs || [],
    defaultDescriptionParagraphs,
  );
  const detailCards = mergeCardsWithDefaults(
    buildDetailCards({
      combo,
      includedCount: includedItems.length,
      reviewCount,
      availableStock,
    }),
    pageConfig?.detailsSection?.cards || [],
  );
  const shippingPoints = mergeListWithDefaults(
    pageConfig?.shippingSection?.points || [],
    buildShippingPoints(),
  );
  const heroStatusLabel = getHeroStatusLabel(combo, reviewCount);
  const showReviewsSection = pageConfig?.reviewsSection?.show !== false;
  const showHeroStoryCard = pageConfig?.hero?.showStoryCard !== false;
  const showPublicReviewForm =
    showReviewsSection &&
    reviewSettings.allowPublicSubmissions !== false &&
    reviewSettings.showPublicReviewForm !== false;
  const showFrequentlyBoughtSection =
    pageConfig?.frequentlyBoughtSection?.show !== false;
  const showRecommendedCombosSection =
    pageConfig?.recommendedCombosSection?.show !== false;
  const galleryGridClassName = showHeroStoryCard
    ? "relative mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-stretch"
    : "relative mt-6";
  const imageStageClassName = showHeroStoryCard
    ? "product-image-stage relative flex min-h-[480px] overflow-hidden rounded-[30px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.92)_0%,rgba(244,236,229,0.88)_100%)] p-0 lg:h-full lg:min-h-[540px]"
    : "product-image-stage relative mx-auto flex min-h-[420px] max-w-[840px] overflow-hidden rounded-[30px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.92)_0%,rgba(244,236,229,0.88)_100%)] p-0";
  const scrollToReviews = useCallback(() => {
    if (!showReviewsSection) return;

    const targetElement =
      publicReviewFormRef.current || reviewSectionRef.current;
    if (!targetElement) return;

    targetElement.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });

    if (typeof window !== "undefined") {
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${window.location.search}#reviews`,
      );
    }

    const focusTarget = publicReviewFormRef.current?.querySelector(
      "input:not([type='hidden']), textarea",
    );

    if (focusTarget && typeof window !== "undefined") {
      window.setTimeout(() => {
        try {
          focusTarget.focus({ preventScroll: true });
        } catch {
          focusTarget.focus();
        }
      }, 420);
    }
  }, [showReviewsSection]);

  const openGalleryAtIndex = (index) => {
    setActiveImageIndex(index);
    if (!comboId) return;
    router.push(
      `/product-image-zoom?comboId=${encodeURIComponent(comboId)}&type=combo&index=${Math.max(Number(index || 0), 0)}`,
    );
  };

  const fetchComboSections = useCallback(async (productId) => {
    if (!productId) {
      setFrequentlyBought([]);
      setRecommendedCombos([]);
      return;
    }

    try {
      setFbtLoading(true);
      setRecommendedLoading(true);
      const response = await fetchDataFromApi(
        `/api/combos/sections?productId=${encodeURIComponent(productId)}`,
      );
      if (response?.success) {
        const fbt = Array.isArray(response?.data?.frequentlyBoughtTogether)
          ? response.data.frequentlyBoughtTogether.filter(
              (item) => !isExclusiveProduct(item),
            )
          : [];
        const combos = Array.isArray(response?.data?.recommendedCombos)
          ? response.data.recommendedCombos.filter(
              (comboItem) => !isExclusiveCombo(comboItem),
            )
          : [];
        setFrequentlyBought(fbt);
        setRecommendedCombos(combos);
        return;
      }
      setFrequentlyBought([]);
      setRecommendedCombos([]);
    } catch (error) {
      console.error("Error fetching combo sections:", error);
      setFrequentlyBought([]);
      setRecommendedCombos([]);
    } finally {
      setFbtLoading(false);
      setRecommendedLoading(false);
    }
  }, []);

  useEffect(() => {
    const loadReviewSettings = async () => {
      try {
        const response = await fetchDataFromApi(
          "/api/settings/public/reviewSettings",
        );
        if (response?.success) {
          setReviewSettings(
            normalizePublicReviewSettings(
              response?.data?.value || response?.data || {},
            ),
          );
          return;
        }
      } catch {
        // Ignore and fall back to defaults.
      }

      setReviewSettings(DEFAULT_REVIEW_SETTINGS);
    };

    loadReviewSettings();
  }, []);

  useEffect(() => {
    const loadComboReviews = async () => {
      if (!comboId) {
        setCustomerReviews([]);
        return;
      }

      try {
        setReviewsLoading(true);
        const response = await fetchDataFromApi(
          `/api/reviews/combo/${comboId}`,
        );
        if (response?.success && Array.isArray(response?.data)) {
          setCustomerReviews(response.data);
        } else {
          setCustomerReviews([]);
        }
      } catch {
        setCustomerReviews([]);
      } finally {
        setReviewsLoading(false);
      }
    };

    loadComboReviews();
  }, [comboId]);

  useEffect(() => {
    if (!primaryProductId) {
      setFrequentlyBought([]);
      setRecommendedCombos([]);
      return;
    }

    if (showFrequentlyBoughtSection || showRecommendedCombosSection) {
      fetchComboSections(primaryProductId);
      return;
    }

    setFrequentlyBought([]);
    setRecommendedCombos([]);
  }, [
    fetchComboSections,
    primaryProductId,
    showFrequentlyBoughtSection,
    showRecommendedCombosSection,
  ]);

  const tabs = [
    pageConfig?.tabs?.showDescription !== false
      ? {
          id: "description",
          label: mergeTextOverride(
            pageConfig?.tabs?.descriptionLabel,
            "Description",
          ),
        }
      : null,
    pageConfig?.tabs?.showDetails !== false
      ? {
          id: "details",
          label: mergeTextOverride(
            pageConfig?.tabs?.detailsLabel,
            "Product Details",
          ),
        }
      : null,
    pageConfig?.tabs?.showShipping !== false
      ? {
          id: "shipping",
          label: mergeTextOverride(
            pageConfig?.tabs?.shippingLabel,
            "Shipping & Trust",
          ),
        }
      : null,
  ].filter(Boolean);

  useEffect(() => {
    if (activeImageIndex >= images.length) {
      setActiveImageIndex(0);
    }
  }, [activeImageIndex, images.length]);

  useEffect(() => {
    setQuantity(1);
    setActiveImageIndex(0);
    setActiveTab("description");
    setDeliveryPincode("");
  }, [comboId]);

  useEffect(() => {
    if (quantity > maxQty) {
      setQuantity(maxQty);
    }
  }, [maxQty, quantity]);

  useEffect(() => {
    if (tabs.length === 0) return;
    if (!tabs.some((tab) => tab.id === activeTab)) {
      setActiveTab(tabs[0].id);
    }
  }, [activeTab, tabs]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    if (window.location.hash !== "#reviews") return undefined;

    const timer = window.setTimeout(() => {
      scrollToReviews();
    }, 140);

    return () => window.clearTimeout(timer);
  }, [comboId, scrollToReviews, showReviewsSection]);

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
      label: variant?.label || variant?.name || "",
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

  const handleAddAllToCart = async () => {
    if (frequentlyBought.length === 0) return;

    for (const item of frequentlyBought) {
      const payload = buildCartProductFromRecommendation(item);
      if (!payload) continue;

      const targetProductId = payload?._id || payload?.id || "";
      if (!targetProductId) continue;
      if (hasSelectedVariantInCart(targetProductId, payload?.variantId)) {
        continue;
      }

      await addToCart(payload, 1);
    }
  };

  const handleAddCombo = async () => {
    if (!combo || isAdding) return;
    if (includedItems.length === 0) {
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

  const handleSubmitPublicReview = async () => {
    const userName = String(publicReviewForm.userName || "").trim();
    const comment = String(publicReviewForm.comment || "").trim();
    const city = String(publicReviewForm.city || "").trim();
    const rating = Number(publicReviewForm.rating || 0);

    if (!comboId) {
      toast.error("Combo context missing. Please refresh and try again.");
      return;
    }

    if (!userName) {
      toast.error("Please enter your name before submitting a review.");
      return;
    }

    if (!comment) {
      toast.error("Please write a short review comment.");
      return;
    }

    if (!rating || rating < 1 || rating > 5) {
      toast.error("Please select a rating between 1 and 5.");
      return;
    }

    setSubmittingPublicReview(true);
    try {
      const response = await postData("/api/reviews", {
        comboId,
        userName,
        city,
        rating,
        comment,
      });

      if (!response?.success) {
        throw new Error(response?.message || "Failed to submit review.");
      }

      if (response?.data) {
        setCustomerReviews((current) => [response.data, ...current]);
      }
      setPublicReviewForm({
        userName: "",
        city: "",
        rating: 5,
        comment: "",
      });
      toast.success("Review submitted successfully.");
    } catch (error) {
      toast.error(error?.message || "Failed to submit review.");
    } finally {
      setSubmittingPublicReview(false);
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
      router.push("/checkout");
    } catch {
      toast.error("Unable to proceed to checkout");
    } finally {
      setIsAdding(false);
    }
  };

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

  return (
    <section
      className="product-page-shell min-h-screen bg-[linear-gradient(180deg,#fff8f2_0%,#f7efe8_100%)] py-6 sm:py-8"
      style={{ fontFamily: "'Sora', 'Segoe UI', sans-serif" }}
    >
      <div className="mx-auto w-full max-w-[1200px] px-3 sm:px-4">
        <nav className="mb-5 flex items-center gap-2 overflow-x-auto whitespace-nowrap text-xs text-[#7b6355] sm:text-sm">
          <Link href="/" className="hover:text-[var(--primary)]">
            Home
          </Link>
          <span>/</span>
          <Link href="/combo-deals" className="hover:text-[var(--primary)]">
            Combo Deals
          </Link>
          <span>/</span>
          <span className="font-medium text-[#3a261c]">
            {combo?.name || "Combo"}
          </span>
        </nav>

        <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_500px] xl:items-start">
          <div className="product-reveal rounded-[36px] border border-[#ecd8c9] bg-[linear-gradient(180deg,rgba(255,255,255,0.9)_0%,rgba(249,239,229,0.92)_100%)] p-4 shadow-[0_34px_90px_-55px_rgba(44,29,20,0.35)] sm:p-6">
            <div className="flex items-center justify-between gap-4">
              <span className="rounded-full border border-[#ead7ca] bg-white/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-[#7b6355]">
                Product Gallery
              </span>
              <div className="flex items-center gap-2">
                {images.length > 1 ? (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        setActiveImageIndex((previous) =>
                          previous === 0 ? images.length - 1 : previous - 1,
                        )
                      }
                      className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#6c4a3a] shadow-sm"
                      aria-label="Previous combo image"
                    >
                      <FiChevronLeft />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setActiveImageIndex((previous) =>
                          previous === images.length - 1 ? 0 : previous + 1,
                        )
                      }
                      className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#6c4a3a] shadow-sm"
                      aria-label="Next combo image"
                    >
                      <FiChevronRight />
                    </button>
                  </>
                ) : null}
              </div>
            </div>

            <div className={galleryGridClassName}>
              <div className={imageStageClassName}>
                {discountPercent > 0 ? (
                  <span className="absolute left-5 top-5 z-10 rounded-full bg-[#ef4444] px-3 py-1 text-xs font-bold text-white">
                    {discountPercent}% OFF
                  </span>
                ) : null}
                <button
                  type="button"
                  className="group relative z-10 flex h-full w-full overflow-hidden rounded-[28px]"
                  aria-label="Combo image"
                >
                  <ProductImage
                    src={activeImage}
                    alt={combo?.name || "Combo image"}
                    responsiveProfile="gallery"
                    sizes="(max-width: 768px) 92vw, (max-width: 1280px) 54vw, 720px"
                    eager
                    fit="cover"
                    aspect=""
                    rounded="rounded-[28px]"
                    className="h-full w-full bg-transparent"
                  />
                </button>
              </div>

              {pageConfig?.hero?.showStoryCard !== false ? (
                <div className="product-story-card rounded-[30px] bg-[linear-gradient(180deg,#6a4331_0%,#8c624d_100%)] p-6 text-white shadow-[0_28px_60px_-40px_rgba(44,29,20,0.8)]">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#f6dfcf]">
                    {mergeTextOverride(
                      pageConfig?.hero?.storyEyebrow,
                      "Product Story",
                    )}
                  </p>
                  <h2 className="mt-4 text-[32px] font-semibold leading-[1.12]">
                    {mergeTextOverride(
                      pageConfig?.hero?.storyTitle,
                      "A stronger bundle story with the key actions close to the decision point.",
                    )}
                  </h2>
                  <p className="mt-5 text-[15px] leading-8 text-[#f7ebdf]">
                    {mergeTextOverride(
                      pageConfig?.hero?.storyDescription,
                      "Use the combo story card to explain why the bundle exists, what makes the pairings useful, and why this storefront layout should feel more intentional.",
                    )}
                  </p>

                  <div className="mt-6 space-y-3">
                    {detailCards.slice(0, 2).map((card, index) => (
                      <div
                        key={`story-card-${index}`}
                        className="rounded-[22px] border border-white/12 bg-white/12 p-4"
                      >
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#f3d9c7]">
                          {card.label}
                        </p>
                        <p className="mt-2 text-[18px] font-semibold text-white">
                          {card.value}
                        </p>
                        <p className="mt-1 text-sm text-[#f7ebdf]">
                          {card.helper}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            {images.length > 1 ? (
              <div className="mt-6 flex flex-wrap gap-3">
                {visibleGalleryImages.map((image, index) => (
                  <button
                    key={`${image}-${index}`}
                    type="button"
                    onClick={() => setActiveImageIndex(index)}
                    className={`h-[98px] w-[98px] overflow-hidden rounded-[22px] border bg-white p-2 shadow-sm transition ${
                      activeImageIndex === index
                        ? "border-[#6a4331] ring-1 ring-[#6a4331]"
                        : "border-[#ead7ca]"
                    }`}
                  >
                    <ProductImage
                      src={image}
                      alt={`${combo?.name || "Combo"} ${index + 1}`}
                      responsiveProfile="thumb"
                      sizes="98px"
                      aspect="aspect-square"
                      fit="cover"
                      padding="p-1"
                      rounded="rounded-[16px]"
                      className="h-full w-full"
                    />
                  </button>
                ))}
                {remainingGalleryCount > 0 ? (
                  <button
                    type="button"
                    onClick={() => openGalleryAtIndex(maxVisibleThumbnails)}
                    className="relative h-[98px] w-[98px] overflow-hidden rounded-[22px] border border-[#ead7ca] bg-white p-2 shadow-sm transition"
                  >
                    <ProductImage
                      src={images[maxVisibleThumbnails]}
                      alt="More combo images"
                      responsiveProfile="thumb"
                      sizes="98px"
                      aspect="aspect-square"
                      fit="cover"
                      padding="p-1"
                      rounded="rounded-[16px]"
                      className="h-full w-full"
                      imgClassName="blur-[1px]"
                    />
                    <span className="absolute inset-2 flex items-center justify-center rounded-[16px] bg-black/45 text-lg font-semibold text-white">
                      +{remainingGalleryCount}
                    </span>
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="product-reveal product-reveal-delay-1 rounded-[36px] border border-[#ecd8c9] bg-white/92 p-6 shadow-[0_34px_90px_-55px_rgba(44,29,20,0.35)] sm:p-8 xl:sticky xl:top-[calc(var(--header-height,80px)+20px)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#7b6355]">
                  {combo?.brand || "Combo Deal"}
                </p>
                <h1 className="mt-3 text-[28px] font-semibold leading-[1.08] text-[#24150f] sm:text-[42px]">
                  {combo?.name || "Combo Deal"}
                </h1>
              </div>
              <ShareButton
                productId={comboId}
                productName={combo?.name || "Combo Deal"}
                productDetails={{
                  brand: combo?.brand,
                  price: comboPrice,
                  originalPrice: originalTotal,
                  sku: combo?.sku,
                }}
                variant="icon"
                showLabel={false}
              />
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={scrollToReviews}
                disabled={!showReviewsSection}
                aria-controls="reviews"
                aria-label="Jump to ratings and review form"
                className="flex items-center gap-2 rounded-full border border-[#ecd8c9] bg-[#fbf7f2] px-4 py-2 transition hover:bg-[#f7efe7] disabled:cursor-default disabled:hover:bg-[#fbf7f2]"
              >
                <Rating
                  value={Math.max(starRating, reviewCount > 0 ? starRating : 5)}
                  readOnly
                  size="small"
                  sx={{ pointerEvents: "none" }}
                />
                <span className="text-sm text-[#4b392f]">
                  {reviewCount > 0
                    ? `${reviewCount} review${reviewCount === 1 ? "" : "s"}`
                    : "No reviews yet"}
                </span>
              </button>
              <div className="rounded-full border border-[#ecd8c9] bg-[#fbf7f2] px-4 py-2 text-sm font-medium text-[#6c4a3a]">
                {heroStatusLabel}
              </div>
            </div>

            {combo?.shortDescription ? (
              <p className="mt-5 text-lg leading-8 text-[#6d584a]">
                {combo.shortDescription}
              </p>
            ) : null}

            <div className="mt-7 flex flex-wrap items-end gap-3">
              <p className="text-4xl font-semibold text-[#24150f]">
                {formatPrice(comboPrice)}
              </p>
              {originalTotal > comboPrice ? (
                <p className="pb-1 text-lg font-medium text-[#9a8476] line-through">
                  {formatPrice(originalTotal)}
                </p>
              ) : null}
              {comboDiscountPercent > 0 ? (
                <span
                  className="rounded-full px-4 py-2 text-sm font-semibold"
                  style={{
                    backgroundColor: "var(--primary)",
                    color: "var(--flavor-text, #ffffff)",
                  }}
                >
                  Save {comboDiscountPercent}%
                </span>
              ) : null}
            </div>

            <div className="mt-8">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#7b6355]">
                Included Products
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                {includedItems.length > 0 ? (
                  includedItems.map((item, index) => (
                    <div
                      key={`${item?.productId || "combo-item"}-${index}`}
                      className="rounded-full border border-[#e4d0c3] bg-[#fbf7f2] px-4 py-2 text-sm font-medium text-[#4b392f]"
                    >
                      {item?.productTitle || "Product"}
                    </div>
                  ))
                ) : (
                  <div className="rounded-full border border-[#e4d0c3] bg-[#fbf7f2] px-4 py-2 text-sm text-[#6d584a]">
                    Combo items unavailable
                  </div>
                )}
              </div>
            </div>

            <div
              className={`mt-8 grid gap-4 ${pageConfig?.hero?.showDeliveryPreview !== false ? "xl:grid-cols-2" : ""}`}
            >
              {pageConfig?.hero?.showDeliveryPreview !== false ? (
                <div className="rounded-[28px] border border-[#e3d4c9] bg-[#fbf7f2] p-5">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#7b6355]">
                      Delivery Preview
                    </p>
                    <span className="text-xs font-medium text-[#5d4b41]">
                      {deliveryPincode.length === 6 ? "Ready" : "Optional"}
                    </span>
                  </div>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={deliveryPincode}
                    onChange={(event) =>
                      setDeliveryPincode(
                        event.target.value.replace(/\D/g, "").slice(0, 6),
                      )
                    }
                    placeholder="Enter pincode"
                    className="product-delivery-input mt-4 h-14 w-full rounded-2xl border border-[#d8c6bb] bg-white px-4 text-base text-[#24150f] outline-none transition"
                  />
                  <p
                    className={`mt-3 text-sm ${
                      buildStaticDeliveryMessage(deliveryPincode) ===
                      "Enter Right Pincode"
                        ? "font-semibold text-[#b42318]"
                        : "text-[#5d4b41]"
                    }`}
                  >
                    {buildStaticDeliveryMessage(deliveryPincode)}
                  </p>
                </div>
              ) : null}

              <div className="rounded-[28px] border border-[#e3d4c9] bg-[#fbf7f2] p-5">
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#7b6355]">
                  Quantity
                </p>
                <div className="mt-4 flex items-center justify-between rounded-[22px] border border-[#e4d0c3] bg-white px-4 py-3">
                  <button
                    type="button"
                    onClick={() =>
                      setQuantity((current) => Math.max(current - 1, 1))
                    }
                    className="product-qty-action flex h-11 w-11 items-center justify-center rounded-full bg-[#e9ddd4] text-lg font-semibold text-[#6a4331]"
                  >
                    -
                  </button>
                  <span className="text-lg font-semibold text-[#24150f]">
                    {quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setQuantity((current) => Math.min(current + 1, maxQty))
                    }
                    className="product-qty-action flex h-11 w-11 items-center justify-center rounded-full bg-[#e9ddd4] text-lg font-semibold text-[#6a4331]"
                  >
                    +
                  </button>
                </div>
                <p className="mt-4 text-xs font-semibold uppercase tracking-[0.16em] text-[#9a877a]">
                  SKU
                </p>
                <p className="mt-1 text-base font-semibold text-[#4b392f]">
                  {combo?.sku || "COMBO"}
                </p>
              </div>
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={handleAddCombo}
                disabled={isOutOfStock || isAdding}
                className="flex flex-1 items-center justify-center gap-3 rounded-[22px] border border-[#6a4331] px-6 py-4 text-base font-semibold text-[#6a4331] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <IoMdCart className="text-xl" />
                {isAdding ? "Adding..." : "Add to Cart"}
              </button>
              <button
                type="button"
                onClick={handleBuyNow}
                disabled={isOutOfStock || isAdding}
                className="product-cta-primary flex-1 rounded-[22px] bg-[#6a4331] px-6 py-4 text-base font-semibold text-white transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Buy Now
              </button>
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <div className="rounded-[24px] border border-[#ead7ca] bg-[#fbf7f2] p-5">
                <div className="flex items-start gap-3">
                  <span className="product-trust-icon mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white">
                    <MdLocalShipping className="text-xl" />
                  </span>
                  <div>
                    <p className="text-[15px] font-semibold text-[#24150f]">
                      Free Delivery
                    </p>
                    <p className="mt-1 text-sm leading-6 text-[#6d584a]">
                      Stronger utility near the CTA block.
                    </p>
                  </div>
                </div>
              </div>
              <div className="rounded-[24px] border border-[#ead7ca] bg-[#fbf7f2] p-5">
                <div className="flex items-start gap-3">
                  <span className="product-trust-icon mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white">
                    <MdOutlineSecurity className="text-xl" />
                  </span>
                  <div>
                    <p className="text-[15px] font-semibold text-[#24150f]">
                      Secure Payment
                    </p>
                    <p className="mt-1 text-sm leading-6 text-[#6d584a]">
                      Checkout trust signal stays visible.
                    </p>
                  </div>
                </div>
              </div>
              <div className="rounded-[24px] border border-[#ead7ca] bg-[#fbf7f2] p-5">
                <div className="flex items-start gap-3">
                  <span className="product-trust-icon mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white">
                    <MdVerified className="text-xl" />
                  </span>
                  <div>
                    <p className="text-[15px] font-semibold text-[#24150f]">
                      Authentic Product
                    </p>
                    <p className="mt-1 text-sm leading-6 text-[#6d584a]">
                      Premium surface with useful proof points.
                    </p>
                  </div>
                </div>
              </div>
              <div className="rounded-[24px] border border-[#ead7ca] bg-[#fbf7f2] p-5">
                <div className="flex items-start gap-3">
                  <span className="product-trust-icon mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white">
                    <MdOutlineInventory2 className="text-xl" />
                  </span>
                  <div>
                    <p className="text-[15px] font-semibold text-[#24150f]">
                      Clear Inventory
                    </p>
                    <p className="mt-1 text-sm leading-6 text-[#6d584a]">
                      Bundle-aware stock display for better decisions.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {isOutOfStock ? (
              <div className="mt-6 rounded-[24px] border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                <p>
                  Out of stock because one product in this combo is unavailable.
                </p>
                {outOfStockItems.slice(0, 3).map((item, index) => (
                  <p
                    key={`${item?.productId || "oos"}-${index}`}
                    className="mt-1 text-xs"
                  >
                    {item?.productTitle || "Product"}
                    {item?.variantName ? ` ${item.variantName}` : ""} is
                    currently out of stock.
                  </p>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        {pageConfig?.hero?.showInsightCards !== false ? (
          <div className="product-reveal product-reveal-delay-2 mt-12 grid gap-4 xl:grid-cols-3">
            <div className="rounded-[30px] border border-[#e1cdbf] bg-white/88 p-6 shadow-[0_34px_90px_-55px_rgba(44,29,20,0.28)] backdrop-blur">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#7b6355]">
                {mergeTextOverride(
                  pageConfig?.hero?.priceCardEyebrow,
                  "Price Focus",
                )}
              </p>
              <p className="mt-4 text-[18px] font-semibold leading-8 text-[#24150f]">
                {comboPrice > 0 ? formatPrice(comboPrice) : "Bundle pricing"}
              </p>
              <p className="mt-3 text-sm leading-7 text-[#5d4b41]">
                {mergeTextOverride(
                  pageConfig?.hero?.priceCardDescription,
                  "Bundle pricing is placed closer to the story and CTA so the value proposition stays easy to scan.",
                )}
              </p>
            </div>
            <div className="rounded-[30px] border border-[#e1cdbf] bg-white/88 p-6 shadow-[0_34px_90px_-55px_rgba(44,29,20,0.28)] backdrop-blur">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#7b6355]">
                {mergeTextOverride(
                  pageConfig?.hero?.variantCardEyebrow,
                  "Bundle View",
                )}
              </p>
              <p className="mt-4 text-[18px] font-semibold leading-8 text-[#24150f]">
                {includedItems.length} item
                {includedItems.length === 1 ? "" : "s"}
              </p>
              <p className="mt-3 text-sm leading-7 text-[#5d4b41]">
                {mergeTextOverride(
                  pageConfig?.hero?.variantCardDescription,
                  "Included items stay close to the hero so customers understand what they are buying without hunting through tabs.",
                )}
              </p>
            </div>
            <div className="rounded-[30px] border border-[#e1cdbf] bg-white/88 p-6 shadow-[0_34px_90px_-55px_rgba(44,29,20,0.28)] backdrop-blur">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#7b6355]">
                {mergeTextOverride(
                  pageConfig?.hero?.socialProofEyebrow,
                  "Social Proof",
                )}
              </p>
              <p className="mt-4 text-[18px] font-semibold leading-8 text-[#24150f]">
                {reviewCount > 0
                  ? `${reviewCount} review${reviewCount === 1 ? "" : "s"}`
                  : "No reviews yet"}
              </p>
              <p className="mt-3 text-sm leading-7 text-[#5d4b41]">
                {mergeTextOverride(
                  pageConfig?.hero?.socialProofDescription,
                  "Ratings and trust cues sit closer to the main decision block so the combo page feels more complete and conversion-ready.",
                )}
              </p>
            </div>
          </div>
        ) : null}

        {tabs.length > 0 ? (
          <div className="product-reveal product-reveal-delay-2 mt-12 rounded-[36px] border border-[#e1cdbf] bg-white/88 p-6 shadow-[0_34px_90px_-55px_rgba(44,29,20,0.38)] backdrop-blur sm:p-8">
            <div className="flex flex-wrap gap-3">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`rounded-full border px-5 py-2.5 text-sm font-semibold transition ${
                    activeTab === tab.id
                      ? "product-tab-active border-[#6a4331]"
                      : "border-[#e5d4c7] bg-[#fbf7f2] text-[#6d584a]"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {activeTab === "description" &&
            pageConfig?.descriptionSection?.show !== false ? (
              <div className="mt-8 grid items-start gap-6 xl:grid-cols-2">
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
                          alt={combo?.name || "Combo showcase"}
                          responsiveProfile="content"
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
                            "A stronger combo story can live next to the bundle without overwhelming the purchase decision.",
                          )}
                        </h2>
                        <p className="mt-4 text-base leading-7 text-[#f8ebe2]">
                          {mergeTextOverride(
                            pageConfig?.descriptionSection
                              ?.editorialDescription,
                            "Use this section to explain the thinking behind the bundle, the shopping outcome it solves, and why the included products belong together.",
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
                      {combo?.description &&
                      /<\/?[a-z][\s\S]*>/i.test(combo.description) ? (
                        <div
                          className="max-w-none text-[#4b392f]"
                          dangerouslySetInnerHTML={{
                            __html: sanitizeHTML(combo.description),
                          }}
                        />
                      ) : null}
                      {(!combo?.description ||
                        !/<\/?[a-z][\s\S]*>/i.test(combo.description)) &&
                        descriptionParagraphs.map((paragraph, index) => (
                          <p key={`combo-desc-${index}`}>{paragraph}</p>
                        ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            {activeTab === "details" &&
            pageConfig?.detailsSection?.show !== false ? (
              <div className="mt-8 space-y-8">
                {pageConfig?.detailsSection?.showCards !== false ? (
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    {detailCards.map((card, index) => (
                      <div
                        key={`combo-detail-card-${index}`}
                        className="rounded-[24px] border border-[#e7dad1] bg-[#fbf7f2] p-5"
                      >
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#7b6355]">
                          {card.label}
                        </p>
                        <p className="mt-3 text-[22px] font-semibold text-[#24150f]">
                          {card.value}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-[#6d584a]">
                          {card.helper}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}

            {activeTab === "shipping" &&
            pageConfig?.shippingSection?.show !== false ? (
              <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
                {pageConfig?.shippingSection?.showPoints !== false ? (
                  <div className="rounded-[30px] border border-[#e7dad1] bg-[#fbf7f2] p-6">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#7b6355]">
                      {mergeTextOverride(
                        pageConfig?.shippingSection?.pointsEyebrow,
                        "Shipping & Trust",
                      )}
                    </p>
                    <div className="mt-5 space-y-4">
                      {shippingPoints.map((point, index) => (
                        <div
                          key={`combo-shipping-point-${index}`}
                          className="flex gap-3"
                        >
                          <span className="product-trust-icon mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white">
                            {index === 0 ? (
                              <MdLocalShipping />
                            ) : index === 1 ? (
                              <MdVerified />
                            ) : (
                              <MdOutlineSecurity />
                            )}
                          </span>
                          <p className="text-[15px] leading-7 text-[#4b392f]">
                            {point}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {pageConfig?.shippingSection?.showReasonsPanel !== false ? (
                  <div className="rounded-[30px] border border-[#e7dad1] bg-white p-6">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#7b6355]">
                      {mergeTextOverride(
                        pageConfig?.shippingSection?.reasonsEyebrow,
                        "Why This Feels Better",
                      )}
                    </p>
                    <div className="mt-4 space-y-4 text-[15px] leading-7 text-[#4b392f]">
                      {mergeListWithDefaults(
                        pageConfig?.shippingSection?.reasonsParagraphs || [],
                        [
                          "The combo detail page now keeps trust information inside a calmer layout instead of pushing it far below the bundle hero.",
                          "Included product clarity, savings, and delivery context stay easier to scan without losing the editorial feel.",
                          "That makes combo bundles feel more intentional and much closer to the upgraded product detail experience.",
                        ],
                      ).map((paragraph, index) => (
                        <p key={`combo-reason-${index}`}>{paragraph}</p>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        {showReviewsSection ? (
          <div
            id="reviews"
            ref={reviewSectionRef}
            className="product-reveal product-reveal-delay-3 mt-12 rounded-[36px] border border-[#e1cdbf] bg-white/88 p-6 shadow-[0_34px_90px_-55px_rgba(44,29,20,0.38)] backdrop-blur sm:p-8"
            style={{
              scrollMarginTop: "calc(var(--header-height, 0px) + 24px)",
            }}
          >
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
              <label className="min-w-[180px] text-sm font-semibold text-[#4b392f]">
                <span className="mb-2 block text-xs uppercase tracking-[0.16em] text-[#7b6355]">
                  Sort
                </span>
                <select
                  value={reviewSort}
                  onChange={(event) => setReviewSort(event.target.value)}
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
                    {reviewRating > 0 ? reviewRating.toFixed(1) : "0.0"}
                  </span>
                  <Rating
                    value={reviewRating}
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
              ) : sortedReviews.length > 0 ? (
                <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-3 [scrollbar-width:thin]">
                  {sortedReviews.slice(0, 10).map((review, index) => (
                    <article
                      key={
                        review?._id ||
                        `${review?.userName || "review"}-${index}`
                      }
                      className="min-w-[280px] snap-start rounded-[28px] border border-[#e7dad1] bg-[#fbf7f2] p-6 sm:min-w-[320px] lg:min-w-[360px]"
                    >
                      <div className="flex items-center gap-4">
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#2f1b12] text-base font-semibold text-white">
                          {getReviewInitials(review)}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-[#24150f]">
                            {review?.userName || "Customer"}
                          </p>
                          <p className="text-sm text-[#6d584a]">
                            {[review?.city, formatReviewDate(review?.createdAt)]
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
              ) : (
                <p className="text-sm font-semibold text-[#6d584a]">
                  No reviews yet
                </p>
              )}
            </div>

            {showPublicReviewForm ? (
              <div
                ref={publicReviewFormRef}
                className="mt-8 rounded-[28px] border border-[#eaded5] bg-[#f8f2eb] p-6"
                style={{
                  scrollMarginTop: "calc(var(--header-height, 0px) + 24px)",
                }}
              >
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
                    "Helpful add-ons that pair well with this combo",
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
                <p className="text-sm text-[#6d584a]">Loading suggestions...</p>
              ) : frequentlyBought.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {frequentlyBought.map((item, index) => {
                    const recommendation = getRecommendationPayload(item);
                    if (!recommendation?.product) return null;

                    const recProduct = recommendation.product;
                    const recProductId =
                      recProduct?._id || recProduct?.id || "";
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
                            responsiveProfile="thumb"
                            sizes="72px"
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
                              {formatPrice(toNumber(recommendation.price, 0))}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const payload =
                              buildCartProductFromRecommendation(item);
                            if (!payload) return;
                            addToCart(payload, 1);
                          }}
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
                <p className="text-sm text-[#6d584a]">Loading products...</p>
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
                  {recommendedCombos.map((comboItem) => (
                    <ComboCard
                      key={comboItem._id || comboItem.slug}
                      combo={comboItem}
                      context="combo_recommended_combos"
                    />
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        <div
          className="product-reveal product-reveal-delay-3 mt-12 rounded-[36px] border border-[#e1cdbf] bg-white/88 p-6 shadow-[0_34px_90px_-55px_rgba(44,29,20,0.38)] backdrop-blur sm:p-8"
          data-track-section="combo_included_products"
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#7b6355]">
                Bundle Composition
              </p>
              <h2 className="mt-2 text-3xl font-semibold text-[#24150f]">
                Products included in this combo
              </h2>
            </div>
            <Link
              href="/combo-deals"
              className="text-sm font-semibold"
              style={{ color: "var(--primary)" }}
            >
              View all combos
            </Link>
          </div>

          {includedItems.length > 0 ? (
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {includedItems.map((item, index) => {
                const itemImage = getImageUrl(
                  item?.image || FALLBACK_COMBO_IMAGE,
                );
                return (
                  <div
                    key={`${item?.productId || "combo-item"}-${index}`}
                    className="rounded-[28px] border border-[#e7dad1] bg-[#fbf7f2] p-5"
                  >
                    <div className="flex gap-4">
                      <div className="flex h-[84px] w-[84px] items-center justify-center rounded-2xl border border-[#efe4dc] bg-white p-2">
                        <img
                          src={itemImage}
                          alt={item?.productTitle || "Product"}
                          className="h-full w-full object-contain"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/product/${item?.productId || ""}`}
                          className="text-base font-semibold text-[#24150f] hover:text-[var(--primary)]"
                        >
                          {item?.productTitle || "Product"}
                        </Link>
                        {formatComboVariantLabel(item) ? (
                          <p className="mt-1 text-sm text-[#6d584a]">
                            Variant: {formatComboVariantLabel(item)}
                          </p>
                        ) : null}
                        <p className="mt-1 text-sm text-[#6d584a]">
                          Qty: {item?.quantity || 1}
                        </p>
                        <div className="mt-3 flex items-center gap-2">
                          {toNumber(item?.originalPrice, 0) >
                          toNumber(item?.price, 0) ? (
                            <span className="text-sm text-[#a08d80] line-through">
                              {formatPrice(toNumber(item?.originalPrice, 0))}
                            </span>
                          ) : null}
                          <span className="text-base font-semibold text-[#24150f]">
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
            <p className="mt-6 text-sm text-[#6d584a]">
              Combo items are not available right now.
            </p>
          )}
        </div>
      </div>

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

        .product-qty-action:hover {
          filter: brightness(0.96);
        }

        .product-tab-active {
          background: var(--pd-accent);
          color: var(--pd-accent-text);
        }

        .product-cta-primary:hover {
          background-color: var(--pd-accent-hover) !important;
        }

        .product-trust-icon {
          background: var(--pd-accent);
        }

        @media (prefers-reduced-motion: reduce) {
          .product-reveal {
            animation: none !important;
            opacity: 1 !important;
            transform: none !important;
          }
        }
      `}</style>
    </section>
  );
}
