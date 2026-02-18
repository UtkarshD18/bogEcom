"use client";

import { API_BASE_URL } from "@/utils/api";
import { CircularProgress } from "@mui/material";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const API_URL = API_BASE_URL.endsWith("/api") ? API_BASE_URL : `${API_BASE_URL}/api`;

const THEME_PRESETS = {
  mint: {
    bg: "from-emerald-50/80 via-white to-teal-50/80",
    glowA: "bg-emerald-200/40",
    glowB: "bg-teal-200/30",
    accent: "from-emerald-600 via-teal-600 to-green-600",
    badge: "from-emerald-500 to-teal-500",
    border: "border-emerald-200/50",
    focusRing: "focus:ring-emerald-200/60",
    chip: "text-emerald-700 bg-emerald-50/70 border-emerald-200/60",
  },
  sky: {
    bg: "from-sky-50/80 via-white to-cyan-50/80",
    glowA: "bg-sky-200/40",
    glowB: "bg-cyan-200/30",
    accent: "from-sky-600 via-cyan-600 to-blue-600",
    badge: "from-sky-500 to-cyan-500",
    border: "border-sky-200/50",
    focusRing: "focus:ring-sky-200/60",
    chip: "text-sky-700 bg-sky-50/70 border-sky-200/60",
  },
  aurora: {
    bg: "from-lime-50/80 via-white to-emerald-50/80",
    glowA: "bg-lime-200/35",
    glowB: "bg-emerald-200/30",
    accent: "from-lime-600 via-emerald-600 to-teal-600",
    badge: "from-lime-500 to-emerald-500",
    border: "border-emerald-200/50",
    focusRing: "focus:ring-emerald-200/60",
    chip: "text-emerald-700 bg-emerald-50/70 border-emerald-200/60",
  },
  lavender: {
    bg: "from-indigo-50/80 via-white to-purple-50/80",
    glowA: "bg-indigo-200/35",
    glowB: "bg-purple-200/30",
    accent: "from-indigo-600 via-purple-600 to-fuchsia-600",
    badge: "from-indigo-500 to-purple-500",
    border: "border-indigo-200/50",
    focusRing: "focus:ring-indigo-200/60",
    chip: "text-indigo-700 bg-indigo-50/70 border-indigo-200/60",
  },
  sunset: {
    bg: "from-orange-50/80 via-white to-rose-50/80",
    glowA: "bg-orange-200/35",
    glowB: "bg-rose-200/30",
    accent: "from-orange-600 via-rose-600 to-pink-600",
    badge: "from-orange-500 to-rose-500",
    border: "border-rose-200/50",
    focusRing: "focus:ring-rose-200/60",
    chip: "text-rose-700 bg-rose-50/70 border-rose-200/60",
  },
  midnight: {
    bg: "from-slate-50/80 via-white to-gray-50/80",
    glowA: "bg-slate-200/35",
    glowB: "bg-gray-200/30",
    accent: "from-slate-700 via-gray-800 to-zinc-800",
    badge: "from-slate-700 to-gray-800",
    border: "border-slate-200/50",
    focusRing: "focus:ring-slate-200/60",
    chip: "text-slate-700 bg-slate-50/70 border-slate-200/60",
  },
};

const DEFAULT_CONTENT = {
  theme: { style: "mint", layout: "glass" },
  sections: { hero: true, standard: true, whyUs: true, values: true, cta: true },
  hero: {
    badge: "About Us",
    title: "Nutrition without the",
    titleHighlight: "noise.",
    description: "",
    image: "",
  },
  standard: { subtitle: "", title: "", description: "", image: "", stats: [] },
  whyUs: { subtitle: "", title: "", features: [] },
  values: { subtitle: "", title: "", items: [] },
  cta: { title: "", description: "", buttonText: "", buttonLink: "/products" },
};

const GlassCard = ({ className = "", children }) => (
  <div
    className={[
      "relative overflow-hidden rounded-3xl bg-white/65 backdrop-blur-xl border border-white/60 shadow-xl shadow-black/5",
      className,
    ].join(" ")}
  >
    {children}
  </div>
);

/**
 * About Us Page
 * Theme/layout and content are fully controlled from admin CMS.
 */
export default function AboutUsPage() {
  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchContent = async () => {
      try {
        const response = await fetch(`${API_URL}/about/public`, {
          cache: "no-store",
        });

        if (!response.ok) {
          const text = await response.text();
          throw new Error(
            `Request failed: ${response.status} ${response.statusText}${text ? ` | ${text}` : ""}`,
          );
        }

        const data = await response.json();
        if (data?.success && data?.data) {
          setContent(data.data);
        } else {
          setError("Unable to load content");
        }
      } catch (err) {
        console.error("AboutUsPage fetch error:", err);
        setError("Unable to load content");
      } finally {
        setLoading(false);
      }
    };

    fetchContent();
  }, []);

  const pageContent = content || DEFAULT_CONTENT;
  const themeStyle = pageContent?.theme?.style || DEFAULT_CONTENT.theme.style;
  const layout = pageContent?.theme?.layout || DEFAULT_CONTENT.theme.layout;
  const theme = useMemo(
    () => THEME_PRESETS[themeStyle] || THEME_PRESETS.mint,
    [themeStyle],
  );

  const sections = pageContent?.sections || DEFAULT_CONTENT.sections;
  const showHero = sections.hero !== false;
  const showStandard = sections.standard !== false;
  const showWhyUs = sections.whyUs !== false;
  const showValues = sections.values !== false;
  const showCta = sections.cta !== false;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <CircularProgress />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] px-4">
        <div className="max-w-xl w-full bg-white border border-gray-200 rounded-2xl p-6 text-center shadow-sm">
          <p className="text-gray-700 font-semibold">{error}</p>
          <p className="text-sm text-gray-500 mt-2">
            Check backend, API URL and CORS settings.
          </p>
        </div>
      </div>
    );
  }

  const { hero, standard, whyUs, values, cta } = pageContent;

  if (layout === "minimal") {
    return (
      <main className="min-h-screen bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
          {showHero && (
            <section className="max-w-3xl">
              {hero?.badge && (
                <span
                  className={[
                    "inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide border",
                    theme.chip,
                  ].join(" ")}
                >
                  {hero.badge}
                </span>
              )}
              <h1 className="mt-5 text-4xl sm:text-5xl font-extrabold tracking-tight text-gray-900">
                {hero?.title}{" "}
                <span
                  className={`bg-gradient-to-r ${theme.accent} bg-clip-text text-transparent`}
                >
                  {hero?.titleHighlight}
                </span>
              </h1>
              {hero?.description && (
                <p className="mt-5 text-gray-600 text-lg leading-relaxed">
                  {hero.description}
                </p>
              )}
            </section>
          )}

          {showStandard && (
            <section className="mt-12 border-t border-gray-100 pt-10">
              <h2 className="text-xl font-semibold text-gray-900">
                {standard?.title || "Our Standard"}
              </h2>
              {standard?.description && (
                <p className="mt-3 text-gray-600 leading-relaxed">
                  {standard.description}
                </p>
              )}
              {standard?.stats?.length > 0 && (
                <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {standard.stats.map((stat, idx) => (
                    <div
                      key={`${stat?.label || "stat"}-${idx}`}
                      className="rounded-2xl border border-gray-100 bg-gray-50 p-4"
                    >
                      <div className="text-2xl font-extrabold text-gray-900">
                        {stat?.value}
                      </div>
                      <div className="text-xs uppercase tracking-wide text-gray-500 mt-1">
                        {stat?.label}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {showWhyUs && whyUs?.features?.length > 0 && (
            <section className="mt-12 border-t border-gray-100 pt-10">
              <h2 className="text-xl font-semibold text-gray-900">
                {whyUs?.title || "Why Choose Us"}
              </h2>
              <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {whyUs.features.map((feature, idx) => (
                  <div
                    key={`${feature?.title || "feature"}-${idx}`}
                    className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm"
                  >
                    <div className="text-2xl">{feature?.icon}</div>
                    <div className="mt-3 font-semibold text-gray-900">
                      {feature?.title}
                    </div>
                    <div className="mt-2 text-sm text-gray-600 leading-relaxed">
                      {feature?.description}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {showValues && values?.items?.length > 0 && (
            <section className="mt-12 border-t border-gray-100 pt-10">
              <h2 className="text-xl font-semibold text-gray-900">
                {values?.title || "Our Values"}
              </h2>
              <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {values.items.map((item, idx) => (
                  <div
                    key={`${item?.title || "value"}-${idx}`}
                    className="rounded-2xl border border-gray-100 bg-gray-50 p-5"
                  >
                    <div className="font-semibold text-gray-900">
                      {item?.title}
                    </div>
                    <div className="mt-2 text-sm text-gray-600 leading-relaxed">
                      {item?.description}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {showCta && cta?.title && (
            <section className="mt-14 rounded-3xl border border-gray-100 bg-gray-50 p-8 sm:p-10">
              <h2 className="text-2xl font-extrabold text-gray-900">
                {cta.title}
              </h2>
              {cta?.description && (
                <p className="mt-3 text-gray-600 leading-relaxed">
                  {cta.description}
                </p>
              )}
              {cta?.buttonText && (
                <Link
                  href={cta?.buttonLink || "/products"}
                  className={`inline-flex mt-6 items-center justify-center px-6 py-3 rounded-2xl font-semibold text-white bg-gradient-to-r ${theme.accent} shadow-lg shadow-black/10 hover:scale-[1.01] transition-transform`}
                >
                  {cta.buttonText}
                </Link>
              )}
            </section>
          )}
        </div>
      </main>
    );
  }

  // Default: "glass" layout (membership-style liquid glass)
  return (
    <main
      className={`relative min-h-screen bg-gradient-to-b ${theme.bg} overflow-hidden`}
    >
      <div className="absolute inset-0 pointer-events-none">
        <div
          className={`absolute -top-24 -left-24 h-80 w-80 rounded-full blur-3xl ${theme.glowA}`}
        />
        <div
          className={`absolute top-1/3 -right-24 h-96 w-96 rounded-full blur-3xl ${theme.glowB}`}
        />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        {showHero && (
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-7">
              {hero?.badge && (
                <span
                  className={`inline-flex items-center px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wide bg-gradient-to-r ${theme.badge} text-white shadow-sm`}
                >
                  {hero.badge}
                </span>
              )}
              <h1 className="mt-5 text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-gray-900">
                {hero?.title}{" "}
                <span
                  className={`bg-gradient-to-r ${theme.accent} bg-clip-text text-transparent`}
                >
                  {hero?.titleHighlight}
                </span>
              </h1>
              {hero?.description && (
                <p className="mt-6 text-gray-600 text-lg leading-relaxed max-w-2xl">
                  {hero.description}
                </p>
              )}
            </div>

            <div className="lg:col-span-5">
              <GlassCard className={`p-4 border ${theme.border}`}>
                {hero?.image ? (
                  <img
                    src={hero.image}
                    alt={hero?.title || "About us"}
                    className="w-full h-72 sm:h-80 object-cover rounded-2xl"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-72 sm:h-80 rounded-2xl border border-dashed border-gray-200 bg-white/40 flex items-center justify-center">
                    <div className="text-center px-6">
                      <div className="text-sm font-semibold text-gray-800">
                        Optional hero image
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        Add a URL from the admin editor
                      </div>
                    </div>
                  </div>
                )}
              </GlassCard>
            </div>
          </section>
        )}

        {showStandard && (
          <section className="mt-10 sm:mt-14">
            <GlassCard className="p-6 sm:p-8">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
                <div className="lg:col-span-7">
                  {standard?.subtitle && (
                    <div className="text-xs font-bold uppercase tracking-[0.18em] text-gray-500">
                      {standard.subtitle}
                    </div>
                  )}
                  <h2 className="mt-2 text-2xl sm:text-3xl font-extrabold text-gray-900">
                    {standard?.title}
                  </h2>
                  {standard?.description && (
                    <p className="mt-4 text-gray-600 leading-relaxed">
                      {standard.description}
                    </p>
                  )}

                  {standard?.stats?.length > 0 && (
                    <div className="mt-7 grid grid-cols-2 sm:grid-cols-4 gap-4">
                      {standard.stats.map((stat, idx) => (
                        <div
                          key={`${stat?.label || "stat"}-${idx}`}
                          className="rounded-2xl bg-white/70 border border-white/60 p-4 shadow-sm"
                        >
                          <div
                            className={`text-xl sm:text-2xl font-extrabold bg-gradient-to-r ${theme.accent} bg-clip-text text-transparent`}
                          >
                            {stat?.value}
                          </div>
                          <div className="mt-1 text-[11px] uppercase tracking-wide text-gray-500">
                            {stat?.label}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="lg:col-span-5">
                  {standard?.image ? (
                    <div className="relative overflow-hidden rounded-2xl border border-white/60 bg-white/50 backdrop-blur">
                      <img
                        src={standard.image}
                        alt={standard?.title || "Our standard"}
                        className="w-full h-72 object-cover"
                        loading="lazy"
                      />
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-gray-200 bg-white/40 p-6 text-sm text-gray-600">
                      Add an optional image URL for this section.
                    </div>
                  )}
                </div>
              </div>
            </GlassCard>
          </section>
        )}

        {showWhyUs && whyUs?.features?.length > 0 && (
          <section className="mt-10 sm:mt-14">
            <div className="text-center max-w-2xl mx-auto">
              {whyUs?.subtitle && (
                <div className="text-xs font-bold uppercase tracking-[0.18em] text-gray-500">
                  {whyUs.subtitle}
                </div>
              )}
              <h2 className="mt-2 text-2xl sm:text-3xl font-extrabold text-gray-900">
                {whyUs?.title}
              </h2>
            </div>

            <div className="mt-7 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {whyUs.features.map((feature, idx) => (
                <GlassCard key={`${feature?.title || "feature"}-${idx}`} className="p-6">
                  <div className="flex items-start gap-3">
                    <div className="text-2xl">{feature?.icon}</div>
                    <div>
                      <div className="font-bold text-gray-900">
                        {feature?.title}
                      </div>
                      <div className="mt-2 text-sm text-gray-600 leading-relaxed">
                        {feature?.description}
                      </div>
                    </div>
                  </div>
                </GlassCard>
              ))}
            </div>
          </section>
        )}

        {showValues && values?.items?.length > 0 && (
          <section className="mt-10 sm:mt-14">
            <div className="text-center max-w-2xl mx-auto">
              {values?.subtitle && (
                <div className="text-xs font-bold uppercase tracking-[0.18em] text-gray-500">
                  {values.subtitle}
                </div>
              )}
              <h2 className="mt-2 text-2xl sm:text-3xl font-extrabold text-gray-900">
                {values?.title}
              </h2>
            </div>

            <div className="mt-7 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {values.items.map((item, idx) => (
                <GlassCard key={`${item?.title || "value"}-${idx}`} className="p-6">
                  <div className="font-bold text-gray-900">{item?.title}</div>
                  <div className="mt-2 text-sm text-gray-600 leading-relaxed">
                    {item?.description}
                  </div>
                </GlassCard>
              ))}
            </div>
          </section>
        )}

        {showCta && cta?.title && (
          <section className="mt-12 sm:mt-16">
            <div
              className={`relative overflow-hidden rounded-3xl border border-white/60 bg-white/55 backdrop-blur-xl shadow-2xl shadow-black/10`}
            >
              <div className="absolute inset-0 pointer-events-none opacity-60">
                <div
                  className={`absolute -top-16 -right-16 h-48 w-48 rounded-full blur-3xl ${theme.glowB}`}
                />
                <div
                  className={`absolute -bottom-20 -left-20 h-56 w-56 rounded-full blur-3xl ${theme.glowA}`}
                />
              </div>

              <div className="relative z-10 px-8 sm:px-10 py-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                <div>
                  <h3 className="text-2xl sm:text-3xl font-extrabold text-gray-900">
                    {cta.title}
                  </h3>
                  {cta?.description && (
                    <p className="mt-2 text-gray-600 max-w-2xl leading-relaxed">
                      {cta.description}
                    </p>
                  )}
                </div>
                {cta?.buttonText && (
                  <Link
                    href={cta?.buttonLink || "/products"}
                    className={`inline-flex items-center justify-center px-8 py-3 rounded-2xl font-semibold text-white bg-gradient-to-r ${theme.accent} shadow-lg shadow-black/15 hover:scale-[1.02] transition-transform`}
                  >
                    {cta.buttonText}
                  </Link>
                )}
              </div>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

