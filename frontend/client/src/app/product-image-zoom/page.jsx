"use client";

import ZoomableImage from "@/components/ZoomableImage";
import { fetchDataFromApi } from "@/utils/api";
import { getImageUrl } from "@/utils/imageUtils";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { FiChevronLeft, FiChevronRight, FiX } from "react-icons/fi";

const clampIndex = (index, length) => {
  if (!Number.isFinite(index)) return 0;
  if (length <= 0) return 0;
  return Math.max(0, Math.min(index, length - 1));
};

const parseEmbeddedImages = (value) => {
  if (!value) return [];
  try {
    const parsed = JSON.parse(decodeURIComponent(value));
    if (!Array.isArray(parsed)) return [];
    return parsed.map((image) => getImageUrl(image)).filter(Boolean);
  } catch {
    return [];
  }
};

function ProductImageZoomContent() {
  const searchParams = useSearchParams();
  const productId = String(searchParams.get("productId") || "").trim();
  const requestedIndex = Math.max(Number(searchParams.get("index") || 0), 0);
  const embeddedImagesParam = searchParams.get("images") || "";

  const [images, setImages] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [zoomScale, setZoomScale] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const embeddedImages = useMemo(
    () => parseEmbeddedImages(embeddedImagesParam),
    [embeddedImagesParam],
  );

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "auto";
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadImages = async () => {
      if (embeddedImages.length > 0) {
        if (!cancelled) {
          setImages(embeddedImages);
          setActiveIndex(clampIndex(requestedIndex, embeddedImages.length));
          setLoading(false);
          setError("");
        }
        return;
      }

      if (!productId) {
        if (!cancelled) {
          setImages([]);
          setLoading(false);
          setError("Missing product id");
        }
        return;
      }

      setLoading(true);
      setError("");
      try {
        const response = await fetchDataFromApi(`/api/products/${productId}`);
        const product = response?.data || response?.product || null;
        const rawImages = Array.isArray(product?.images)
          ? product.images
          : product?.image
            ? [product.image]
            : [];
        const normalizedImages = rawImages
          .map((image) => getImageUrl(image))
          .filter(Boolean);

        if (!cancelled) {
          setImages(normalizedImages);
          setActiveIndex(clampIndex(requestedIndex, normalizedImages.length));
        }
      } catch {
        if (!cancelled) {
          setImages([]);
          setError("Failed to load product images");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadImages();
    return () => {
      cancelled = true;
    };
  }, [embeddedImages, productId, requestedIndex]);

  useEffect(() => {
    setZoomScale(1);
  }, [activeIndex]);

  const activeImage = images[clampIndex(activeIndex, images.length)] || "";
  const canGoPrev = activeIndex > 0;
  const canGoNext = activeIndex < images.length - 1;
  const closeHref = productId ? `/product/${productId}` : "/products";

  return (
    <section className="fixed inset-0 z-[200] bg-black text-white">
      <div className="absolute top-4 left-4 z-10 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold backdrop-blur">
        {images.length > 0 ? `${activeIndex + 1} / ${images.length}` : "Image Viewer"}
      </div>

      <div className="absolute top-4 left-1/2 z-10 -translate-x-1/2 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold backdrop-blur">
        {(zoomScale * 100).toFixed(0)}%
      </div>

      <Link
        href={closeHref}
        className="absolute top-4 right-4 z-10 inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
        aria-label="Close full screen image"
      >
        <FiX size={22} />
      </Link>

      {canGoPrev && (
        <button
          type="button"
          onClick={() => setActiveIndex((prev) => Math.max(prev - 1, 0))}
          className="absolute left-4 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white hover:bg-white/20"
          aria-label="Previous image"
        >
          <FiChevronLeft size={24} />
        </button>
      )}

      {canGoNext && (
        <button
          type="button"
          onClick={() => setActiveIndex((prev) => Math.min(prev + 1, images.length - 1))}
          className="absolute right-4 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white hover:bg-white/20"
          aria-label="Next image"
        >
          <FiChevronRight size={24} />
        </button>
      )}

      <div className="absolute inset-0 flex items-center justify-center px-6 py-20">
        {loading ? (
          <p className="text-sm text-white/70">Loading image...</p>
        ) : error ? (
          <div className="text-center">
            <p className="text-sm text-red-300">{error}</p>
            <Link
              href={closeHref}
              className="mt-4 inline-flex rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/20"
            >
              Back
            </Link>
          </div>
        ) : activeImage ? (
          <ZoomableImage
            key={`${activeImage}-${activeIndex}`}
            src={activeImage}
            alt={`Product image ${activeIndex + 1}`}
            minScale={1}
            maxScale={3}
            onScaleChange={setZoomScale}
            className="h-full w-full flex items-center justify-center"
          />
        ) : (
          <p className="text-sm text-white/70">No images available.</p>
        )}
      </div>

      {images.length > 1 && (
        <div className="absolute bottom-4 left-1/2 z-10 w-[min(92vw,820px)] -translate-x-1/2 overflow-x-auto rounded-2xl bg-white/10 p-3 backdrop-blur">
          <div className="flex gap-3">
            {images.map((image, index) => {
              const isActive = index === activeIndex;
              return (
                <button
                  key={`${image}-${index}`}
                  type="button"
                  onClick={() => setActiveIndex(index)}
                  className={`shrink-0 overflow-hidden rounded-xl border transition-all ${
                    isActive
                      ? "border-white ring-2 ring-white/60"
                      : "border-white/30 hover:border-white/60"
                  }`}
                  aria-label={`View image ${index + 1}`}
                >
                  <img
                    src={image}
                    alt={`Thumbnail ${index + 1}`}
                    className="h-16 w-16 object-contain bg-black/50"
                  />
                </button>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}

const ZoomLoadingFallback = () => (
  <section className="fixed inset-0 z-[200] bg-black text-white flex items-center justify-center">
    <p className="text-sm text-white/70">Loading image...</p>
  </section>
);

export default function ProductImageZoomPage() {
  return (
    <Suspense fallback={<ZoomLoadingFallback />}>
      <ProductImageZoomContent />
    </Suspense>
  );
}
