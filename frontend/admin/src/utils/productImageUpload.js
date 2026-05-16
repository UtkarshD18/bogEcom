const ASPECT_RATIO_TOLERANCE = 0.18;

export const PRODUCT_IMAGE_MAX_FILES = 10;
export const PRODUCT_IMAGE_MAX_SIZE_BYTES = 5 * 1024 * 1024;

export const PRODUCT_IMAGE_DESKTOP_SPEC = {
  label: "Desktop storefront",
  width: 1600,
  height: 1600,
};

export const PRODUCT_IMAGE_MOBILE_SPEC = {
  label: "Mobile storefront",
  width: 1080,
  height: 1080,
};

export const PRODUCT_IMAGE_MIN_SPEC = {
  label: "Minimum accepted",
  width: 900,
  height: 900,
};

const PRODUCT_IMAGE_TARGET_ASPECT_RATIO = 1;

const roundToTwo = (value) => Math.round(Number(value || 0) * 100) / 100;

export const formatAspectRatio = (value) => `${roundToTwo(value)}:1`;

export const formatImageDimensions = (dimensions) => {
  if (!dimensions?.width || !dimensions?.height) {
    return "Unknown resolution";
  }

  return `${dimensions.width} x ${dimensions.height}`;
};

export const readFileAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Failed to read image file"));
    reader.readAsDataURL(file);
  });

export const loadImageDimensions = (src) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const width = Number(image.naturalWidth || 0);
      const height = Number(image.naturalHeight || 0);

      if (!width || !height) {
        reject(new Error("Unable to resolve image dimensions"));
        return;
      }

      resolve({
        width,
        height,
        aspectRatio: width / height,
      });
    };
    image.onerror = () => reject(new Error("Failed to load image preview"));
    image.src = String(src || "");
  });

const meetsSpec = (dimensions, spec) =>
  Boolean(
    dimensions?.width >= spec?.width && dimensions?.height >= spec?.height,
  );

export const getProductImageDimensionError = (dimensions) => {
  if (!dimensions?.width || !dimensions?.height) {
    return "We could not read this image. Please choose another file.";
  }

  if (
    dimensions.width < PRODUCT_IMAGE_MIN_SPEC.width ||
    dimensions.height < PRODUCT_IMAGE_MIN_SPEC.height
  ) {
    return `${PRODUCT_IMAGE_MIN_SPEC.label} is ${PRODUCT_IMAGE_MIN_SPEC.width} x ${PRODUCT_IMAGE_MIN_SPEC.height}. This file is ${formatImageDimensions(dimensions)}.`;
  }

  return "";
};

export const getProductImageWarnings = (dimensions) => {
  if (!dimensions?.width || !dimensions?.height) {
    return [];
  }

  const warnings = [];
  const aspectRatioDelta =
    Math.abs(dimensions.aspectRatio - PRODUCT_IMAGE_TARGET_ASPECT_RATIO) /
    PRODUCT_IMAGE_TARGET_ASPECT_RATIO;

  if (!meetsSpec(dimensions, PRODUCT_IMAGE_DESKTOP_SPEC)) {
    warnings.push(
      `${PRODUCT_IMAGE_DESKTOP_SPEC.label} looks best at ${PRODUCT_IMAGE_DESKTOP_SPEC.width} x ${PRODUCT_IMAGE_DESKTOP_SPEC.height} or larger.`,
    );
  }

  if (!meetsSpec(dimensions, PRODUCT_IMAGE_MOBILE_SPEC)) {
    warnings.push(
      `${PRODUCT_IMAGE_MOBILE_SPEC.label} works best at ${PRODUCT_IMAGE_MOBILE_SPEC.width} x ${PRODUCT_IMAGE_MOBILE_SPEC.height} or larger.`,
    );
  }

  if (aspectRatioDelta > ASPECT_RATIO_TOLERANCE) {
    warnings.push(
      `Square product images look best. This upload is ${formatAspectRatio(dimensions.aspectRatio)} and may crop more aggressively in some cards.`,
    );
  }

  return warnings;
};

export const getProductImageReadiness = (dimensions) => ({
  desktop: meetsSpec(dimensions, PRODUCT_IMAGE_DESKTOP_SPEC),
  mobile: meetsSpec(dimensions, PRODUCT_IMAGE_MOBILE_SPEC),
});

export const getProductImageQualityLabel = (asset) => {
  if (asset?.readiness?.desktop) {
    return {
      label: "Desktop + Mobile ready",
      className: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    };
  }

  if (asset?.readiness?.mobile) {
    return {
      label: "Mobile ready",
      className: "bg-amber-50 text-amber-700 border border-amber-200",
    };
  }

  return {
    label: "Resolution check needed",
    className: "bg-slate-100 text-slate-600 border border-slate-200",
  };
};

export const buildProductImageAsset = async ({
  file = null,
  src = "",
  isExisting = false,
}) => {
  const preview = file ? await readFileAsDataUrl(file) : String(src || "").trim();
  if (!preview) return null;

  try {
    const dimensions = await loadImageDimensions(preview);
    return {
      file,
      preview,
      isExisting,
      dimensions,
      readiness: getProductImageReadiness(dimensions),
      warnings: getProductImageWarnings(dimensions),
    };
  } catch {
    return {
      file,
      preview,
      isExisting,
      dimensions: null,
      readiness: {
        desktop: false,
        mobile: false,
      },
      warnings: [],
    };
  }
};
