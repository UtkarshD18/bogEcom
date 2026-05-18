import Image from "next/image";
import Link from "next/link";

const siteUrl = String(
  process.env.NEXT_PUBLIC_SITE_URL || "https://healthyonegram.com",
)
  .trim()
  .replace(/^["']|["']$/g, "")
  .replace(/\/+$/, "");

const pagePath = "/healthy-peanut-butter-guide";
const pageUrl = `${siteUrl}${pagePath}`;
const heroImage = "/slide_1.webp";

export const metadata = {
  title: "Healthy Peanut Butter Guide | Healthy One Gram",
  description:
    "Explore how to choose healthy peanut butter, simple protein-rich snack ideas, ingredient tips, and everyday shopping options from Healthy One Gram.",
  keywords: [
    "healthy peanut butter",
    "protein peanut butter",
    "natural peanut butter",
    "peanut butter breakfast ideas",
    "healthy snacks India",
    "Healthy One Gram",
  ],
  alternates: {
    canonical: pageUrl,
  },
  openGraph: {
    title: "Healthy Peanut Butter Guide | Healthy One Gram",
    description:
      "A practical guide to healthy peanut butter, protein-friendly meal ideas, and shopping smarter at Healthy One Gram.",
    url: pageUrl,
    type: "article",
    locale: "en_IN",
    siteName: "Healthy One Gram",
    images: [
      {
        url: heroImage,
        width: 1365,
        height: 768,
        alt: "Healthy One Gram peanut butter jar beside toasted bread and fresh fruit on a kitchen table",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Healthy Peanut Butter Guide | Healthy One Gram",
    description:
      "Ingredient tips, snack ideas, and shopping guidance for healthy peanut butter buyers.",
    images: [heroImage],
  },
};

const quickFacts = [
  {
    title: "Simple ingredient focus",
    body:
      "Many shoppers start by checking whether roasted peanuts lead the label and whether added oils or heavy sweeteners stay minimal.",
  },
  {
    title: "Protein-friendly routine",
    body:
      "Peanut butter can fit breakfast, pre-workout, office snacks, and quick evening bites when paired with fruit, toast, oats, or smoothies.",
  },
  {
    title: "Flexible shopping",
    body:
      "Single jars, combo deals, and membership perks make it easier to choose between daily staples and larger repeat orders.",
  },
];

const snackIdeas = [
  "Spread peanut butter on multigrain toast with banana slices for a fast breakfast.",
  "Blend a spoonful into oats or smoothies for a creamier texture and richer taste.",
  "Pair it with apple slices or berries for a simple midday snack.",
  "Use combo packs when you want to compare formats, gifting options, or value bundles.",
];

const faqItems = [
  {
    question: "What should I look for in healthy peanut butter?",
    answer:
      "Start with ingredient clarity, texture preference, and how you plan to use it. Many buyers prefer options centered on roasted peanuts with straightforward labeling.",
  },
  {
    question: "Can peanut butter fit a protein-focused diet?",
    answer:
      "It can support a protein-focused routine when used as part of a balanced meal or snack alongside foods like oats, fruit, yogurt, or whole-grain bread.",
  },
  {
    question: "Where can I browse Healthy One Gram products and offers?",
    answer:
      "You can explore the main product catalog, combo deals, membership benefits, and blog content directly from the Healthy One Gram site.",
  },
];

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Article",
      headline: "Healthy Peanut Butter Guide",
      description:
        "A practical Healthy One Gram guide covering ingredients, protein-friendly snack ideas, and related shopping options.",
      image: `${siteUrl}${heroImage}`,
      author: {
        "@type": "Organization",
        name: "Healthy One Gram",
      },
      publisher: {
        "@type": "Organization",
        name: "Healthy One Gram",
        logo: {
          "@type": "ImageObject",
          url: `${siteUrl}/logo-og-v2.png`,
        },
      },
      mainEntityOfPage: pageUrl,
      datePublished: "2026-04-28",
      dateModified: "2026-04-28",
    },
    {
      "@type": "FAQPage",
      mainEntity: faqItems.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: item.answer,
        },
      })),
    },
  ],
};

export default function HealthyPeanutButterGuidePage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(251,191,36,0.24),_transparent_34%),linear-gradient(180deg,_#fffaf0_0%,_#ffffff_42%,_#f6f8ec_100%)] text-stone-900">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-16 left-0 h-48 w-48 rounded-full bg-amber-200/40 blur-3xl" />
          <div className="absolute top-24 right-0 h-56 w-56 rounded-full bg-lime-200/35 blur-3xl" />
        </div>

        <div className="relative mx-auto grid max-w-6xl gap-10 px-4 pb-12 pt-12 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:pb-16 lg:pt-16">
          <div>
            <p className="inline-flex rounded-full border border-amber-200 bg-white/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-amber-800 shadow-sm">
              Search-ready landing page
            </p>
            <h1 className="mt-5 max-w-3xl text-4xl font-black tracking-tight text-stone-950 sm:text-5xl lg:text-6xl">
              Healthy peanut butter, simple ingredients, and better daily snack ideas.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-8 text-stone-700 sm:text-lg">
              This guide is built for search discovery and for real visitors. It
              explains what many shoppers check before buying peanut butter, how
              to use it through the day, and where Healthy One Gram collections,
              combo packs, and membership offers fit in.
            </p>

            <div className="mt-8 flex flex-wrap gap-3 text-sm font-medium">
              <Link
                href="/products"
                className="rounded-full bg-stone-950 px-5 py-3 text-white transition hover:bg-stone-800"
              >
                Browse products
              </Link>
              <Link
                href="/combo-deals"
                className="rounded-full border border-stone-300 bg-white/85 px-5 py-3 text-stone-800 transition hover:border-stone-400"
              >
                View combo deals
              </Link>
              <Link
                href="/membership"
                className="rounded-full border border-amber-300 bg-amber-50 px-5 py-3 text-amber-900 transition hover:bg-amber-100"
              >
                Check membership
              </Link>
            </div>
          </div>

          <div className="relative">
            <div className="absolute inset-0 rounded-[2rem] bg-gradient-to-br from-amber-200/50 via-white/40 to-lime-200/50 blur-2xl" />
            <div className="relative overflow-hidden rounded-[2rem] border border-white/70 bg-white/80 p-3 shadow-[0_25px_70px_rgba(68,44,12,0.12)] backdrop-blur">
              <div className="relative aspect-[16/11] overflow-hidden rounded-[1.5rem]">
                <Image
                  src={heroImage}
                  alt="Healthy One Gram peanut butter jar beside toasted bread and fresh fruit on a kitchen table"
                  fill
                  priority
                  className="object-cover"
                  sizes="(max-width: 1024px) 100vw, 42vw"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-4 sm:px-6 sm:py-8">
        <div className="grid gap-4 md:grid-cols-3">
          {quickFacts.map((fact) => (
            <article
              key={fact.title}
              className="rounded-[1.75rem] border border-stone-200/70 bg-white/85 p-6 shadow-sm backdrop-blur"
            >
              <h2 className="text-lg font-bold text-stone-900">{fact.title}</h2>
              <p className="mt-3 text-sm leading-7 text-stone-700">
                {fact.body}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr]">
          <article className="rounded-[2rem] border border-stone-200/70 bg-white/90 p-7 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">
              Buying guide
            </p>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-stone-950">
              How many shoppers decide which peanut butter feels right
            </h2>
            <div className="mt-5 space-y-4 text-sm leading-7 text-stone-700">
              <p>
                Search visitors often land on pages like this because they want
                something more useful than a list of keywords. They want quick
                guidance on ingredients, taste, texture, and everyday use.
              </p>
              <p>
                A healthy peanut butter page usually performs better when it
                helps people compare choices naturally: ingredient simplicity,
                practical serving ideas, and easy links into the real catalog.
              </p>
              <p>
                That is why this page stays readable, indexable, and relevant
                instead of hiding text from normal visitors.
              </p>
            </div>
          </article>

          <article className="rounded-[2rem] border border-lime-200/70 bg-[linear-gradient(180deg,_rgba(236,253,245,0.92),_rgba(255,255,255,0.96))] p-7 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-lime-800">
              Everyday use
            </p>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-stone-950">
              Simple ways to fit peanut butter into breakfast and snack routines
            </h2>
            <ul className="mt-6 space-y-3 text-sm leading-7 text-stone-700">
              {snackIdeas.map((idea) => (
                <li
                  key={idea}
                  className="rounded-2xl border border-white/70 bg-white/75 px-4 py-3"
                >
                  {idea}
                </li>
              ))}
            </ul>
          </article>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
        <div className="rounded-[2rem] border border-stone-200/70 bg-stone-950 px-6 py-8 text-stone-50 shadow-[0_20px_60px_rgba(28,25,23,0.18)] sm:px-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-300">
            Explore the site
          </p>
          <h2 className="mt-3 text-3xl font-black tracking-tight">
            Useful pages for search visitors who want to keep going
          </h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Link
              href="/products"
              className="rounded-[1.5rem] border border-white/10 bg-white/5 p-5 transition hover:bg-white/10"
            >
              <span className="text-lg font-bold">Products</span>
              <span className="mt-2 block text-sm leading-7 text-stone-300">
                Browse the main catalog for peanut butter and other healthy food options.
              </span>
            </Link>
            <Link
              href="/combo-deals"
              className="rounded-[1.5rem] border border-white/10 bg-white/5 p-5 transition hover:bg-white/10"
            >
              <span className="text-lg font-bold">Combo deals</span>
              <span className="mt-2 block text-sm leading-7 text-stone-300">
                Check bundled offers when shoppers want variety or better pack value.
              </span>
            </Link>
            <Link
              href="/membership"
              className="rounded-[1.5rem] border border-white/10 bg-white/5 p-5 transition hover:bg-white/10"
            >
              <span className="text-lg font-bold">Membership</span>
              <span className="mt-2 block text-sm leading-7 text-stone-300">
                See member-only benefits, pricing, and premium shopping perks.
              </span>
            </Link>
            <Link
              href="/blogs"
              className="rounded-[1.5rem] border border-white/10 bg-white/5 p-5 transition hover:bg-white/10"
            >
              <span className="text-lg font-bold">Blogs</span>
              <span className="mt-2 block text-sm leading-7 text-stone-300">
                Read longer-form educational content that supports product discovery.
              </span>
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="rounded-[2rem] border border-stone-200/70 bg-white/90 p-7 shadow-sm sm:p-9">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">
            FAQ
          </p>
          <h2 className="mt-3 text-3xl font-black tracking-tight text-stone-950">
            Common questions around healthy peanut butter shopping
          </h2>
          <div className="mt-6 space-y-4">
            {faqItems.map((item) => (
              <article
                key={item.question}
                className="rounded-[1.5rem] border border-stone-200/80 bg-stone-50 px-5 py-4"
              >
                <h3 className="text-base font-bold text-stone-900">
                  {item.question}
                </h3>
                <p className="mt-2 text-sm leading-7 text-stone-700">
                  {item.answer}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
