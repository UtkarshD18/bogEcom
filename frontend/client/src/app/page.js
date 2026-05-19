import HomeSlider from "@/components/HomeSlider";
import dynamic from "next/dynamic";

const Banners = dynamic(() => import("@/components/Banners"), {
  loading: () => null,
});
const CatSlider = dynamic(() => import("@/components/CatSlider"), {
  loading: () => null,
});
const HomeComboDeals = dynamic(() => import("@/components/HomeComboDeals"), {
  loading: () => null,
});
const HomeCustomerReviews = dynamic(
  () => import("@/components/HomeCustomerReviews"),
  {
    loading: () => null,
  },
);
const OfferCountdownStrip = dynamic(
  () => import("@/components/OfferCountdownStrip"),
  {
    loading: () => null,
  },
);
const WhatsAppFloatingButton = dynamic(
  () => import("@/components/WhatsAppFloatingButton"),
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
    String(process.env.NEXT_PUBLIC_HOMEPAGE_FETCH_TIMEOUT_MS || "1800"),
    10,
  ) || 1800,
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

const getHomepageBaseCandidates = () => {
  if (process.env.NODE_ENV === "production") {
    return [API_BASE_URL].filter(Boolean);
  }

  const candidates = [LOCAL_DEV_API_BASE_URL, API_BASE_URL].filter(
    (candidate, index, arr) => candidate && arr.indexOf(candidate) === index,
  );

  return candidates;
};

const getHomepageData = async (path) => {
  const baseCandidates = getHomepageBaseCandidates();
  if (!baseCandidates.length) {
    return [];
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
      const data = Array.isArray(payload?.data) ? payload.data : [];
      if (data.length > 0 || process.env.NODE_ENV === "production") {
        return data;
      }
    } catch {
      // Fall through to next candidate.
    }
  }

  return [];
};

export default async function Home() {
  const [homeSlides, banners, featuredReviews] = await Promise.all([
    getHomepageData("/api/home-slides"),
    getHomepageData("/api/banners"),
    getHomepageData("/api/reviews/featured/home?limit=6"),
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
        <HomeSlider initialSlides={homeSlides} />
        <OfferCountdownStrip />
        <Banners initialBanners={banners} />
        <CatSlider />
        <HomeComboDeals />
        <HomeCustomerReviews initialReviews={featuredReviews} />
        <MembershipCTA />
      </div>
      <WhatsAppFloatingButton />
    </main>
  );
}
