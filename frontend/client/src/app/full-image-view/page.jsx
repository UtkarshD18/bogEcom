"use client";

import { fetchDataFromApi } from "@/utils/api";
import { getImageUrl } from "@/utils/imageUtils";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { FiChevronLeft, FiChevronRight, FiMinus, FiPlus, FiX } from "react-icons/fi";

const clampZoom = (value) => Math.min(Math.max(Number(value || 1), 0.5), 5);

function FullImageViewContent() {
  const searchParams = useSearchParams();
  const productId = String(searchParams.get("productId") || "").trim();
  const requestedIndex = Math.max(Number(searchParams.get("index") || 0), 0);

  const [images, setImages] = useState([]);
  const [activeIndex, setActiveIndex] = useState(requestedIndex);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const dragAnchorRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    setActiveIndex(requestedIndex);
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setIsDragging(false);
  }, [requestedIndex]);

  useEffect(() => {
    if (zoom <= 1) {
      setPan({ x: 0, y: 0 });
      setIsDragging(false);
    }
  }, [zoom]);

  useEffect(() => {
    let cancelled = false;

    const loadProductImages = async () => {
      if (!productId) {
        setImages([]);
        setError("Missing product id");
        setLoading(false);
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
          setActiveIndex((prev) =>
            Math.min(prev, Math.max(normalizedImages.length - 1, 0)),
          );
        }
      } catch (_error) {
        if (!cancelled) {
          setError("Failed to load product images");
          setImages([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadProductImages();
    return () => {
      cancelled = true;
    };
  }, [productId]);

  const activeImage = useMemo(() => {
    if (!images.length) return "";
    return images[Math.min(activeIndex, images.length - 1)] || images[0];
  }, [images, activeIndex]);

  const showPrev = activeIndex > 0;
  const showNext = activeIndex < images.length - 1;

  const goPrev = () => {
    if (!showPrev) return;
    setActiveIndex((prev) => Math.max(prev - 1, 0));
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setIsDragging(false);
  };

  const goNext = () => {
    if (!showNext) return;
    setActiveIndex((prev) => Math.min(prev + 1, images.length - 1));
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setIsDragging(false);
  };

  const zoomIn = () => setZoom((prev) => clampZoom(prev + 0.25));
  const zoomOut = () => setZoom((prev) => clampZoom(prev - 0.25));
  const canPan = zoom > 1;

  const handleWheelZoom = (event) => {
    if (!activeImage) return;
    event.preventDefault();
    event.stopPropagation();
    const delta = event.deltaY < 0 ? 0.2 : -0.2;
    setZoom((prev) => clampZoom(prev + delta));
  };

  const handleMouseDown = (event) => {
    if (!canPan) return;
    event.preventDefault();
    setIsDragging(true);
    dragAnchorRef.current = { x: event.clientX, y: event.clientY };
  };

  const handleMouseMove = (event) => {
    if (!isDragging || !canPan) return;
    const prevPoint = dragAnchorRef.current;
    const dx = event.clientX - prevPoint.x;
    const dy = event.clientY - prevPoint.y;
    dragAnchorRef.current = { x: event.clientX, y: event.clientY };
    setPan((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
  };

  const stopDragging = () => {
    if (isDragging) {
      setIsDragging(false);
    }
  };

  return (
    <section className="min-h-screen bg-[#f4f4f5] p-4 sm:p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-base sm:text-lg font-bold text-gray-800">
            Full Image View
          </h1>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={zoomOut}
              className="h-9 w-9 rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
              aria-label="Zoom out"
            >
              <FiMinus className="mx-auto" />
            </button>
            <span className="min-w-14 text-center text-sm font-semibold text-gray-700">
              {(zoom * 100).toFixed(0)}%
            </span>
            <button
              type="button"
              onClick={zoomIn}
              className="h-9 w-9 rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
              aria-label="Zoom in"
            >
              <FiPlus className="mx-auto" />
            </button>
            <Link
              href={productId ? `/product/${productId}` : "/products"}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
              aria-label="Close"
            >
              <FiX />
            </Link>
          </div>
        </div>

        <div className="relative min-h-[65vh] rounded-2xl border border-gray-200 bg-white p-4 sm:p-6">
          {loading ? (
            <div className="flex min-h-[55vh] items-center justify-center text-gray-500">
              Loading image...
            </div>
          ) : error ? (
            <div className="flex min-h-[55vh] flex-col items-center justify-center gap-3 text-center">
              <p className="text-gray-700 font-semibold">{error}</p>
              <Link
                href={productId ? `/product/${productId}` : "/products"}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white"
              >
                Go Back
              </Link>
            </div>
          ) : (
            <div
              className="flex min-h-[55vh] items-center justify-center overflow-hidden select-none"
              onWheel={handleWheelZoom}
              onWheelCapture={handleWheelZoom}
              onMouseMove={handleMouseMove}
              onMouseUp={stopDragging}
              onMouseLeave={stopDragging}
              style={{ touchAction: "none" }}
            >
              {showPrev && (
                <button
                  type="button"
                  onClick={goPrev}
                  className="absolute left-3 sm:left-5 top-1/2 -translate-y-1/2 rounded-lg border border-gray-200 bg-white p-2 text-gray-700 shadow-sm hover:bg-gray-50"
                  aria-label="Previous image"
                >
                  <FiChevronLeft />
                </button>
              )}

              {activeImage ? (
                <img
                  src={activeImage}
                  alt={`Product image ${activeIndex + 1}`}
                  className={`max-h-[70vh] w-auto object-contain transition-transform duration-200 ${
                    canPan ? (isDragging ? "cursor-grabbing" : "cursor-grab") : "cursor-zoom-in"
                  }`}
                  style={{
                    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                    transformOrigin: "center center",
                    willChange: "transform",
                  }}
                  onMouseDown={handleMouseDown}
                  onDragStart={(event) => event.preventDefault()}
                />
              ) : (
                <p className="text-gray-500">No images found.</p>
              )}

              {showNext && (
                <button
                  type="button"
                  onClick={goNext}
                  className="absolute right-3 sm:right-5 top-1/2 -translate-y-1/2 rounded-lg border border-gray-200 bg-white p-2 text-gray-700 shadow-sm hover:bg-gray-50"
                  aria-label="Next image"
                >
                  <FiChevronRight />
                </button>
              )}
            </div>
          )}
        </div>

        {images.length > 1 && (
          <div className="mt-4 grid grid-cols-4 sm:grid-cols-8 gap-2">
            {images.map((image, index) => {
              const selected = index === activeIndex;
              return (
                <button
                  key={`${image}-${index}`}
                  type="button"
                  onClick={() => {
                    setActiveIndex(index);
                    setZoom(1);
                    setPan({ x: 0, y: 0 });
                    setIsDragging(false);
                  }}
                  className={`overflow-hidden rounded-lg border p-1 ${selected ? "border-primary" : "border-gray-200"}`}
                  aria-label={`View image ${index + 1}`}
                >
                  <img
                    src={image}
                    alt={`Thumbnail ${index + 1}`}
                    className="h-16 w-full object-contain"
                  />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

const LoadingFallback = () => (
  <section className="min-h-screen bg-[#f4f4f5] p-4 sm:p-6">
    <div className="mx-auto max-w-7xl">
      <div className="min-h-[70vh] rounded-2xl border border-gray-200 bg-white p-6 flex items-center justify-center text-gray-500">
        Loading image...
      </div>
    </div>
  </section>
);

export default function FullImageViewPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <FullImageViewContent />
    </Suspense>
  );
}
