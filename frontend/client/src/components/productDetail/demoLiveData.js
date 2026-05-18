"use client";

export const DEMO_PRODUCT_ID = "demo-live";

const demoProduct = {
  _id: DEMO_PRODUCT_ID,
  name: "Clean Whey Protein (Isolate), 2.2 lb Chocolate",
  title: "Clean Whey Protein (Isolate), 2.2 lb Chocolate",
  brand: "Healthy One Gram Labs",
  price: 4099,
  originalPrice: 4799,
  rating: 4.8,
  adminStarRating: 4.8,
  reviewCount: 148,
  shortDescription:
    "A polished product page with layered imagery, stronger CTAs, and review cards positioned closer to the buying moment.",
  description: `
    <p><strong>Pure protein. Cleaner storytelling. Better conversion energy.</strong></p>
    <p>This page is designed to feel closer to a premium DTC product detail experience. The layout gives the main product image more presence, keeps pricing and purchase controls highly visible, and adds richer description content that feels editorial instead of plain.</p>
    <p>Shoppers can move from image discovery to variant selection, delivery preview, feature scanning, and social proof without losing context. The result is a more confident, more visual product page that feels ready for a modern wellness or nutrition catalog.</p>
  `,
  sku: "CWPI-2200-CHOC-DEMO",
  category: {
    _id: "demo-protein",
    name: "Protein Range",
  },
  hasVariants: true,
  variants: [
    {
      _id: "demo-37lb",
      name: "0.37 lb Travel Pack - 5 Sachets",
      sku: "CWPI-TRAVEL",
      price: 899,
      originalPrice: 999,
      weight: 0.37,
      unit: "lb",
      stock: 14,
      stock_quantity: 14,
    },
    {
      _id: "demo-22lb",
      name: "2.2 lb",
      sku: "CWPI-2200",
      price: 4099,
      originalPrice: 4799,
      weight: 2.2,
      unit: "lb",
      isDefault: true,
      stock: 26,
      stock_quantity: 26,
    },
    {
      _id: "demo-refill",
      name: "2.20 lb Refill Pack",
      sku: "CWPI-2200-REFILL",
      price: 3699,
      originalPrice: 4299,
      weight: 2.2,
      unit: "lb",
      stock: 18,
      stock_quantity: 18,
    },
  ],
  images: [
    "/prodImage1.webp",
    "/prodImage2.webp",
    "/prodImage3.webp",
    "/product_1.webp",
  ],
};

const demoReviews = [
  {
    _id: "demo-review-1",
    userName: "Riya S.",
    city: "Jaipur",
    rating: 5,
    comment:
      "This layout feels premium and easy to trust. The images and descriptions finally look like a real flagship product page.",
    createdAt: "2026-04-11T10:00:00.000Z",
    avatar: "/Profile1.webp",
  },
  {
    _id: "demo-review-2",
    userName: "Aman K.",
    city: "Delhi",
    rating: 5,
    comment:
      "The new structure is much clearer. Variant selection, pricing, and the review section all feel closer to what shoppers expect on strong ecommerce brands.",
    createdAt: "2026-04-09T10:00:00.000Z",
    avatar: "/profile2.webp",
  },
  {
    _id: "demo-review-3",
    userName: "Neha P.",
    city: "Mumbai",
    rating: 4,
    comment:
      "Big improvement on mobile. The page looks richer, the CTA block is easier to scan, and the description area does not feel empty anymore.",
    createdAt: "2026-04-07T10:00:00.000Z",
    avatar: "/pfp2.png",
  },
  {
    _id: "demo-review-4",
    userName: "Varun M.",
    city: "Bengaluru",
    rating: 5,
    comment:
      "The page feels much more polished now. Images, pricing, and reviews all sit in a more natural order.",
    createdAt: "2026-04-05T10:00:00.000Z",
    avatar: "/Profile1.webp",
  },
];

export const DEMO_FLAVORS = ["Chocolate", "Coffee", "Vanilla"];

export const DEMO_TABS = [
  { id: "description", label: "Description" },
  { id: "details", label: "Nutrition Information" },
  { id: "shipping", label: "Trust & Safety" },
];

export const DEMO_STAT_CARDS = [
  {
    label: "Protein Per Scoop",
    value: "28g",
    helper: "Hero stat presentation",
  },
  {
    label: "Added Sugar",
    value: "Zero",
    helper: "Demo nutrition card",
  },
  {
    label: "Mixability",
    value: "Smooth",
    helper: "Quick everyday use",
  },
  {
    label: "Proof Layer",
    value: "Reviews + CTA",
    helper: "Conversion-first layout",
  },
];

export const DEMO_SNAPSHOT = [
  "Designed as a premium demo of the upgraded storefront product detail experience.",
  "Uses layered visuals, strong spacing, and clear purchase actions inspired by modern wellness brands.",
  "Balances editorial storytelling with transactional clarity so the page feels beautiful and useful.",
];

export const DEMO_SHIPPING_POINTS = [
  "Enter any six-digit pincode to preview delivery timing in the layout.",
  "CTA buttons stay prominent and readable across desktop and mobile breakpoints.",
  "Trust points and reviews sit close to the buy section to reduce hesitation.",
];

export const DEMO_STORY = {
  eyebrow: "Demo Live Experience",
  title: "Because a great product page should sell with clarity, not clutter.",
  caption:
    "This refreshed product detail view gives imagery, narrative, trust, and buying actions their own breathing room.",
};

export const buildDemoProduct = () => ({
  ...demoProduct,
  category: { ...demoProduct.category },
  variants: demoProduct.variants.map((variant) => ({ ...variant })),
  images: [...demoProduct.images],
});

export const buildDemoReviews = () =>
  demoReviews.map((review) => ({ ...review }));
