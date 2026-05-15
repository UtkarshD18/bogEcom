const toTrimmedString = (value, maxLength = 500) =>
  String(value || "")
    .trim()
    .slice(0, maxLength);

const LEGACY_STORY_COPY = new Set(
  [
    "Product Story",
    "A cleaner product story with the important buying details kept close to the decision point.",
    "A cleaner product story with the key buying details kept close to the decision point.",
    "Keep the product story, pricing, trust cues, and delivery context in one calm layout without pushing the buying actions too far away.",
    "The refreshed detail page keeps product story, trust cues, pricing, and delivery context in one calm layout without pushing the buying actions too far away.",
  ].map((value) => toTrimmedString(value).toLowerCase()),
);

const sanitizeStoryField = (value, maxLength = 500) => {
  const trimmed = toTrimmedString(value, maxLength);
  return LEGACY_STORY_COPY.has(trimmed.toLowerCase()) ? "" : trimmed;
};

const toBooleanWithFallback = (value, fallback = true) => {
  if (typeof value === "boolean") return value;

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }

  return fallback;
};

const toStringList = (value, { limit = 8, maxLength = 240 } = {}) => {
  if (!Array.isArray(value)) return [];

  return value
    .map((entry) => toTrimmedString(entry, maxLength))
    .filter(Boolean)
    .slice(0, limit);
};

const toCards = (
  value,
  { limit = 4, fields = ["label", "helper"], maxLength = 120 } = {},
) => {
  if (!Array.isArray(value)) return [];

  return value
    .map((card) => {
      const normalizedCard = {};

      fields.forEach((field) => {
        normalizedCard[field] = toTrimmedString(card?.[field], maxLength);
      });

      return normalizedCard;
    })
    .slice(0, limit);
};

export const normalizeProductPageConfig = (value = {}) => {
  const source = value && typeof value === "object" ? value : {};

  return {
    hero: {
      showStoryCard: toBooleanWithFallback(
        source?.hero?.showStoryCard,
        true,
      ),
      showInsightCards: toBooleanWithFallback(
        source?.hero?.showInsightCards,
        true,
      ),
      showDeliveryPreview: toBooleanWithFallback(
        source?.hero?.showDeliveryPreview,
        true,
      ),
      storyEyebrow: sanitizeStoryField(source?.hero?.storyEyebrow, 80),
      storyTitle: sanitizeStoryField(source?.hero?.storyTitle, 180),
      storyDescription: sanitizeStoryField(
        source?.hero?.storyDescription,
        360,
      ),
      priceCardEyebrow: toTrimmedString(source?.hero?.priceCardEyebrow, 80),
      priceCardDescription: toTrimmedString(
        source?.hero?.priceCardDescription,
        220,
      ),
      variantCardEyebrow: toTrimmedString(
        source?.hero?.variantCardEyebrow,
        80,
      ),
      variantCardDescription: toTrimmedString(
        source?.hero?.variantCardDescription,
        220,
      ),
      socialProofEyebrow: toTrimmedString(
        source?.hero?.socialProofEyebrow,
        80,
      ),
      socialProofDescription: toTrimmedString(
        source?.hero?.socialProofDescription,
        220,
      ),
      showSupportCards: toBooleanWithFallback(
        source?.hero?.showSupportCards,
        true,
      ),
      deliveryEyebrow: toTrimmedString(source?.hero?.deliveryEyebrow, 80),
      deliveryOptionalLabel: toTrimmedString(
        source?.hero?.deliveryOptionalLabel,
        40,
      ),
      deliveryReadyLabel: toTrimmedString(source?.hero?.deliveryReadyLabel, 40),
      deliveryInputPlaceholder: toTrimmedString(
        source?.hero?.deliveryInputPlaceholder,
        80,
      ),
      deliveryHelperText: toTrimmedString(
        source?.hero?.deliveryHelperText,
        180,
      ),
      supportCards: toCards(source?.hero?.supportCards, {
        limit: 4,
        fields: ["title", "description"],
        maxLength: 180,
      }),
    },
    tabs: {
      showDescription: toBooleanWithFallback(
        source?.tabs?.showDescription,
        true,
      ),
      descriptionLabel:
        toTrimmedString(source?.tabs?.descriptionLabel, 60) || "Description",
      showDetails: toBooleanWithFallback(source?.tabs?.showDetails, true),
      detailsLabel:
        toTrimmedString(source?.tabs?.detailsLabel, 60) || "Product Details",
      showShipping: toBooleanWithFallback(source?.tabs?.showShipping, true),
      shippingLabel:
        toTrimmedString(source?.tabs?.shippingLabel, 60) || "Shipping & Trust",
    },
    descriptionSection: {
      show: toBooleanWithFallback(source?.descriptionSection?.show, true),
      showEditorialBanner: toBooleanWithFallback(
        source?.descriptionSection?.showEditorialBanner,
        true,
      ),
      showDescriptionFlow: toBooleanWithFallback(
        source?.descriptionSection?.showDescriptionFlow,
        true,
      ),
      editorialEyebrow: toTrimmedString(
        source?.descriptionSection?.editorialEyebrow,
        80,
      ),
      editorialTitle: toTrimmedString(
        source?.descriptionSection?.editorialTitle,
        180,
      ),
      editorialDescription: toTrimmedString(
        source?.descriptionSection?.editorialDescription,
        360,
      ),
      featuredBannerImage: toTrimmedString(
        source?.descriptionSection?.featuredBannerImage,
        500,
      ),
      showFeaturedBannerImage: toBooleanWithFallback(
        source?.descriptionSection?.showFeaturedBannerImage,
        true,
      ),
      flowEyebrow: toTrimmedString(
        source?.descriptionSection?.flowEyebrow,
        80,
      ),
      extraParagraphs: toStringList(
        source?.descriptionSection?.extraParagraphs,
        {
          limit: 6,
          maxLength: 500,
        },
      ),
    },
    detailsSection: {
      show: toBooleanWithFallback(source?.detailsSection?.show, true),
      showCards: toBooleanWithFallback(
        source?.detailsSection?.showCards,
        true,
      ),
      cards: toCards(source?.detailsSection?.cards, {
        limit: 4,
        fields: ["label", "helper"],
        maxLength: 120,
      }),
    },
    shippingSection: {
      show: toBooleanWithFallback(source?.shippingSection?.show, true),
      showPoints: toBooleanWithFallback(
        source?.shippingSection?.showPoints,
        true,
      ),
      showReasonsPanel: toBooleanWithFallback(
        source?.shippingSection?.showReasonsPanel,
        true,
      ),
      pointsEyebrow: toTrimmedString(
        source?.shippingSection?.pointsEyebrow,
        80,
      ),
      points: toStringList(source?.shippingSection?.points, {
        limit: 8,
        maxLength: 240,
      }),
      reasonsEyebrow: toTrimmedString(
        source?.shippingSection?.reasonsEyebrow,
        80,
      ),
      reasonsParagraphs: toStringList(
        source?.shippingSection?.reasonsParagraphs,
        {
          limit: 6,
          maxLength: 280,
        },
      ),
    },
    reviewsSection: {
      show: toBooleanWithFallback(source?.reviewsSection?.show, true),
      eyebrow: toTrimmedString(source?.reviewsSection?.eyebrow, 80),
      title: toTrimmedString(source?.reviewsSection?.title, 180),
    },
    frequentlyBoughtSection: {
      show: toBooleanWithFallback(
        source?.frequentlyBoughtSection?.show,
        true,
      ),
      eyebrow: toTrimmedString(
        source?.frequentlyBoughtSection?.eyebrow,
        80,
      ),
      title: toTrimmedString(source?.frequentlyBoughtSection?.title, 180),
      buttonText: toTrimmedString(
        source?.frequentlyBoughtSection?.buttonText,
        60,
      ),
    },
    recommendedCombosSection: {
      show: toBooleanWithFallback(
        source?.recommendedCombosSection?.show,
        true,
      ),
      eyebrow: toTrimmedString(
        source?.recommendedCombosSection?.eyebrow,
        80,
      ),
      title: toTrimmedString(source?.recommendedCombosSection?.title, 180),
      linkText: toTrimmedString(
        source?.recommendedCombosSection?.linkText,
        60,
      ),
    },
  };
};
