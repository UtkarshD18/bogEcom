const toTrimmedString = (value) => String(value || "").trim();

const LEGACY_STORY_COPY = new Set(
  [
    "Product Story",
    "A cleaner product story with the important buying details kept close to the decision point.",
    "A cleaner product story with the key buying details kept close to the decision point.",
    "Keep the product story, pricing, trust cues, and delivery context in one calm layout without pushing the buying actions too far away.",
    "The refreshed detail page keeps product story, trust cues, pricing, and delivery context in one calm layout without pushing the buying actions too far away.",
  ].map((value) => toTrimmedString(value).toLowerCase()),
);

const sanitizeStoryField = (value) => {
  const trimmed = toTrimmedString(value);
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

const toStringList = (value) =>
  Array.isArray(value)
    ? value.map((entry) => toTrimmedString(entry)).filter(Boolean)
    : [];

const toCards = (value, fields = ["label", "helper"]) =>
  Array.isArray(value)
    ? value.map((card) => ({
        ...fields.reduce((acc, field) => {
          acc[field] = toTrimmedString(card?.[field]);
          return acc;
        }, {}),
      }))
    : [];

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
      storyEyebrow: sanitizeStoryField(source?.hero?.storyEyebrow),
      storyTitle: sanitizeStoryField(source?.hero?.storyTitle),
      storyDescription: sanitizeStoryField(source?.hero?.storyDescription),
      priceCardEyebrow: toTrimmedString(source?.hero?.priceCardEyebrow),
      priceCardDescription: toTrimmedString(
        source?.hero?.priceCardDescription,
      ),
      variantCardEyebrow: toTrimmedString(source?.hero?.variantCardEyebrow),
      variantCardDescription: toTrimmedString(
        source?.hero?.variantCardDescription,
      ),
      socialProofEyebrow: toTrimmedString(source?.hero?.socialProofEyebrow),
      socialProofDescription: toTrimmedString(
        source?.hero?.socialProofDescription,
      ),
      showSupportCards: toBooleanWithFallback(
        source?.hero?.showSupportCards,
        true,
      ),
      deliveryEyebrow: toTrimmedString(source?.hero?.deliveryEyebrow),
      deliveryOptionalLabel: toTrimmedString(
        source?.hero?.deliveryOptionalLabel,
      ),
      deliveryReadyLabel: toTrimmedString(source?.hero?.deliveryReadyLabel),
      deliveryInputPlaceholder: toTrimmedString(
        source?.hero?.deliveryInputPlaceholder,
      ),
      deliveryHelperText: toTrimmedString(source?.hero?.deliveryHelperText),
      supportCards: toCards(source?.hero?.supportCards, [
        "title",
        "description",
      ]),
    },
    tabs: {
      showDescription: toBooleanWithFallback(
        source?.tabs?.showDescription,
        true,
      ),
      descriptionLabel: toTrimmedString(source?.tabs?.descriptionLabel),
      showDetails: toBooleanWithFallback(source?.tabs?.showDetails, true),
      detailsLabel: toTrimmedString(source?.tabs?.detailsLabel),
      showShipping: toBooleanWithFallback(source?.tabs?.showShipping, true),
      shippingLabel: toTrimmedString(source?.tabs?.shippingLabel),
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
      ),
      editorialTitle: toTrimmedString(
        source?.descriptionSection?.editorialTitle,
      ),
      editorialDescription: toTrimmedString(
        source?.descriptionSection?.editorialDescription,
      ),
      featuredBannerImage: toTrimmedString(
        source?.descriptionSection?.featuredBannerImage,
      ),
      showFeaturedBannerImage: toBooleanWithFallback(
        source?.descriptionSection?.showFeaturedBannerImage,
        true,
      ),
      flowEyebrow: toTrimmedString(source?.descriptionSection?.flowEyebrow),
      extraParagraphs: toStringList(source?.descriptionSection?.extraParagraphs),
    },
    detailsSection: {
      show: toBooleanWithFallback(source?.detailsSection?.show, true),
      showCards: toBooleanWithFallback(
        source?.detailsSection?.showCards,
        true,
      ),
      cards: toCards(source?.detailsSection?.cards, ["label", "helper"]),
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
      pointsEyebrow: toTrimmedString(source?.shippingSection?.pointsEyebrow),
      points: toStringList(source?.shippingSection?.points),
      reasonsEyebrow: toTrimmedString(
        source?.shippingSection?.reasonsEyebrow,
      ),
      reasonsParagraphs: toStringList(source?.shippingSection?.reasonsParagraphs),
    },
    reviewsSection: {
      show: toBooleanWithFallback(source?.reviewsSection?.show, true),
      eyebrow: toTrimmedString(source?.reviewsSection?.eyebrow),
      title: toTrimmedString(source?.reviewsSection?.title),
    },
    frequentlyBoughtSection: {
      show: toBooleanWithFallback(
        source?.frequentlyBoughtSection?.show,
        true,
      ),
      eyebrow: toTrimmedString(source?.frequentlyBoughtSection?.eyebrow),
      title: toTrimmedString(source?.frequentlyBoughtSection?.title),
      buttonText: toTrimmedString(
        source?.frequentlyBoughtSection?.buttonText,
      ),
    },
    recommendedCombosSection: {
      show: toBooleanWithFallback(
        source?.recommendedCombosSection?.show,
        true,
      ),
      eyebrow: toTrimmedString(source?.recommendedCombosSection?.eyebrow),
      title: toTrimmedString(source?.recommendedCombosSection?.title),
      linkText: toTrimmedString(source?.recommendedCombosSection?.linkText),
    },
  };
};

export const mergeTextOverride = (customText, fallbackValue) =>
  toTrimmedString(customText) || fallbackValue;

export const mergeCardCopyWithDefaults = (
  defaultCards = [],
  overrideCards = [],
) =>
  defaultCards.map((card, index) => {
    const override = Array.isArray(overrideCards) ? overrideCards[index] || {} : {};
    const merged = { ...card };

    Object.keys(card || {}).forEach((key) => {
      if (["value", "icon", "id"].includes(key)) return;
      const overrideValue = toTrimmedString(override?.[key]);
      if (overrideValue) {
        merged[key] = overrideValue;
      }
    });

    return merged;
  });

export const mergeCardsWithDefaults = mergeCardCopyWithDefaults;

export const mergeListWithDefaults = (overrideItems = [], fallbackItems = []) =>
  overrideItems.length > 0 ? overrideItems : fallbackItems;
