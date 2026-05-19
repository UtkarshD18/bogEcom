import Link from "next/link";
import { notFound } from "next/navigation";

const SITE_URL = String(
  process.env.NEXT_PUBLIC_SITE_URL || "https://healthyonegram.com",
)
  .trim()
  .replace(/^["']|["']$/g, "")
  .replace(/\/+$/, "");

const normalizeBaseUrl = (value) =>
  String(value || "")
    .trim()
    .replace(/^["']|["']$/g, "")
    .replace(/\/+$/, "");

const DEFAULT_METADATA = {
  title: "Healthy One Gram - Premium Peanut Butter Store",
  description:
    "Shop premium quality peanut butter and healthy food products at Healthy One Gram. Natural, organic, and delicious options for a healthier lifestyle.",
  keywords:
    "peanut butter, healthy food, organic, natural, protein, healthy one gram",
};

const DEFAULT_HIGHLIGHTS = [
  "Premium ingredients",
  "Everyday wellness support",
  "Thoughtful product selection",
  "Fast online ordering",
];

const DEFAULT_CTA_LINKS = [
  { label: "Browse all products", href: "/products" },
  { label: "Check membership benefits", href: "/membership" },
  { label: "Read wellness articles", href: "/blogs" },
];

const normalizePath = (segments = []) => {
  const parts = Array.isArray(segments)
    ? segments
        .map((segment) => String(segment || "").trim())
        .filter(Boolean)
    : [];

  return `/${parts.join("/")}`.replace(/\/+$/, "") || "/";
};

const fetchSeoSettings = async () => {
  try {
    const apiBase = normalizeBaseUrl(process.env.NEXT_PUBLIC_API_URL || SITE_URL);
    const response = await fetch(`${apiBase}/api/settings/public`, {
      cache: "no-store",
    });
    if (!response.ok) return null;

    const payload = await response.json();
    return payload?.data?.seoSettings || null;
  } catch {
    return null;
  }
};

const findSeoPageByPath = (seoSettings, pathName) => {
  const pages = Array.isArray(seoSettings?.pages) ? seoSettings.pages : [];
  return (
    pages.find((page) => String(page?.path || "").trim() === pathName) || null
  );
};

const toKeywordList = (value) =>
  String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 8);

const toSentenceBlocks = (value) =>
  String(value || "")
    .split(/(?<=[.!?])\s+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 4);

const buildBreadcrumbs = (pathName) => {
  const segments = String(pathName || "/")
    .split("/")
    .filter(Boolean);

  const breadcrumbs = [{ label: "Home", href: "/" }];
  let currentPath = "";

  for (const segment of segments) {
    currentPath += `/${segment}`;
    breadcrumbs.push({
      label: segment
        .replace(/-/g, " ")
        .replace(/\b\w/g, (char) => char.toUpperCase()),
      href: currentPath,
    });
  }

  return breadcrumbs;
};

const toBodySections = (value) =>
  Array.isArray(value)
    ? value
        .map((section) => ({
          heading: String(section?.heading || "").trim(),
          content: String(section?.content || "").trim(),
        }))
        .filter((section) => section.heading || section.content)
    : [];

const toFaqItems = (value) =>
  Array.isArray(value)
    ? value
        .map((item) => ({
          question: String(item?.question || "").trim(),
          answer: String(item?.answer || "").trim(),
        }))
        .filter((item) => item.question && item.answer)
    : [];

const toAbsoluteUrl = (value) => {
  const normalized = String(value || "").trim();
  if (!normalized) return "";
  if (/^https?:\/\//i.test(normalized)) return normalized;
  if (normalized.startsWith("/")) return `${SITE_URL}${normalized}`;
  return `${SITE_URL}/${normalized.replace(/^\/+/, "")}`;
};

const normalizeCtaHref = (value) => {
  const normalized = String(value || "").trim();
  if (!normalized) return "/products";
  if (/^https?:\/\//i.test(normalized)) return normalized;
  return normalized.startsWith("/") ? normalized : `/${normalized}`;
};

export async function generateMetadata({ params }) {
  const resolvedParams = await params;
  const pathName = normalizePath(resolvedParams?.slug);
  const seoSettings = await fetchSeoSettings();
  const page = findSeoPageByPath(seoSettings, pathName);

  if (!page) {
    return DEFAULT_METADATA;
  }

  return {
    title: page.metaTitle || DEFAULT_METADATA.title,
    description: page.metaDescription || DEFAULT_METADATA.description,
    keywords: page.keywords || DEFAULT_METADATA.keywords,
    robots: {
      index: Boolean(page.indexable !== false),
      follow: true,
    },
    openGraph: {
      title: page.metaTitle || DEFAULT_METADATA.title,
      description: page.metaDescription || DEFAULT_METADATA.description,
      url: `${SITE_URL}${pathName}`,
      type: "website",
      ...(page?.heroImageUrl
        ? {
            images: [
              {
                url: toAbsoluteUrl(page.heroImageUrl),
                alt:
                  String(page?.heroImageAlt || page?.heroTitle || page?.label || "")
                    .trim() || "Healthy One Gram SEO page banner",
              },
            ],
          }
        : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: page.metaTitle || DEFAULT_METADATA.title,
      description: page.metaDescription || DEFAULT_METADATA.description,
      ...(page?.heroImageUrl
        ? {
            images: [toAbsoluteUrl(page.heroImageUrl)],
          }
        : {}),
    },
  };
}

const SeoLandingPage = async ({ params }) => {
  const resolvedParams = await params;
  const pathName = normalizePath(resolvedParams?.slug);
  const seoSettings = await fetchSeoSettings();
  const page = findSeoPageByPath(seoSettings, pathName);

  if (!page) {
    notFound();
  }

  const title = String(page?.metaTitle || page?.label || "Healthy One Gram").trim();
  const description = String(page?.metaDescription || "").trim();
  const keywords = String(page?.keywords || "").trim();
  const notes = String(page?.notes || "").trim();
  const heroTitle = String(page?.heroTitle || title).trim() || title;
  const heroSubtitle = String(page?.heroSubtitle || description).trim();
  const heroImageUrl = String(page?.heroImageUrl || "").trim();
  const heroImageAlt =
    String(page?.heroImageAlt || page?.heroTitle || page?.label || title).trim() ||
    "Healthy One Gram SEO banner";
  const ctaLabel =
    String(page?.ctaLabel || "Explore Products").trim() || "Explore Products";
  const ctaHref = normalizeCtaHref(page?.ctaHref);
  const keywordList = toKeywordList(keywords);
  const descriptionBlocks = toSentenceBlocks(description);
  const noteBlocks = toSentenceBlocks(notes);
  const bodySections = toBodySections(page?.bodySections);
  const faqItems = toFaqItems(page?.faqItems);
  const highlights =
    keywordList.length > 0
      ? keywordList.slice(0, 4)
      : DEFAULT_HIGHLIGHTS;
  const breadcrumbs = buildBreadcrumbs(pathName);
  const eyebrow = String(page?.label || "SEO Landing Page").trim();

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#fff8ee_0%,#fffdf8_28%,#ffffff_100%)] text-slate-900">
      <section className="mx-auto max-w-6xl px-6 pb-20 pt-10 md:pt-16">
        <nav className="mb-8 flex flex-wrap items-center gap-2 text-sm text-slate-500">
          {breadcrumbs.map((crumb, index) => (
            <span key={crumb.href} className="flex items-center gap-2">
              {index > 0 ? <span className="text-slate-300">/</span> : null}
              {index === breadcrumbs.length - 1 ? (
                <span className="font-medium text-slate-700">{crumb.label}</span>
              ) : (
                <Link href={crumb.href} className="transition hover:text-[#8a5b18]">
                  {crumb.label}
                </Link>
              )}
            </span>
          ))}
        </nav>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.8fr)]">
          <div className="relative overflow-hidden rounded-[2rem] border border-[#eadfcd] bg-white px-8 py-10 shadow-[0_20px_70px_rgba(138,91,24,0.08)] md:px-12 md:py-14">
            <div className="absolute right-0 top-0 h-48 w-48 rounded-full bg-[radial-gradient(circle,#f6d9a7_0%,rgba(246,217,167,0)_72%)]" />
            <div className="absolute -left-8 bottom-0 h-40 w-40 rounded-full bg-[radial-gradient(circle,#fdeccf_0%,rgba(253,236,207,0)_72%)]" />
            <div className="relative">
              <span className="inline-flex rounded-full bg-[#f5ead5] px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-[#8a5b18]">
                {eyebrow}
              </span>
              <h1 className="mt-5 max-w-4xl text-4xl font-semibold tracking-tight text-slate-900 md:text-6xl">
                {heroTitle}
              </h1>
              {heroSubtitle ? (
                <p className="mt-6 max-w-3xl text-base leading-8 text-slate-600 md:text-lg">
                  {heroSubtitle}
                </p>
              ) : null}

              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href={ctaHref}
                  className="inline-flex items-center justify-center rounded-full bg-[#8a5b18] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#704712]"
                >
                  {ctaLabel}
                </Link>
                <Link
                  href="/contact"
                  className="inline-flex items-center justify-center rounded-full border border-[#d7c1a1] bg-[#fff8ee] px-6 py-3 text-sm font-semibold text-[#8a5b18] transition hover:bg-[#fbeedb]"
                >
                  Contact Us
                </Link>
              </div>

              {keywordList.length > 0 ? (
                <div className="mt-8 flex flex-wrap gap-2">
                  {keywordList.map((keyword) => (
                    <span
                      key={keyword}
                      className="rounded-full border border-[#eadfcd] bg-[#fffaf1] px-3 py-1 text-sm text-slate-600"
                    >
                      {keyword}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          <aside className="space-y-6">
            {heroImageUrl ? (
              <div className="overflow-hidden rounded-[2rem] border border-[#eadfcd] bg-white shadow-sm">
                <img
                  src={heroImageUrl}
                  alt={heroImageAlt}
                  className="h-full max-h-[320px] w-full object-cover"
                />
              </div>
            ) : null}

            <div className="rounded-[2rem] border border-[#eadfcd] bg-white p-7 shadow-sm">
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#8a5b18]">
                Why Healthy One Gram
              </p>
              <div className="mt-5 grid gap-4">
                {highlights.map((highlight, index) => (
                  <div
                    key={`${highlight}-${index}`}
                    className="rounded-2xl border border-[#f0e4d1] bg-[#fffaf4] p-4"
                  >
                    <p className="text-sm font-medium text-slate-800">{highlight}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[2rem] border border-dashed border-[#dec9aa] bg-[#fff8ee] p-7">
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#8a5b18]">
                Search Visibility
              </p>
              <p className="mt-4 text-sm leading-7 text-slate-600">
                This landing page is live at <span className="font-medium text-slate-800">{pathName}</span> and can be indexed when search indexing is enabled for this SEO entry.
              </p>
            </div>
          </aside>
        </div>

        <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
          <section className="rounded-[2rem] border border-[#eee2cf] bg-white p-8 shadow-sm">
            <h2 className="text-2xl font-semibold text-slate-900 md:text-3xl">
              About This Page
            </h2>
            <div className="mt-6 space-y-5 text-base leading-8 text-slate-600">
              {(descriptionBlocks.length > 0 ? descriptionBlocks : [description]).filter(Boolean).map((block, index) => (
                <p key={`desc-${index}`}>{block}</p>
              ))}
              {noteBlocks.map((block, index) => (
                <p key={`note-${index}`} className="text-slate-500">
                  {block}
                </p>
              ))}
            </div>
          </section>

          <section className="rounded-[2rem] border border-[#eee2cf] bg-white p-8 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900">Next Steps</h2>
            <div className="mt-5 grid gap-4">
              {[{ label: ctaLabel, href: ctaHref }, ...DEFAULT_CTA_LINKS]
                .filter(
                  (item, index, array) =>
                    item.label &&
                    item.href &&
                    array.findIndex(
                      (candidate) =>
                        candidate.label === item.label && candidate.href === item.href,
                    ) === index,
                )
                .map((item) => (
                  <Link
                    key={`${item.label}-${item.href}`}
                    href={item.href}
                    className="rounded-2xl border border-[#eadfcd] bg-[#fffaf1] px-5 py-4 text-sm font-medium text-slate-700 transition hover:border-[#d9bd93] hover:text-[#8a5b18]"
                  >
                    {item.label}
                  </Link>
                ))}
            </div>
          </section>
        </div>

        {bodySections.length > 0 ? (
          <section className="mt-10 rounded-[2rem] border border-[#eee2cf] bg-white p-8 shadow-sm">
            <div className="grid gap-6 md:grid-cols-2">
              {bodySections.map((section, index) => (
                <article
                  key={`${section.heading || "section"}-${index}`}
                  className="rounded-3xl border border-[#f0e4d1] bg-[#fffaf4] p-6"
                >
                  <h2 className="text-xl font-semibold text-slate-900">
                    {section.heading || `Section ${index + 1}`}
                  </h2>
                  {toSentenceBlocks(section.content).length > 0 ? (
                    <div className="mt-4 space-y-4 text-sm leading-7 text-slate-600">
                      {toSentenceBlocks(section.content).map((block, blockIndex) => (
                        <p key={`section-${index}-${blockIndex}`}>{block}</p>
                      ))}
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {faqItems.length > 0 ? (
          <section className="mt-10 rounded-[2rem] border border-[#eee2cf] bg-white p-8 shadow-sm">
            <div className="max-w-4xl">
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#8a5b18]">
                Frequently Asked Questions
              </p>
              <div className="mt-6 space-y-4">
                {faqItems.map((faq, index) => (
                  <article
                    key={`${faq.question}-${index}`}
                    className="rounded-3xl border border-[#f0e4d1] bg-[#fffaf4] p-6"
                  >
                    <h3 className="text-lg font-semibold text-slate-900">
                      {faq.question}
                    </h3>
                    <p className="mt-3 text-sm leading-7 text-slate-600">
                      {faq.answer}
                    </p>
                  </article>
                ))}
              </div>
            </div>
          </section>
        ) : null}
      </section>
    </main>
  );
};

export default SeoLandingPage;
