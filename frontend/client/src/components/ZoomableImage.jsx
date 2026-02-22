"use client";

import { useCallback, useEffect, useRef } from "react";

const DEFAULT_MIN_SCALE = 1;
const DEFAULT_MAX_SCALE = 3;
const DOUBLE_TAP_MS = 280;
const TAP_MOVE_TOLERANCE = 14;
const DOUBLE_TAP_DISTANCE = 28;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const getDistance = (a, b) => {
  const dx = Number(a?.x || 0) - Number(b?.x || 0);
  const dy = Number(a?.y || 0) - Number(b?.y || 0);
  return Math.hypot(dx, dy);
};

const getMidpoint = (a, b) => ({
  x: (Number(a?.x || 0) + Number(b?.x || 0)) / 2,
  y: (Number(a?.y || 0) + Number(b?.y || 0)) / 2,
});

const clampTranslation = (metrics, scale, x, y) => {
  if (!metrics) {
    return { x, y };
  }

  const scaledWidth = metrics.baseWidth * scale;
  const scaledHeight = metrics.baseHeight * scale;

  const maxX = Math.max((scaledWidth - metrics.containerWidth) / 2, 0);
  const maxY = Math.max((scaledHeight - metrics.containerHeight) / 2, 0);

  return {
    x: clamp(x, -maxX, maxX),
    y: clamp(y, -maxY, maxY),
  };
};

const isTouchLikePointer = (pointerType) =>
  pointerType === "touch" || pointerType === "pen";

const hasPointerEvents = () =>
  typeof window !== "undefined" && typeof window.PointerEvent !== "undefined";

export default function ZoomableImage({
  src,
  alt = "Zoomable product image",
  className = "",
  minScale = DEFAULT_MIN_SCALE,
  maxScale = DEFAULT_MAX_SCALE,
  onScaleChange,
}) {
  const containerRef = useRef(null);
  const imageRef = useRef(null);
  const frameRef = useRef(null);
  const animateNextFrameRef = useRef(false);
  const metricsRef = useRef(null);
  const reportedScaleRef = useRef(null);

  const transformRef = useRef({
    scale: clamp(minScale, DEFAULT_MIN_SCALE, maxScale),
    x: 0,
    y: 0,
  });

  const pointersRef = useRef(new Map());
  const gestureRef = useRef({
    mode: "idle",
    pan: null,
    pinch: null,
    lastTapAt: 0,
    lastTapX: 0,
    lastTapY: 0,
  });

  const syncCursor = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const { mode } = gestureRef.current;
    const { scale } = transformRef.current;
    if (mode === "pan") {
      container.style.cursor = "grabbing";
      return;
    }
    if (scale > minScale) {
      container.style.cursor = "grab";
      return;
    }
    container.style.cursor = "zoom-in";
  }, [minScale]);

  const publishScale = useCallback(
    (nextScale) => {
      const rounded = Math.round(nextScale * 1000) / 1000;
      if (reportedScaleRef.current === rounded) return;
      reportedScaleRef.current = rounded;
      if (typeof onScaleChange === "function") {
        onScaleChange(rounded);
      }
    },
    [onScaleChange],
  );

  const applyTransform = useCallback(() => {
    frameRef.current = null;
    const image = imageRef.current;
    if (!image) return;

    const current = transformRef.current;
    const safeScale = clamp(Number(current.scale || minScale), minScale, maxScale);
    const clamped = clampTranslation(metricsRef.current, safeScale, current.x, current.y);

    transformRef.current = {
      scale: safeScale,
      x: clamped.x,
      y: clamped.y,
    };

    image.style.transition = animateNextFrameRef.current
      ? "transform 200ms ease"
      : "none";
    image.style.transform = `translate(${clamped.x}px, ${clamped.y}px) scale(${safeScale})`;
    animateNextFrameRef.current = false;

    publishScale(safeScale);
    syncCursor();
  }, [maxScale, minScale, publishScale, syncCursor]);

  const scheduleApply = useCallback(
    (animate = false) => {
      animateNextFrameRef.current = animateNextFrameRef.current || Boolean(animate);
      if (frameRef.current) return;
      frameRef.current = requestAnimationFrame(applyTransform);
    },
    [applyTransform],
  );

  const recalculateMetrics = useCallback(() => {
    const container = containerRef.current;
    const image = imageRef.current;
    if (!container || !image) return;
    if (!image.naturalWidth || !image.naturalHeight) return;

    const containerWidth = Math.max(container.clientWidth, 1);
    const containerHeight = Math.max(container.clientHeight, 1);
    const fitScale = Math.min(
      containerWidth / image.naturalWidth,
      containerHeight / image.naturalHeight,
    );

    metricsRef.current = {
      containerWidth,
      containerHeight,
      baseWidth: image.naturalWidth * fitScale,
      baseHeight: image.naturalHeight * fitScale,
    };

    scheduleApply(false);
  }, [scheduleApply]);

  const resetTransform = useCallback(
    (animate = true) => {
      transformRef.current = { scale: minScale, x: 0, y: 0 };
      gestureRef.current.mode = "idle";
      gestureRef.current.pan = null;
      gestureRef.current.pinch = null;
      scheduleApply(animate);
    },
    [minScale, scheduleApply],
  );

  const setScaleAtPoint = useCallback(
    (targetScale, point, animate = false) => {
      const metrics = metricsRef.current;
      if (!metrics || !point) return;

      const current = transformRef.current;
      const nextScale = clamp(Number(targetScale || current.scale), minScale, maxScale);
      if (!Number.isFinite(nextScale)) return;

      const centerX = metrics.containerWidth / 2;
      const centerY = metrics.containerHeight / 2;
      const anchorX = Number(point.x || 0) - centerX;
      const anchorY = Number(point.y || 0) - centerY;

      if (current.scale <= 0) {
        transformRef.current = { scale: nextScale, x: current.x, y: current.y };
        scheduleApply(animate);
        return;
      }

      const ratio = nextScale / current.scale;
      const nextX = anchorX - (anchorX - current.x) * ratio;
      const nextY = anchorY - (anchorY - current.y) * ratio;

      transformRef.current = {
        scale: nextScale,
        x: nextX,
        y: nextY,
      };
      scheduleApply(animate);
    },
    [maxScale, minScale, scheduleApply],
  );

  const beginPanFromPointer = useCallback((pointer) => {
    gestureRef.current.mode = "pan";
    gestureRef.current.pan = {
      pointerId: pointer.pointerId,
      startX: pointer.x,
      startY: pointer.y,
      startTranslateX: transformRef.current.x,
      startTranslateY: transformRef.current.y,
    };
    syncCursor();
  }, [syncCursor]);

  const beginPinch = useCallback(() => {
    const entries = Array.from(pointersRef.current.values());
    if (entries.length < 2) return;
    const first = entries[0];
    const second = entries[1];
    const midpoint = getMidpoint(first, second);
    const distance = Math.max(getDistance(first, second), 1);

    const metrics = metricsRef.current;
    if (!metrics) return;

    const current = transformRef.current;
    const centerX = metrics.containerWidth / 2;
    const centerY = metrics.containerHeight / 2;
    const imagePointX = (midpoint.x - centerX - current.x) / current.scale;
    const imagePointY = (midpoint.y - centerY - current.y) / current.scale;

    gestureRef.current.mode = "pinch";
    gestureRef.current.pinch = {
      startDistance: distance,
      startScale: current.scale,
      imagePointX,
      imagePointY,
    };
    gestureRef.current.pan = null;
    syncCursor();
  }, [syncCursor]);

  const handlePointerDown = useCallback(
    (event) => {
      if (!hasPointerEvents()) return;
      if (!src) return;

      const container = containerRef.current;
      if (!container) return;

      container.setPointerCapture?.(event.pointerId);

      const pointer = {
        pointerId: event.pointerId,
        pointerType: event.pointerType,
        x: event.clientX,
        y: event.clientY,
        startX: event.clientX,
        startY: event.clientY,
        startedAt: Date.now(),
      };
      pointersRef.current.set(event.pointerId, pointer);

      const pointerCount = pointersRef.current.size;
      if (pointerCount >= 2) {
        beginPinch();
        return;
      }

      if (transformRef.current.scale > minScale) {
        beginPanFromPointer(pointer);
      } else {
        gestureRef.current.mode = "idle";
        gestureRef.current.pan = null;
        syncCursor();
      }
    },
    [beginPanFromPointer, beginPinch, minScale, src, syncCursor],
  );

  const handlePointerMove = useCallback(
    (event) => {
      if (!hasPointerEvents()) return;
      const existing = pointersRef.current.get(event.pointerId);
      if (!existing) return;

      existing.x = event.clientX;
      existing.y = event.clientY;
      pointersRef.current.set(event.pointerId, existing);

      const entries = Array.from(pointersRef.current.values());
      if (entries.length >= 2) {
        if (!gestureRef.current.pinch) {
          beginPinch();
          return;
        }

        const pinch = gestureRef.current.pinch;
        const first = entries[0];
        const second = entries[1];
        const midpoint = getMidpoint(first, second);
        const distance = Math.max(getDistance(first, second), 1);
        const distanceRatio = distance / Math.max(Number(pinch.startDistance || 1), 1);
        const nextScale = clamp(
          Number(pinch.startScale || minScale) * distanceRatio,
          minScale,
          maxScale,
        );

        const metrics = metricsRef.current;
        if (!metrics) return;

        const centerX = metrics.containerWidth / 2;
        const centerY = metrics.containerHeight / 2;
        const nextX = midpoint.x - centerX - pinch.imagePointX * nextScale;
        const nextY = midpoint.y - centerY - pinch.imagePointY * nextScale;

        transformRef.current = {
          scale: nextScale,
          x: nextX,
          y: nextY,
        };
        scheduleApply(false);
        return;
      }

      const pan = gestureRef.current.pan;
      if (!pan || pan.pointerId !== event.pointerId) return;

      const deltaX = event.clientX - pan.startX;
      const deltaY = event.clientY - pan.startY;

      transformRef.current = {
        scale: transformRef.current.scale,
        x: pan.startTranslateX + deltaX,
        y: pan.startTranslateY + deltaY,
      };
      scheduleApply(false);
    },
    [beginPinch, maxScale, minScale, scheduleApply],
  );

  const handlePointerUpOrCancel = useCallback(
    (event) => {
      if (!hasPointerEvents()) return;
      const pointer = pointersRef.current.get(event.pointerId);
      if (!pointer) return;

      pointer.x = event.clientX;
      pointer.y = event.clientY;

      pointersRef.current.delete(event.pointerId);
      const remainingEntries = Array.from(pointersRef.current.values());

      if (remainingEntries.length >= 2) {
        beginPinch();
      } else if (remainingEntries.length === 1 && transformRef.current.scale > minScale) {
        beginPanFromPointer(remainingEntries[0]);
      } else {
        gestureRef.current.mode = "idle";
        gestureRef.current.pan = null;
        gestureRef.current.pinch = null;
        syncCursor();
      }

      if (isTouchLikePointer(pointer.pointerType)) {
        const tapDistance = Math.hypot(pointer.x - pointer.startX, pointer.y - pointer.startY);
        const now = Date.now();
        if (tapDistance <= TAP_MOVE_TOLERANCE) {
          const sinceLastTap = now - gestureRef.current.lastTapAt;
          const betweenTapDistance = Math.hypot(
            pointer.x - gestureRef.current.lastTapX,
            pointer.y - gestureRef.current.lastTapY,
          );

          if (sinceLastTap <= DOUBLE_TAP_MS && betweenTapDistance <= DOUBLE_TAP_DISTANCE) {
            gestureRef.current.lastTapAt = 0;
            resetTransform(true);
            return;
          }

          gestureRef.current.lastTapAt = now;
          gestureRef.current.lastTapX = pointer.x;
          gestureRef.current.lastTapY = pointer.y;
        }
      }
    },
    [beginPanFromPointer, beginPinch, minScale, resetTransform, syncCursor],
  );

  const handleWheel = useCallback(
    (event) => {
      if (!src) return;
      event.preventDefault();

      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();

      const pointer = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };

      const zoomFactor = event.deltaY < 0 ? 1.12 : 0.88;
      setScaleAtPoint(transformRef.current.scale * zoomFactor, pointer, false);
    },
    [setScaleAtPoint, src],
  );

  const handleDoubleClick = useCallback(
    (event) => {
      event.preventDefault();
      resetTransform(true);
    },
    [resetTransform],
  );

  useEffect(() => {
    resetTransform(false);
    pointersRef.current.clear();
    gestureRef.current.mode = "idle";
    gestureRef.current.pan = null;
    gestureRef.current.pinch = null;
    gestureRef.current.lastTapAt = 0;
    syncCursor();
  }, [resetTransform, src, syncCursor]);

  useEffect(() => {
    const image = imageRef.current;
    if (!image) return undefined;

    const onLoad = () => {
      recalculateMetrics();
      resetTransform(false);
    };

    if (image.complete) {
      onLoad();
    } else {
      image.addEventListener("load", onLoad);
    }

    return () => {
      image.removeEventListener("load", onLoad);
    };
  }, [recalculateMetrics, resetTransform, src]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === "undefined") return undefined;

    const observer = new ResizeObserver(() => {
      recalculateMetrics();
    });
    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, [recalculateMetrics]);

  useEffect(
    () => () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
    },
    [],
  );

  return (
    <div
      ref={containerRef}
      className={className}
      onWheel={handleWheel}
      onDoubleClick={handleDoubleClick}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUpOrCancel}
      onPointerCancel={handlePointerUpOrCancel}
      onPointerLeave={handlePointerUpOrCancel}
      style={{
        touchAction: "none",
        userSelect: "none",
        overflow: "hidden",
      }}
    >
      <img
        ref={imageRef}
        src={src}
        alt={alt}
        draggable={false}
        className="max-w-full max-h-full object-contain pointer-events-none"
        style={{
          transform: "translate(0px, 0px) scale(1)",
          transformOrigin: "center center",
          transition: "transform 200ms ease",
          willChange: "transform",
          userSelect: "none",
        }}
      />
    </div>
  );
}
