"use client";

export const BLOG_FONT_FAMILY_OPTIONS = [
  {
    value: "modern-sans",
    label: "Modern Sans",
    description: "Clean and easy to read",
    style: {
      fontFamily: '"Segoe UI", "Helvetica Neue", Arial, sans-serif',
    },
  },
  {
    value: "editorial-serif",
    label: "Editorial Serif",
    description: "Classic article vibe",
    style: {
      fontFamily: 'Georgia, Cambria, "Times New Roman", serif',
    },
  },
  {
    value: "clean-serif",
    label: "Clean Serif",
    description: "Soft and polished",
    style: {
      fontFamily: '"Palatino Linotype", "Book Antiqua", Georgia, serif',
    },
  },
  {
    value: "compact-sans",
    label: "Compact Sans",
    description: "Tighter and punchier",
    style: {
      fontFamily: '"Trebuchet MS", "Segoe UI", Arial, sans-serif',
    },
  },
];

export const BLOG_FONT_SIZE_OPTIONS = [
  {
    value: "sm",
    label: "Small",
    description: "More content on screen",
    style: {
      fontSize: "0.98rem",
      lineHeight: "1.8",
    },
  },
  {
    value: "base",
    label: "Medium",
    description: "Balanced default",
    style: {
      fontSize: "1.08rem",
      lineHeight: "1.9",
    },
  },
  {
    value: "lg",
    label: "Large",
    description: "Comfortable reading",
    style: {
      fontSize: "1.2rem",
      lineHeight: "1.95",
    },
  },
  {
    value: "xl",
    label: "XL",
    description: "Big and airy",
    style: {
      fontSize: "1.32rem",
      lineHeight: "2",
    },
  },
];

const PREVIEW_TEXT =
  "This is how your blog body text will feel on the reader page. Pick the combo that matches the tone of the article.";

const BlogTypographyControls = ({
  contentFontFamily,
  contentFontSize,
  onFontFamilyChange,
  onFontSizeChange,
}) => {
  const activeFontFamily =
    BLOG_FONT_FAMILY_OPTIONS.find((option) => option.value === contentFontFamily) ||
    BLOG_FONT_FAMILY_OPTIONS[0];
  const activeFontSize =
    BLOG_FONT_SIZE_OPTIONS.find((option) => option.value === contentFontSize) ||
    BLOG_FONT_SIZE_OPTIONS[1];

  return (
    <section className="rounded-2xl border border-slate-200 bg-slate-50/80 p-6">
      <div className="mb-5">
        <h3 className="text-lg font-semibold text-slate-900">
          Blog Content Typography
        </h3>
        <p className="mt-1 text-sm text-slate-600">
          Choose the font style and reading size for the public blog content.
        </p>
      </div>

      <div className="space-y-6">
        <div>
          <p className="mb-3 text-sm font-medium text-slate-700">Font Style</p>
          <div className="grid gap-3 md:grid-cols-2">
            {BLOG_FONT_FAMILY_OPTIONS.map((option) => {
              const isActive = option.value === activeFontFamily.value;

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onFontFamilyChange(option.value)}
                  className={`rounded-2xl border px-4 py-4 text-left transition ${
                    isActive
                      ? "border-emerald-500 bg-white shadow-sm ring-2 ring-emerald-100"
                      : "border-slate-200 bg-white/80 hover:border-slate-300 hover:bg-white"
                  }`}
                >
                  <div
                    className="text-base font-semibold text-slate-900"
                    style={option.style}
                  >
                    {option.label}
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    {option.description}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <p className="mb-3 text-sm font-medium text-slate-700">Font Size</p>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {BLOG_FONT_SIZE_OPTIONS.map((option) => {
              const isActive = option.value === activeFontSize.value;

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onFontSizeChange(option.value)}
                  className={`rounded-2xl border px-4 py-4 text-left transition ${
                    isActive
                      ? "border-blue-500 bg-white shadow-sm ring-2 ring-blue-100"
                      : "border-slate-200 bg-white/80 hover:border-slate-300 hover:bg-white"
                  }`}
                >
                  <div className="font-semibold text-slate-900">
                    {option.label}
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    {option.description}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
            Reader Preview
          </p>
          <p
            className="text-slate-700"
            style={{
              ...activeFontFamily.style,
              ...activeFontSize.style,
            }}
          >
            {PREVIEW_TEXT}
          </p>
        </div>
      </div>
    </section>
  );
};

export default BlogTypographyControls;
