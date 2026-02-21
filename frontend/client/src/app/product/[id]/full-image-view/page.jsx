"use client";

import { fetchDataFromApi } from "@/utils/api";
import { getImageUrl } from "@/utils/imageUtils";
import { CircularProgress } from "@mui/material";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { IoChevronBack, IoChevronForward, IoClose } from "react-icons/io5";

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;

const clampZoom = (value) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, value));

const getTouchDistance = (touches) => {
  if (!touches || touches.length < 2) return 0;
  const [first, second] = touches;
  return Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY);
};

const FullImageViewPage = () => {
  const { id } = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const viewportRef = useRef(null);
  const pinchStartRef = useRef({ distance: 0, zoom: 1 });

  const [loading, setLoading] = useState(true);
  const [productName, setProductName] = useState("Product");
  const [images, setImages] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [dragState, setDragState] = useState(null);

  const normalizedImages = useMemo(
    () => (images || []).map((img) => getImageUrl(img)),
    [images],
  );

  const totalImages = normalizedImages.length;

  const clampPan = useCallback((next, zoom = zoomLevel) => {
    if (zoom <= 1) return { x: 0, y: 0 };
    const viewport = viewportRef.current?.getBoundingClientRect();
    if (!viewport) return next;

    const maxX = ((zoom - 1) * viewport.width) / 2;
    const maxY = ((zoom - 1) * viewport.height) / 2;

    return {
      x: Math.max(-maxX, Math.min(maxX, next.x)),
      y: Math.max(-maxY, Math.min(maxY, next.y)),
    };
  }, [zoomLevel]);

  const resetView = useCallback(() => {
    setZoomLevel(1);
    setPanOffset({ x: 0, y: 0 });
    setDragState(null);
  }, []);

  const applyZoom = useCallback((nextZoom) => {
    const clamped = clampZoom(nextZoom);
    setZoomLevel(clamped);
    setPanOffset((previous) =>
      clamped <= 1 ? { x: 0, y: 0 } : clampPan(previous, clamped),
    );
  }, [clampPan]);

  const closeViewer = useCallback(() => {
    if (window.history.length > 1) {
      router.back();
      return;
    }
    router.replace(`/product/${id}`);
  }, [id, router]);

  const changeSlide = useCallback((direction) => {
    if (totalImages <= 1) return;
    setActiveIndex((previous) => {
      const next = (previous + direction + totalImages) % totalImages;
      return next;
    });
    resetView();
  }, [resetView, totalImages]);

  const goToIndex = useCallback((index) => {
    if (totalImages <= 0) return;
    const normalizedIndex = Math.max(0, Math.min(totalImages - 1, index));
    setActiveIndex(normalizedIndex);
    resetView();
  }, [resetView, totalImages]);

  const handlePointerDown = (event) => {
    if (zoomLevel <= 1) return;
    event.preventDefault();
    setDragState({
      pointerId: event.pointerId,
      offsetX: event.clientX - panOffset.x,
      offsetY: event.clientY - panOffset.y,
    });
    viewportRef.current?.setPointerCapture?.(event.pointerId);
  };

  const handlePointerMove = (event) => {
    if (!dragState || dragState.pointerId !== event.pointerId || zoomLevel <= 1) return;
    event.preventDefault();
    const next = {
      x: event.clientX - dragState.offsetX,
      y: event.clientY - dragState.offsetY,
    };
    setPanOffset(clampPan(next, zoomLevel));
  };

  const handlePointerEnd = (event) => {
    if (!dragState || dragState.pointerId !== event.pointerId) return;
    setDragState(null);
  };

  const handleWheelZoom = (event) => {
    event.preventDefault();
    applyZoom(zoomLevel + (event.deltaY < 0 ? 0.2 : -0.2));
  };

  const handleTouchStart = (event) => {
    if (event.touches.length !== 2) return;
    pinchStartRef.current = {
      distance: getTouchDistance(event.touches),
      zoom: zoomLevel,
    };
  };

  const handleTouchMove = (event) => {
    if (event.touches.length !== 2) return;
    event.preventDefault();
    const currentDistance = getTouchDistance(event.touches);
    const baseDistance = pinchStartRef.current.distance || 0;
    if (!baseDistance) return;
    const scaleFactor = currentDistance / baseDistance;
    applyZoom(pinchStartRef.current.zoom * scaleFactor);
  };

  const handleTouchEnd = () => {
    if (zoomLevel <= 1) {
      setPanOffset({ x: 0, y: 0 });
    }
    pinchStartRef.current = { distance: 0, zoom: zoomLevel };
  };

  useEffect(() => {
    if (!id) return;

    const loadProduct = async () => {
      try {
        setLoading(true);
        const response = await fetchDataFromApi(`/api/products/${id}`);
        const data = response?.data || response;
        const nextImages = Array.isArray(data?.images) && data.images.length > 0
          ? data.images
          : data?.image
            ? [data.image]
            : [];

        setProductName(data?.name || data?.title || "Product");
        setImages(nextImages);
      } finally {
        setLoading(false);
      }
    };

    loadProduct();
  }, [id]);

  useEffect(() => {
    const queryIndex = Number(searchParams.get("index"));
    if (!Number.isFinite(queryIndex)) return;
    goToIndex(queryIndex);
  }, [goToIndex, searchParams]);

  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousHtmlOverscroll = document.documentElement.style.overscrollBehavior;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    document.documentElement.style.overscrollBehavior = "none";
    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.documentElement.style.overscrollBehavior = previousHtmlOverscroll;
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        closeViewer();
      } else if (event.key === "ArrowRight") {
        changeSlide(1);
      } else if (event.key === "ArrowLeft") {
        changeSlide(-1);
      } else if (event.key === "+" || event.key === "=") {
        applyZoom(zoomLevel + 0.2);
      } else if (event.key === "-") {
        applyZoom(zoomLevel - 0.2);
      } else if (event.key === "0") {
        resetView();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [applyZoom, changeSlide, closeViewer, resetView, zoomLevel]);

  if (loading) {
    return (
      <div className="fixed inset-0 z-[180] bg-black flex items-center justify-center">
        <CircularProgress sx={{ color: "#fff" }} />
      </div>
    );
  }

  if (totalImages === 0) {
    return (
      <div className="fixed inset-0 z-[180] bg-black text-white flex flex-col items-center justify-center gap-4 px-4">
        <p className="text-lg font-semibold">No image available</p>
        <button
          type="button"
          onClick={closeViewer}
          className="rounded-full border border-white/40 px-5 py-2 text-sm font-semibold hover:bg-white/10"
        >
          Close
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[180] bg-black text-white">
      <button
        type="button"
        onClick={closeViewer}
        className="absolute left-4 top-4 z-30 rounded-full border border-white/30 bg-black/55 p-2.5 hover:bg-black/70"
        aria-label="Close full image view"
      >
        <IoClose size={22} />
      </button>

      <div className="pointer-events-none absolute left-16 top-5 z-30 text-sm font-semibold uppercase tracking-wider text-white/85">
        Full Image View
      </div>

      <div className="absolute right-4 top-4 z-30 flex items-center gap-2">
        <button
          type="button"
          className="rounded-full border border-white/30 bg-black/55 px-3 py-1.5 text-sm hover:bg-black/70"
          onClick={() => applyZoom(zoomLevel - 0.2)}
          aria-label="Zoom out"
        >
          -
        </button>
        <button
          type="button"
          className="rounded-full border border-white/30 bg-black/55 px-3 py-1.5 text-sm hover:bg-black/70"
          onClick={resetView}
          aria-label="Reset zoom"
        >
          {Math.round(zoomLevel * 100)}%
        </button>
        <button
          type="button"
          className="rounded-full border border-white/30 bg-black/55 px-3 py-1.5 text-sm hover:bg-black/70"
          onClick={() => applyZoom(zoomLevel + 0.2)}
          aria-label="Zoom in"
        >
          +
        </button>
      </div>

      {totalImages > 1 && (
        <>
          <button
            type="button"
            onClick={() => changeSlide(-1)}
            className="absolute left-4 top-1/2 z-30 -translate-y-1/2 rounded-full border border-white/30 bg-black/55 p-2 hover:bg-black/70"
            aria-label="Previous image"
          >
            <IoChevronBack size={22} />
          </button>
          <button
            type="button"
            onClick={() => changeSlide(1)}
            className="absolute right-4 top-1/2 z-30 -translate-y-1/2 rounded-full border border-white/30 bg-black/55 p-2 hover:bg-black/70"
            aria-label="Next image"
          >
            <IoChevronForward size={22} />
          </button>
        </>
      )}

      <div className="absolute bottom-5 left-1/2 z-30 -translate-x-1/2 rounded-full border border-white/25 bg-black/55 px-4 py-1.5 text-sm">
        {productName} • {activeIndex + 1}/{totalImages}
      </div>

      <div
        ref={viewportRef}
        className="h-full w-full overflow-hidden touch-none select-none"
        style={{ touchAction: "none" }}
        onWheel={handleWheelZoom}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
      >
        <div className="flex h-full w-full items-center justify-center p-6 sm:p-12">
          <img
            src={normalizedImages[activeIndex]}
            alt={`${productName} image ${activeIndex + 1}`}
            className={`max-h-full max-w-full object-contain ${zoomLevel > 1 ? "cursor-grab" : "cursor-zoom-in"}`}
            style={{
              transform: `translate3d(${panOffset.x}px, ${panOffset.y}px, 0) scale(${zoomLevel})`,
              transition: dragState ? "none" : "transform 140ms ease",
              transformOrigin: "center center",
            }}
            draggable={false}
          />
        </div>
      </div>
    </div>
  );
};

export default FullImageViewPage;
