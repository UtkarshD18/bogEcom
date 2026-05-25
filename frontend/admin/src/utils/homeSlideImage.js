const ASPECT_RATIO_TOLERANCE = 0.1;

export const HOME_SLIDE_DESKTOP_SPEC = {
  label: "Desktop hero",
  width: 1920,
  height: 1080,
};

export const HOME_SLIDE_MOBILE_SPEC = {
  label: "Mobile hero",
  width: 1280,
  height: 720,
};

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

export const getHomeSlideImageWarnings = (dimensions, spec) => {
  if (!dimensions?.width || !dimensions?.height || !spec?.width || !spec?.height) {
    return [];
  }

  const warnings = [];
  const recommendedAspectRatio = spec.width / spec.height;
  const aspectRatioDelta =
    Math.abs(dimensions.aspectRatio - recommendedAspectRatio) /
    recommendedAspectRatio;

  if (dimensions.width < spec.width || dimensions.height < spec.height) {
    warnings.push(
      `${spec.label} images work best at ${spec.width} x ${spec.height} or larger. This upload is ${dimensions.width} x ${dimensions.height}.`,
    );
  }

  if (aspectRatioDelta > ASPECT_RATIO_TOLERANCE) {
    warnings.push(
      `${spec.label} aspect ratio should be close to ${formatAspectRatio(recommendedAspectRatio)}. This upload is ${formatAspectRatio(dimensions.aspectRatio)}, so it may look stretched in the banner or need a separate optimized image.`,
    );
  }

  return warnings;
};

export const buildHomeSlideImageAsset = async ({
  file = null,
  src = "",
  isExisting = false,
  spec,
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
      warnings: getHomeSlideImageWarnings(dimensions, spec),
    };
  } catch {
    return {
      file,
      preview,
      isExisting,
      dimensions: null,
      warnings: [],
    };
  }
};
