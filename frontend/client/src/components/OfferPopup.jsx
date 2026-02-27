"use client";

import { API_BASE_URL } from "@/utils/api";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MdClose, MdFlashOn, MdNorthEast } from "react-icons/md";
import styles from "./OfferPopup.module.css";

const API_URL = String(API_BASE_URL || "")
  .trim()
  .replace(/\/+$/, "")
  .replace(/\/api$/i, "");

const buildApiUrlCandidates = (path) => {
  const normalizedPath = String(path || "").startsWith("/")
    ? String(path || "")
    : `/${String(path || "")}`;
  const apiPath = normalizedPath.startsWith("/api/")
    ? normalizedPath
    : `/api${normalizedPath}`;

  const candidates = [];
  if (API_URL) {
    candidates.push(`${API_URL}${apiPath}`);
  }
  candidates.push(apiPath);
  return [...new Set(candidates)];
};

const normalizePath = (value) => {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("/")) return trimmed;
  return `/${trimmed}`;
};

const getTextColorFromHex = (backgroundColor) => {
  const fallback = "#1f2937";
  const color = String(backgroundColor || "").trim().replace("#", "");
  if (!/^[0-9a-fA-F]{3}$|^[0-9a-fA-F]{6}$/.test(color)) {
    return fallback;
  }

  const normalized =
    color.length === 3
      ? color
          .split("")
          .map((char) => char + char)
          .join("")
      : color;

  const red = parseInt(normalized.slice(0, 2), 16);
  const green = parseInt(normalized.slice(2, 4), 16);
  const blue = parseInt(normalized.slice(4, 6), 16);

  const brightness = (red * 299 + green * 587 + blue * 114) / 1000;
  return brightness > 145 ? "#1f2937" : "#f9fafb";
};

const fetchActivePopup = async () => {
  const candidates = buildApiUrlCandidates("/popup/active");
  let lastError = null;

  for (const url of candidates) {
    try {
      const response = await fetch(url, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.message || `Failed (${response.status})`);
      }

      if (payload?.success) {
        return payload?.data || null;
      }

      throw new Error(payload?.message || "Invalid popup response");
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError) {
    throw lastError;
  }

  return null;
};

const OfferPopup = () => {
  const router = useRouter();
  const hasInitialized = useRef(false);
  const [popup, setPopup] = useState(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    const loadPopup = async () => {
      try {
        const activePopup = await fetchActivePopup();
        if (!activePopup?.id) return;

        const sessionKey = `popup_${activePopup.id}_shown`;
        const alreadyShown = sessionStorage.getItem(sessionKey) === "true";

        if (activePopup.showOncePerSession && alreadyShown) {
          return;
        }

        setPopup(activePopup);
        requestAnimationFrame(() => {
          setIsVisible(true);
        });
      } catch (error) {
        // Popup failures should never block storefront rendering.
        console.warn("[Popup] Failed to load active popup", error);
      }
    };

    loadPopup();
  }, []);

  const markAsShown = useCallback(() => {
    if (!popup?.id) return;
    sessionStorage.setItem(`popup_${popup.id}_shown`, "true");
  }, [popup?.id]);

  const closePopup = useCallback(() => {
    if (popup?.showOncePerSession) {
      markAsShown();
    }

    setIsVisible(false);
    window.setTimeout(() => {
      setPopup(null);
    }, 180);
  }, [markAsShown, popup?.showOncePerSession]);

  const handleRedirect = useCallback(() => {
    if (!popup) return;

    if (popup?.showOncePerSession) {
      markAsShown();
    }

    const redirectValue = String(popup.redirectValue || "").trim();

    if (popup.redirectType === "product" && redirectValue) {
      router.push(`/product/${encodeURIComponent(redirectValue)}`);
      setIsVisible(false);
      window.setTimeout(() => setPopup(null), 180);
      return;
    }

    if (popup.redirectType === "category" && redirectValue) {
      router.push(`/category/${encodeURIComponent(redirectValue)}`);
      setIsVisible(false);
      window.setTimeout(() => setPopup(null), 180);
      return;
    }

    if (popup.redirectType === "custom" && redirectValue) {
      if (/^https?:\/\//i.test(redirectValue)) {
        window.location.href = redirectValue;
      } else {
        router.push(normalizePath(redirectValue));
      }
      setIsVisible(false);
      window.setTimeout(() => setPopup(null), 180);
      return;
    }

    closePopup();
  }, [closePopup, markAsShown, popup, router]);

  const canRedirect = useMemo(() => {
    const redirectValue = String(popup?.redirectValue || "").trim();
    if (!popup?.redirectType) return false;
    if (popup.redirectType === "custom") {
      return Boolean(redirectValue);
    }
    if (popup.redirectType === "product" || popup.redirectType === "category") {
      return Boolean(redirectValue);
    }
    return false;
  }, [popup?.redirectType, popup?.redirectValue]);

  const handleCardClick = useCallback(() => {
    if (!canRedirect) return;
    handleRedirect();
  }, [canRedirect, handleRedirect]);

  const handleCardKeyDown = useCallback(
    (event) => {
      if (!canRedirect) return;
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        handleRedirect();
      }
    },
    [canRedirect, handleRedirect],
  );

  const textColor = useMemo(
    () => getTextColorFromHex(popup?.backgroundColor),
    [popup?.backgroundColor],
  );

  const urgencyLabel =
    popup?.redirectType === "product" ? "Limited Stock" : "Limited Time";

  if (!popup) return null;

  return (
    <>
      <div
        className={`${styles.backdrop} ${isVisible ? styles.visible : ""}`}
        onClick={closePopup}
        aria-hidden="true"
      />
      <div
        className={`${styles.wrapper} ${isVisible ? styles.visible : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="site-offer-popup-title"
      >
        <section
          className={`${styles.card} ${canRedirect ? styles.cardClickable : ""}`}
          style={{
            backgroundColor: popup.backgroundColor || "#fff7ed",
            color: textColor,
          }}
          onClick={handleCardClick}
          onKeyDown={handleCardKeyDown}
          tabIndex={canRedirect ? 0 : -1}
          aria-label={canRedirect ? "Open popup offer target page" : undefined}
        >
          <button
            type="button"
            className={styles.closeButton}
            onClick={(event) => {
              event.stopPropagation();
              closePopup();
            }}
            aria-label="Close popup"
          >
            <MdClose size={20} />
          </button>

          <div className={styles.media}>
            {popup.imageUrl ? (
              <img
                src={popup.imageUrl}
                alt={popup.title || "Promotional popup image"}
                loading="lazy"
              />
            ) : (
              <div className={styles.mediaFallback} aria-hidden="true" />
            )}
            <div className={styles.heroBadge}>
              <MdFlashOn size={16} />
              <span>{urgencyLabel}</span>
            </div>
            <div className={styles.heroHint}>Tap to open offer</div>
          </div>

          <div className={styles.content}>
            <h2 id="site-offer-popup-title" className={styles.title}>
              {popup.title}
            </h2>
            <p className={styles.description}>{popup.description}</p>
            <div className={styles.metaRow}>
              <span className={styles.metaPill}>{urgencyLabel}</span>
              {canRedirect ? (
                <span className={styles.metaAction}>Instant Redirect</span>
              ) : null}
            </div>
            <button
              type="button"
              className={styles.ctaButton}
              onClick={(event) => {
                event.stopPropagation();
                handleRedirect();
              }}
            >
              {popup.buttonText || "Shop Now"}
              <MdNorthEast size={18} />
            </button>
          </div>
        </section>
      </div>
    </>
  );
};

export default OfferPopup;
