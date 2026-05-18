import Link from "next/link";
import { notFound } from "next/navigation";

const QA_ITEMS = [
  {
    title: "Homepage Product Listing",
    result: "Pass",
    detail:
      "Verified with a backend-created non-live product that appeared in listing and detail responses.",
  },
  {
    title: "New Product With Missing Optional Fields",
    result: "Pass",
    detail:
      "Product still loaded correctly with defaults instead of breaking the page.",
  },
  {
    title: "Variant Add To Cart",
    result: "Pass",
    detail:
      "Only valid variant selections are accepted, and stock limits are enforced.",
  },
  {
    title: "Unavailable Stock Protection",
    result: "Pass",
    detail:
      "Add-to-cart rejects unavailable quantity instead of silently adding more.",
  },
  {
    title: "Manual Order Status Change",
    result: "Blocked",
    detail:
      "Admin and Manager manual status changes are disabled. Status is intended to come from payment and shipping events.",
  },
  {
    title: "Dispatched Filter",
    result: "Ready",
    detail:
      "Dispatched orders have a dedicated filter and green status presentation in admin.",
  },
];

const TEST_PRODUCTS = [
  "Backend Created Test Product",
  "Cart Variant Product",
  "Cart Variant Required Product",
  "Reservation Product",
  "Pay Order Product",
  "Expiry Release Product",
  "Webhook Success Product",
  "Stored Details Product",
  "Manual Status Block Product",
];

const SLIDER_IMAGES = [
  "slide_1.webp - 3011x1343",
  "slide_2.webp - 3019x1343",
  "slide_3.webp - 3007x1343",
];

export const metadata = {
  title: "Demo Live QA Preview",
  description: "Local-only QA showcase for non-live testing evidence.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function DemoLivePage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#fbf4eb_0%,#fffaf5_30%,#ffffff_100%)] text-[#24150f]">
      <section className="mx-auto max-w-6xl px-6 py-10 md:py-14">
        <div className="rounded-[32px] border border-[#ead8c8] bg-white/90 p-8 shadow-[0_30px_90px_-50px_rgba(62,35,18,0.35)] backdrop-blur">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="max-w-3xl">
              <span className="inline-flex rounded-full bg-[#f7e8d8] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#8a5b18]">
                Local Only
              </span>
              <h1 className="mt-4 text-4xl font-semibold tracking-tight md:text-5xl">
                Non-Live QA Demo
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-8 text-[#6a5548]">
                This page is for local boss review only. No live product was
                created. All evidence below comes from non-live test data and
                local demo routes.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/product/demo-live"
                className="inline-flex items-center justify-center rounded-full bg-[#8a5b18] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#704712]"
              >
                Open Product Demo
              </Link>
              <Link
                href="/products"
                className="inline-flex items-center justify-center rounded-full border border-[#dbc2a4] bg-[#fff8ef] px-5 py-3 text-sm font-semibold text-[#8a5b18] transition hover:bg-[#fbeedb]"
              >
                Open Catalog
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1.2fr)_360px]">
          <section className="rounded-[32px] border border-[#ead8c8] bg-white p-7 shadow-sm">
            <h2 className="text-2xl font-semibold">QA Result Summary</h2>
            <div className="mt-6 grid gap-4">
              {QA_ITEMS.map((item) => (
                <article
                  key={item.title}
                  className="rounded-[24px] border border-[#f0e3d5] bg-[#fffaf4] p-5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="text-lg font-semibold">{item.title}</h3>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] ${
                        item.result === "Pass"
                          ? "bg-[#dcfce7] text-[#166534]"
                          : item.result === "Blocked"
                            ? "bg-[#fee2e2] text-[#b91c1c]"
                            : "bg-[#fef3c7] text-[#92400e]"
                      }`}
                    >
                      {item.result}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-7 text-[#6a5548]">
                    {item.detail}
                  </p>
                </article>
              ))}
            </div>
          </section>

          <aside className="space-y-6">
            <section className="rounded-[32px] border border-[#ead8c8] bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold">Test Product Names</h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {TEST_PRODUCTS.map((name) => (
                  <span
                    key={name}
                    className="rounded-full border border-[#ead8c8] bg-[#fff8ef] px-3 py-1.5 text-sm text-[#5f4a3e]"
                  >
                    {name}
                  </span>
                ))}
              </div>
            </section>

            <section className="rounded-[32px] border border-[#ead8c8] bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold">Slider Image Quality</h2>
              <div className="mt-4 grid gap-3">
                {SLIDER_IMAGES.map((item) => (
                  <div
                    key={item}
                    className="rounded-2xl border border-[#f0e3d5] bg-[#fffaf4] px-4 py-3 text-sm text-[#5f4a3e]"
                  >
                    {item}
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-[32px] border border-dashed border-[#d7bea0] bg-[#fff6eb] p-6">
              <h2 className="text-xl font-semibold">Important Note</h2>
              <p className="mt-3 text-sm leading-7 text-[#6a5548]">
                This route is available only outside production. It is intended
                for local demonstration and internal review.
              </p>
            </section>
          </aside>
        </div>
      </section>
    </main>
  );
}
