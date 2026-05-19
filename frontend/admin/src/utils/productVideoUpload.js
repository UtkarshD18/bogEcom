export const PRODUCT_VIDEO_MAX_FILES = 3;
export const PRODUCT_VIDEO_MAX_SIZE_BYTES = 100 * 1024 * 1024;
export const PRODUCT_VIDEO_ACCEPT =
  ".mp4,.webm,video/mp4,video/webm";

const PRODUCT_VIDEO_ALLOWED_TYPES = new Set(["video/mp4", "video/webm"]);

export const buildProductVideoAsset = (file) => {
  if (!file) return null;

  const fileType = String(file.type || "").toLowerCase();
  const fileName = String(file.name || "Product video");
  const lowerName = fileName.toLowerCase();
  const hasSupportedExtension =
    lowerName.endsWith(".mp4") || lowerName.endsWith(".webm");

  if (!PRODUCT_VIDEO_ALLOWED_TYPES.has(fileType) && !hasSupportedExtension) {
    throw new Error(`${fileName}: only MP4 and WebM videos are supported`);
  }

  if (file.size > PRODUCT_VIDEO_MAX_SIZE_BYTES) {
    throw new Error(`${fileName}: video size should be less than 100MB`);
  }

  return {
    file,
    preview: URL.createObjectURL(file),
    name: fileName,
    size: file.size,
  };
};

export const formatProductVideoSize = (bytes = 0) => {
  const size = Number(bytes || 0);
  if (!Number.isFinite(size) || size <= 0) return "0 MB";
  return `${(size / (1024 * 1024)).toFixed(size >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
};
