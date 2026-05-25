import { headers } from "next/headers";
import HomeSlider from "@/components/HomeSlider";
import Banners from "@/components/Banners";
import CatSlider from "@/components/CatSlider";
import HomeComboDeals from "@/components/HomeComboDeals";
import dynamic from "next/dynamic";

const OfferCountdownStrip = dynamic(
  () => import("@/components/OfferCountdownStrip"),
  {
    loading: () => null,
  },
);
// PopularProducts removed from homepage per layout change; replaced by CatSlider
const MembershipCTA = dynamic(() => import("@/components/MembershipCTA"), {
  loading: () => null,
});

const sanitizeBaseUrl = (value) =>
  String(value || "")
    .trim()
    .replace(/^['"]|['"]$/g, "")
    .replace(/\/+$/, "");

const API_BASE_URL = sanitizeBaseUrl(
  process.env.NEXT_PUBLIC_APP_API_URL || process.env.NEXT_PUBLIC_API_URL,
);
const LOCAL_DEV_API_BASE_URL = sanitizeBaseUrl(
  process.env.NEXT_PUBLIC_LOCAL_API_URL || "http://127.0.0.1:8001",
);
const HOMEPAGE_FETCH_TIMEOUT_MS = Math.max(
  Number.parseInt(
    String(process.env.NEXT_PUBLIC_HOMEPAGE_FETCH_TIMEOUT_MS || "12000"),
    10,
  ) || 12000,
  500,
);

const fetchWithTimeout = async (url, timeoutMs) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      signal: controller.signal,
      next: { revalidate: 60 },
    });
  } finally {
    clearTimeout(timeoutId);
  }
};

const sanitizeOrigin = (value) => {
  const normalized = sanitizeBaseUrl(value);
  if (!/^https?:\/\//i.test(normalized)) {
    return "";
  }
  return normalized;
};

const getRequestOrigin = async () => {
  try {
    const headerStore = await headers();
    const host = String(
      headerStore.get("x-forwarded-host") || headerStore.get("host") || "",
    ).trim();
    if (!host) return "";

    const proto = String(
      headerStore.get("x-forwarded-proto") ||
        (process.env.NODE_ENV === "production" ? "https" : "http"),
    ).trim();

    return sanitizeOrigin(`${proto}://${host}`);
  } catch {
    return "";
  }
};

const getHomepageBaseCandidates = (requestOrigin = "") => {
  if (process.env.NODE_ENV === "production") {
    return [requestOrigin, API_BASE_URL].filter(
      (candidate, index, arr) =>
        candidate && arr.indexOf(candidate) === index,
    );
  }

  const candidates = [requestOrigin, LOCAL_DEV_API_BASE_URL, API_BASE_URL].filter(
    (candidate, index, arr) => candidate && arr.indexOf(candidate) === index,
  );

  return candidates;
};

const getHomepagePayload = async (path, requestOrigin = "") => {
  const baseCandidates = getHomepageBaseCandidates(requestOrigin);
  if (!baseCandidates.length) {
    return null;
  }

  for (const base of baseCandidates) {
    try {
      const response = await fetchWithTimeout(
        `${base}${path}`,
        HOMEPAGE_FETCH_TIMEOUT_MS,
      );

      if (!response || !response.ok) {
        continue;
      }

      const payload = await response.json();
      if (payload && typeof payload === "object") return payload;
    } catch {
      // Fall through to next candidate.
    }
  }

  return null;
};

const getHomepageData = async (path, requestOrigin = "") => {
  const payload = await getHomepagePayload(path, requestOrigin);
  return Array.isArray(payload?.data) ? payload.data : [];
};

const getHomepageSettings = async (requestOrigin = "") => {
  const payload = await getHomepagePayload("/api/settings/public", requestOrigin);
  return payload?.data && typeof payload.data === "object" ? payload.data : null;
};

const getHomepageCategories = async (requestOrigin = "") => {
  const payload = await getHomepagePayload("/api/categories", requestOrigin);
  const items = Array.isArray(payload?.data) ? payload.data : [];
  return items.filter((category) => !category?.parent);
};

const getHomepagePopularProducts = async (requestOrigin = "") => {
  const payload = await getHomepagePayload(
    "/api/products?sortBy=popular&order=desc&includeCombos=false&limit=10",
    requestOrigin,
  );
  return Array.isArray(payload?.data) ? payload.data : [];
};

const getHomepageCombos = async (requestOrigin = "") => {
  const payload = await getHomepagePayload(
    "/api/combos?sort=priority&limit=10",
    requestOrigin,
  );
  return Array.isArray(payload?.data?.items) ? payload.data.items.slice(0, 4) : [];
};

export default async function Home() {
  const requestOrigin = await getRequestOrigin();
  const [
    homeSlides,
    banners,
    homepageSettings,
    homepageCategories,
    homepagePopularProducts,
    homepageCombos,
  ] = await Promise.all([
    getHomepageData("/api/home-slides", requestOrigin),
    getHomepageData("/api/banners", requestOrigin),
    getHomepageSettings(requestOrigin),
    getHomepageCategories(requestOrigin),
    getHomepagePopularProducts(requestOrigin),
    getHomepageCombos(requestOrigin),
  ]);

  return (
    <main
      className="sliderWrapper relative w-full overflow-x-hidden pb-0"
      style={{
        background:
          "linear-gradient(180deg, #fffdf9 0%, var(--flavor-light, #f7f1ef) 16%, #fffaf2 42%, #ffffff 100%)",
        transition: "background 0.5s cubic-bezier(0.4, 0, 0.2, 1)",
      }}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 z-0 h-[140rem] bg-[radial-gradient(circle_at_top,rgba(255,241,214,0.5),transparent_46%)]" />
      <div className="relative z-10">
        <HomeSlider
          initialSlides={homeSlides}
          initialSettings={homepageSettings}
        />
        <OfferCountdownStrip
          initialConfig={homepageSettings?.offerCountdownSettings || null}
        />
        <Banners initialBanners={banners} />
        <CatSlider
          initialCategories={homepageCategories}
          initialPopularProducts={homepagePopularProducts}
          initialPopularCombos={homepageCombos}
        />
        <HomeComboDeals initialCombos={homepageCombos} />
        <MembershipCTA />
      </div>
    </main>
  );
}
