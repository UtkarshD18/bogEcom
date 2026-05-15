const LEGACY_STORY_COPY = new Set(
  [
    "Product Story",
    "A cleaner product story with the important buying details kept close to the decision point.",
    "A cleaner product story with the key buying details kept close to the decision point.",
    "Keep the product story, pricing, trust cues, and delivery context in one calm layout without pushing the buying actions too far away.",
    "The refreshed detail page keeps product story, trust cues, pricing, and delivery context in one calm layout without pushing the buying actions too far away.",
  ].map((value) => String(value || "").trim().toLowerCase()),
);

const normalizeComparableText = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();

const sanitizeStoryField = (value) => {
  const trimmed = String(value || "").trim();
  return LEGACY_STORY_COPY.has(normalizeComparableText(trimmed)) ? "" : trimmed;
};

const DEFAULT_PRODUCT_PAGE_CONFIG = {
  hero: {
    showStoryCard: true,
    showInsightCards: true,
    showDeliveryPreview: true,
    showSupportCards: true,
    storyEyebrow: "",
    storyTitle: "",
    storyDescription: "",
    priceCardEyebrow: "Price Focus",
    priceCardDescription:
      "Clean, high-contrast pricing with supporting variant context.",
    variantCardEyebrow: "Variant View",
    variantCardDescription:
      "Easy-to-scan options that stay near the CTA block.",
    socialProofEyebrow: "Social Proof",
    socialProofDescription:
      "Reviews sit closer to the product story so buyers see trust signals earlier.",
    deliveryEyebrow: "Delivery Preview",
    deliveryOptionalLabel: "Optional",
    deliveryReadyLabel: "Ready",
    deliveryInputPlaceholder: "Enter pincode",
    deliveryHelperText: "Enter a 6-digit pincode to preview delivery timing.",
    supportCards: [
      {
        title: "Free Delivery",
        description: "Stronger utility near the CTA block.",
      },
      {
        title: "Secure Payment",
        description: "Checkout trust signal stays visible.",
      },
      {
        title: "Authentic Product",
        description: "Premium surface with useful proof points.",
      },
      {
        title: "Clear Inventory",
        description: "Variant-aware stock display for better decisions.",
      },
    ],
  },
  tabs: {
    showDescription: true,
    descriptionLabel: "Description",
    showDetails: true,
    detailsLabel: "Product Details",
    showShipping: true,
    shippingLabel: "Shipping & Trust",
  },
  descriptionSection: {
    show: true,
    showEditorialBanner: true,
    showDescriptionFlow: true,
    editorialEyebrow: "Featured Overview",
    editorialTitle:
      "A stronger product story can live right beside the product without overwhelming the transaction.",
    editorialDescription:
      "This section gives longer-form content a more intentional home, helping the product feel more premium while keeping the purchase path above it calm and focused.",
    featuredBannerImage: "",
    showFeaturedBannerImage: true,
    flowEyebrow: "Description Flow",
    extraParagraphs: [],
  },
  detailsSection: {
    show: true,
    showCards: true,
    cards: [
      {
        label: "Category",
        helper: "Live product taxonomy",
      },
      {
        label: "Selected Pack",
        helper: "Variant-aware display",
      },
      {
        label: "Customer Reviews",
        helper: "Visible social proof",
      },
      {
        label: "Availability",
        helper: "Real-time stock signal",
      },
    ],
  },
  shippingSection: {
    show: true,
    showPoints: true,
    showReasonsPanel: true,
    pointsEyebrow: "Shipping & Trust",
    points: [],
    reasonsEyebrow: "Why This Feels Better",
    reasonsParagraphs: [
      "The updated structure keeps support information within reach without drowning the buyer in a wall of plain text.",
      "Trust markers, delivery context, and review content now sit in a more natural sequence after the hero instead of feeling detached from the decision point.",
      "The result is a calmer, more premium product page that still stays conversion-focused.",
    ],
  },
  reviewsSection: {
    show: true,
    eyebrow: "Review Section",
    title: "Ratings and reviews",
  },
  frequentlyBoughtSection: {
    show: true,
    eyebrow: "Frequently Bought Together",
    title: "Helpful add-ons close to the primary product",
    buttonText: "Add All To Cart",
  },
  recommendedCombosSection: {
    show: true,
    eyebrow: "Recommended Combos",
    title: "Bundle options that support the same buying flow",
    linkText: "View all combos",
  },
};

const cloneConfig = (value) => JSON.parse(JSON.stringify(value));

const mergeCardArray = (defaults = [], overrides = [], fields = []) =>
  defaults.map((card, index) => {
    const override = Array.isArray(overrides) ? overrides[index] || {} : {};
    const merged = { ...card };

    fields.forEach((field) => {
      const overrideValue = String(override?.[field] || "").trim();
      merged[field] = overrideValue || String(card?.[field] || "").trim();
    });

    return merged;
  });

export const createDefaultProductPageConfig = () =>
  cloneConfig(DEFAULT_PRODUCT_PAGE_CONFIG);

export const mergeProductPageConfig = (value = {}) => {
  const source = value && typeof value === "object" ? value : {};
  const defaults = createDefaultProductPageConfig();

  return {
    ...defaults,
    hero: {
      ...defaults.hero,
      ...(source.hero || {}),
      storyEyebrow: sanitizeStoryField(source?.hero?.storyEyebrow),
      storyTitle: sanitizeStoryField(source?.hero?.storyTitle),
      storyDescription: sanitizeStoryField(source?.hero?.storyDescription),
      supportCards: mergeCardArray(
        defaults.hero.supportCards,
        source?.hero?.supportCards,
        ["title", "description"],
      ),
    },
    tabs: {
      ...defaults.tabs,
      ...(source.tabs || {}),
    },
    descriptionSection: {
      ...defaults.descriptionSection,
      ...(source.descriptionSection || {}),
      showFeaturedBannerImage:
        source?.descriptionSection?.showFeaturedBannerImage !== false,
      extraParagraphs: Array.isArray(source?.descriptionSection?.extraParagraphs)
        ? source.descriptionSection.extraParagraphs
        : defaults.descriptionSection.extraParagraphs,
    },
    detailsSection: {
      ...defaults.detailsSection,
      ...(source.detailsSection || {}),
      cards: mergeCardArray(
        defaults.detailsSection.cards,
        source?.detailsSection?.cards,
        ["label", "helper"],
      ),
    },
    shippingSection: {
      ...defaults.shippingSection,
      ...(source.shippingSection || {}),
      points: Array.isArray(source?.shippingSection?.points)
        ? source.shippingSection.points
        : defaults.shippingSection.points,
      reasonsParagraphs: Array.isArray(
        source?.shippingSection?.reasonsParagraphs,
      )
        ? source.shippingSection.reasonsParagraphs
        : defaults.shippingSection.reasonsParagraphs,
    },
    reviewsSection: {
      ...defaults.reviewsSection,
      ...(source.reviewsSection || {}),
    },
    frequentlyBoughtSection: {
      ...defaults.frequentlyBoughtSection,
      ...(source.frequentlyBoughtSection || {}),
    },
    recommendedCombosSection: {
      ...defaults.recommendedCombosSection,
      ...(source.recommendedCombosSection || {}),
    },
  };
};
