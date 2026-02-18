"use client";

import { API_BASE_URL } from "@/utils/api";

import { sanitizeHTML } from "@/utils/sanitize";
import { CircularProgress } from "@mui/material";
import { useEffect, useState } from "react";
import { MdInfo } from "react-icons/md";

const API_URL = API_BASE_URL;

const THEME_PRESETS = {
  mint: {
    bg: "from-emerald-50/80 via-white to-teal-50/80",
    glowA: "bg-emerald-200/40",
    glowB: "bg-teal-200/30",
    accent: "from-emerald-600 via-teal-600 to-green-600",
    badge: "from-emerald-500 to-teal-500",
    border: "border-emerald-200/50",
  },
  sky: {
    bg: "from-sky-50/80 via-white to-cyan-50/80",
    glowA: "bg-sky-200/40",
    glowB: "bg-cyan-200/30",
    accent: "from-sky-600 via-cyan-600 to-blue-600",
    badge: "from-sky-500 to-cyan-500",
    border: "border-sky-200/50",
  },
  aurora: {
    bg: "from-lime-50/80 via-white to-emerald-50/80",
    glowA: "bg-lime-200/35",
    glowB: "bg-emerald-200/30",
    accent: "from-lime-600 via-emerald-600 to-teal-600",
    badge: "from-lime-500 to-emerald-500",
    border: "border-emerald-200/50",
  },
  lavender: {
    bg: "from-indigo-50/80 via-white to-purple-50/80",
    glowA: "bg-indigo-200/35",
    glowB: "bg-purple-200/30",
    accent: "from-indigo-600 via-purple-600 to-fuchsia-600",
    badge: "from-indigo-500 to-purple-500",
    border: "border-indigo-200/50",
  },
  sunset: {
    bg: "from-orange-50/80 via-white to-rose-50/80",
    glowA: "bg-orange-200/35",
    glowB: "bg-rose-200/30",
    accent: "from-orange-600 via-rose-600 to-pink-600",
    badge: "from-orange-500 to-rose-500",
    border: "border-rose-200/50",
  },
  midnight: {
    bg: "from-slate-50/80 via-white to-gray-50/80",
    glowA: "bg-slate-200/35",
    glowB: "bg-gray-200/30",
    accent: "from-slate-700 via-gray-800 to-zinc-800",
    badge: "from-slate-700 to-gray-800",
    border: "border-slate-200/50",
  },
};

const DEFAULT_THEME = { style: "mint", layout: "glass" };

const escapeHtml = (value) =>
  String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");

const toHtmlFromPlainText = (raw) => {
  const lines = String(raw || "").split(/\r?\n/);
  const blocks = [];
  let paragraph = [];
  let listItems = [];

  const flushParagraph = () => {
    if (!paragraph.length) return;
    blocks.push(`<p>${paragraph.join(" ")}</p>`);
    paragraph = [];
  };

  const flushList = () => {
    if (!listItems.length) return;
    blocks.push(`<ul>${listItems.map((item) => `<li>${item}</li>`).join("")}</ul>`);
    listItems = [];
  };

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) {
      flushList();
      flushParagraph();
      return;
    }

    if (/^#{1,3}\s+/.test(trimmed)) {
      flushList();
      flushParagraph();
      const level = Math.min(3, trimmed.match(/^#{1,3}/)[0].length);
      const heading = trimmed.replace(/^#{1,3}\s+/, "");
      blocks.push(`<h${level}>${escapeHtml(heading)}</h${level}>`);
      return;
    }

    if (/^[-*]\s+/.test(trimmed)) {
      flushParagraph();
      listItems.push(escapeHtml(trimmed.replace(/^[-*]\s+/, "")));
      return;
    }

    paragraph.push(escapeHtml(trimmed));
  });

  flushList();
  flushParagraph();

  return blocks.join("");
};

const buildSafeHtml = (raw) => {
  const value = String(raw || "").trim();
  if (!value) return "";
  const looksLikeHtml = /<\/?[a-z][\s\S]*>/i.test(value);
  const html = looksLikeHtml ? value : toHtmlFromPlainText(value);
  return sanitizeHTML(html);
};

/**
 * Cancellation Information Page
 * Publicly accessible, content fetched from backend
 * Read-only for users
 */
const CancellationPage = () => {
  const [content, setContent] = useState("");
  const [themeConfig, setThemeConfig] = useState(DEFAULT_THEME);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const themeKey = themeConfig?.style || DEFAULT_THEME.style;
  const layout = themeConfig?.layout || DEFAULT_THEME.layout;
  const theme = THEME_PRESETS[themeKey] || THEME_PRESETS.mint;
  const sanitizedContent = buildSafeHtml(content);

  useEffect(() => {
    fetchCancellationPolicy();
  }, []);

  const fetchCancellationPolicy = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/api/cancellation`, {
        cache: "no-store",
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(
          `Request failed: ${response.status} ${response.statusText} ${text ? `| ${text}` : ""}`.trim(),
        );
      }

      const data = await response.json();

      if (data.success) {
        setContent(data.data.content || "");
        setUpdatedAt(data.data.updatedAt || null);
        setThemeConfig({
          ...DEFAULT_THEME,
          ...(data.data.theme || {}),
        });
      } else {
        setError("Failed to load cancellation policy");
      }
    } catch (err) {
      console.error("Error fetching cancellation policy:", {
        apiUrl: API_URL,
        error: err,
      });
      setError("Failed to load cancellation policy");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <section className="min-h-screen bg-gray-50 py-12 px-4 flex items-center justify-center">
        <CircularProgress />
      </section>
    );
  }

  if (error) {
    return (
      <section className="min-h-screen bg-gray-50 py-12 px-4">
        <div className="container mx-auto max-w-4xl">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <p className="text-red-600">{error}</p>
          </div>
        </div>
      </section>
    );
  }

  if (layout === "minimal") {
    return (
      <section className="min-h-screen bg-white py-12">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="mb-6">
            <span className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-gray-600">
              Policy
            </span>
            <h1 className="mt-4 text-3xl sm:text-4xl font-extrabold text-gray-900">
              Cancellation & Return Policy
            </h1>
            {updatedAt && (
              <p className="mt-2 text-sm text-gray-500">
                Last updated{" "}
                {new Date(updatedAt).toLocaleDateString("en-IN", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            )}
          </div>

          <div className="rounded-3xl border border-gray-100 bg-white p-6 sm:p-10 shadow-sm">
            <article
              className="prose prose-slate max-w-none"
              dangerouslySetInnerHTML={{
                __html: sanitizedContent,
              }}
            />
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      className={`relative min-h-screen bg-gradient-to-b ${theme.bg} py-12 sm:py-16 overflow-hidden`}
    >
      <div className="pointer-events-none absolute inset-0">
        <div
          className={`absolute -top-20 -left-20 h-72 w-72 rounded-full blur-3xl ${theme.glowA}`}
        />
        <div
          className={`absolute top-1/3 -right-24 h-80 w-80 rounded-full blur-3xl ${theme.glowB}`}
        />
      </div>

      <div className="relative z-10 container mx-auto px-4 max-w-5xl">
        <div className="text-center mb-8 sm:mb-10">
          <span
            className={`inline-flex items-center px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wide bg-gradient-to-r ${theme.badge} text-white shadow-sm`}
          >
            Policy Document
          </span>
          <h1 className="mt-5 text-3xl sm:text-4xl md:text-5xl font-extrabold text-gray-900 tracking-tight">
            Cancellation & Return Policy
          </h1>
          <p className="mt-3 text-sm text-gray-600">
            Please read our cancellation and return policy carefully before
            placing an order.
          </p>
          {updatedAt && (
            <p className="mt-2 text-xs text-gray-500">
              Last updated{" "}
              {new Date(updatedAt).toLocaleDateString("en-IN", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          )}
        </div>

        <div
          className={`rounded-3xl border ${theme.border} bg-white/75 backdrop-blur-xl shadow-2xl shadow-black/10 p-6 sm:p-10`}
        >
          <article
            className="prose prose-slate max-w-none prose-headings:scroll-mt-24 prose-h2:text-2xl prose-h3:text-xl"
            dangerouslySetInnerHTML={{
              __html: sanitizedContent,
            }}
          />
        </div>

        <div className="mt-6 rounded-2xl border border-white/60 bg-white/70 backdrop-blur-xl p-5 text-center">
          <div className="flex items-center justify-center gap-2 text-sm font-semibold text-gray-700">
            <MdInfo className="text-lg" />
            Need help?
          </div>
          <p className="mt-2 text-sm text-gray-600">
            For cancellation or return questions, please contact customer
            support before placing an order.
          </p>
        </div>
      </div>
    </section>
  );
};

export default CancellationPage;
