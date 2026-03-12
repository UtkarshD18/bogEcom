import { useCallback, useEffect, useRef } from "react";

const clamp = (value, min) => (Number.isFinite(value) && value > min ? value : min);

export const useLiveRefresh = (
  refreshFn,
  {
    minIntervalMs = 1000,
    fallbackIntervalMs = 30000,
  } = {},
) => {
  const refreshRef = useRef(refreshFn);
  const lastRunRef = useRef(0);
  const timeoutRef = useRef(null);

  useEffect(() => {
    refreshRef.current = refreshFn;
  }, [refreshFn]);

  const clearPending = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const trigger = useCallback(
    (force = false) => {
      const now = Date.now();
      const minInterval = clamp(Number(minIntervalMs), 250);
      const elapsed = now - lastRunRef.current;

      if (force || elapsed >= minInterval) {
        lastRunRef.current = now;
        refreshRef.current?.();
        return;
      }

      if (!timeoutRef.current) {
        timeoutRef.current = setTimeout(() => {
          timeoutRef.current = null;
          lastRunRef.current = Date.now();
          refreshRef.current?.();
        }, Math.max(minInterval - elapsed, 0));
      }
    },
    [minIntervalMs],
  );

  useEffect(() => {
    const fallbackInterval = Number(fallbackIntervalMs);
    if (!Number.isFinite(fallbackInterval) || fallbackInterval <= 0) {
      return undefined;
    }

    const intervalId = setInterval(() => trigger(true), fallbackInterval);
    return () => clearInterval(intervalId);
  }, [fallbackIntervalMs, trigger]);

  useEffect(() => clearPending, [clearPending]);

  return { trigger, clearPending };
};

export default useLiveRefresh;
