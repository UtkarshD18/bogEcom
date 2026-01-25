/**
 * ============================================
 * SITE CONFIGURATION - BUY ONE GRAM ECOMMERCE
 * ============================================
 *
 * This file contains all dynamic content that can be managed from admin panel.
 * In production, these values will come from the backend API.
 * For now, they serve as defaults and structure reference.
 */

// ========== SITE INFO ==========
export const siteConfig = {
  name: "Buy One Gram",
  tagline: "Your Health, Our Priority",
  description: "Premium quality health products delivered to your doorstep",
  logo: "/logo.png",
  favicon: "/favicon.ico",

  // Contact Information
  contact: {
    email: "support@buyonegram.com",
    phone: "+91 8619-641-968",
    whatsapp: "+918619641968",
    address: "Rajasthan Centre of Advanced Technology (R-CAT)",
  },

  // Social Media Links
  social: {
    facebook: "https://facebook.com/buyonegram",
    instagram: "https://instagram.com/buyonegram",
    twitter: "https://twitter.com/buyonegram",
    youtube: "https://youtube.com/buyonegram",
  },

  // SEO Defaults
  seo: {
    title: "Buy One Gram - Premium Health Products",
    description:
      "Shop premium health products, peanut butter, supplements and more",
    keywords: ["health products", "peanut butter", "organic", "supplements"],
    ogImage: "/og-image.jpg",
  },
};

// ========== NAVIGATION ==========
export const navigationConfig = {
  mainNav: [
    { name: "Home", link: "/", icon: null },
    { name: "Products", link: "/products", icon: null },
    { name: "Categories", link: "/category-list", icon: null },
    { name: "Blogs", link: "/blogs", icon: null },
    { name: "About Us", link: "/about-us", icon: null },
  ],

  footerNav: {
    products: [
      { name: "Prices Drop", link: "/prices-drop" },
      { name: "New Products", link: "/new-products" },
      { name: "Best Sales", link: "/best-sales" },
      { name: "Contact Us", link: "/contact" },
    ],
    company: [
      { name: "About Us", link: "/about-us" },
      { name: "Terms of Service", link: "/terms" },
      { name: "Privacy Policy", link: "/privacy" },
      { name: "FAQs", link: "/faqs" },
    ],
    account: [
      { name: "My Account", link: "/my-account" },
      { name: "My Orders", link: "/my-orders" },
      { name: "My Wishlist", link: "/my-list" },
      { name: "Track Order", link: "/track-order" },
    ],
  },
};

// ========== HOME PAGE SLIDES ==========
export const homeSlides = [
  {
    id: 1,
    image: "/slides/slide1.jpg",
    title: "Pure Nutrition",
    subtitle: "100% Natural Peanut Butter",
    cta: "Shop Now",
    link: "/products",
    isActive: true,
  },
  {
    id: 2,
    image: "/slides/slide2.jpg",
    title: "Fuel Your Fitness",
    subtitle: "High Protein • No Sugar",
    cta: "Explore",
    link: "/products?category=fitness",
    isActive: true,
  },
  {
    id: 3,
    image: "/slides/slide3.jpg",
    title: "Clean Eating",
    subtitle: "No Palm Oil • No Preservatives",
    cta: "Discover",
    link: "/about-us",
    isActive: true,
  },
];

// ========== CATEGORIES ==========
export const categories = [
  {
    id: 1,
    name: "Peanut Butter",
    slug: "peanut-butter",
    image: "/categories/peanut-butter.jpg",
    description: "Premium quality peanut butter",
    isActive: true,
  },
  {
    id: 2,
    name: "Supplements",
    slug: "supplements",
    image: "/categories/supplements.jpg",
    description: "Health supplements for daily nutrition",
    isActive: true,
  },
  {
    id: 3,
    name: "Protein",
    slug: "protein",
    image: "/categories/protein.jpg",
    description: "High-quality protein products",
    isActive: true,
  },
  {
    id: 4,
    name: "Organic Foods",
    slug: "organic-foods",
    image: "/categories/organic.jpg",
    description: "100% organic food products",
    isActive: true,
  },
  {
    id: 5,
    name: "Healthy Snacks",
    slug: "healthy-snacks",
    image: "/categories/snacks.jpg",
    description: "Guilt-free healthy snacking options",
    isActive: true,
  },
];

// ========== FEATURED PRODUCTS (Sample) ==========
export const featuredProducts = [
  {
    id: 1,
    name: "Classic Peanut Butter - Crunchy",
    slug: "classic-peanut-butter-crunchy",
    brand: "Buy One Gram",
    price: 349,
    originalPrice: 499,
    discount: 30,
    rating: 4.5,
    reviewCount: 128,
    image: "/products/product1.jpg",
    images: ["/products/product1.jpg", "/products/product1-2.jpg"],
    inStock: true,
    category: "peanut-butter",
    tags: ["bestseller", "featured"],
    description: "100% premium roasted peanuts, no added sugar",
  },
  {
    id: 2,
    name: "Chocolate Peanut Butter - Creamy",
    slug: "chocolate-peanut-butter-creamy",
    brand: "Buy One Gram",
    price: 399,
    originalPrice: 549,
    discount: 27,
    rating: 4.8,
    reviewCount: 95,
    image: "/products/product2.jpg",
    images: ["/products/product2.jpg"],
    inStock: true,
    category: "peanut-butter",
    tags: ["new", "featured"],
    description: "Rich chocolate flavor with premium peanuts",
  },
];

// ========== PROMO BANNERS ==========
export const promoBanners = [
  {
    id: 1,
    title: "Free Shipping",
    subtitle: "On orders above ₹500",
    icon: "shipping",
    isActive: true,
  },
  {
    id: 2,
    title: "7 Days Returns",
    subtitle: "Easy return policy",
    icon: "return",
    isActive: true,
  },
  {
    id: 3,
    title: "Secure Payment",
    subtitle: "100% secure checkout",
    icon: "secure",
    isActive: true,
  },
  {
    id: 4,
    title: "24/7 Support",
    subtitle: "Dedicated support team",
    icon: "support",
    isActive: true,
  },
];

// ========== MEMBERSHIP CONFIG ==========
export const membershipConfig = {
  title: "Join the Buy One Gram Club",
  description:
    "Become a member today to unlock exclusive rewards, early access to sales, and special member-only gifts.",
  benefits: [
    "10% off on all orders",
    "Early access to new products",
    "Exclusive member-only deals",
    "Free shipping on all orders",
    "Birthday special discounts",
  ],
  link: "/membership",
  ctaText: "Join Membership",
};

// ========== CURRENCY CONFIG ==========
export const currencyConfig = {
  code: "INR",
  symbol: "₹",
  position: "before", // 'before' or 'after'
  decimalPlaces: 0,
};

// ========== SHIPPING CONFIG ==========
export const shippingConfig = {
  freeShippingThreshold: 500,
  standardShippingCost: 40,
  expressShippingCost: 80,
  estimatedDelivery: {
    standard: "5-7 business days",
    express: "2-3 business days",
  },
};

// ========== HELPER FUNCTIONS ==========

/**
 * Format price with currency
 */
export const formatPrice = (price) => {
  const { symbol, position, decimalPlaces } = currencyConfig;
  const formattedPrice = price.toFixed(decimalPlaces);
  return position === "before"
    ? `${symbol}${formattedPrice}`
    : `${formattedPrice}${symbol}`;
};

/**
 * Calculate discount percentage
 */
export const calculateDiscount = (originalPrice, salePrice) => {
  return Math.round(((originalPrice - salePrice) / originalPrice) * 100);
};

/**
 * Check if product is in stock
 */
export const isInStock = (product) => {
  return product.inStock && product.quantity > 0;
};

/**
 * Get active slides only
 */
export const getActiveSlides = () => {
  return homeSlides.filter((slide) => slide.isActive);
};

/**
 * Get active categories
 */
export const getActiveCategories = () => {
  return categories.filter((cat) => cat.isActive);
};

/**
 * Get featured products
 */
export const getFeaturedProducts = () => {
  return featuredProducts.filter((p) => p.tags.includes("featured"));
};

/**
 * Get products by category
 */
export const getProductsByCategory = (categorySlug) => {
  return featuredProducts.filter((p) => p.category === categorySlug);
};

export default {
  siteConfig,
  navigationConfig,
  homeSlides,
  categories,
  featuredProducts,
  promoBanners,
  membershipConfig,
  currencyConfig,
  shippingConfig,
  formatPrice,
  calculateDiscount,
  isInStock,
  getActiveSlides,
  getActiveCategories,
  getFeaturedProducts,
  getProductsByCategory,
};
