import dotenv from "dotenv";
import mongoose from "mongoose";
dotenv.config();

import bcrypt from "bcryptjs";
import BannerModel from "./models/banner.model.js";
import CategoryModel from "./models/category.model.js";
import ComboModel from "./models/combo.model.js";
import ComboItemModel from "./models/comboItem.model.js";
import HomeSlideModel from "./models/homeSlide.model.js";
import ProductModel from "./models/product.model.js";
import UserModel from "./models/user.model.js";
import {
  buildComboItemsSnapshot,
  buildComboPricing,
  buildComboSkuFromItems,
  upsertComboItems,
} from "./services/combos/combo.service.js";
import { normalizeManagerPermissions } from "./utils/adminPermissions.js";

/**
 * Database Seeder
 *
 * Seeds initial data for peanut butter products.
 * Also creates an admin user if none exists.
 *
 * Usage: node seeder.js
 * Usage (destroy): node seeder.js -d
 */

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ MongoDB Connected");
  } catch (error) {
    console.error("❌ MongoDB connection error:", error);
    process.exit(1);
  }
};

const SEED_PUBLIC_IMAGES = [
  "/prodImage1.webp",
  "/prodImage2.webp",
  "/prodImage3.webp",
  "/product_1.webp",
];

const resolveSeedPublicImage = (index = 0) =>
  SEED_PUBLIC_IMAGES[index % SEED_PUBLIC_IMAGES.length];

const RAW_SEED_MANAGER_DEFAULT_PERMISSIONS = String(
  process.env.MANAGER_DEFAULT_PERMISSIONS || "",
).trim();
const HAS_SEED_MANAGER_DEFAULT_PERMISSIONS =
  RAW_SEED_MANAGER_DEFAULT_PERMISSIONS.length > 0;
const SEED_MANAGER_DEFAULT_PERMISSIONS = normalizeManagerPermissions(
  RAW_SEED_MANAGER_DEFAULT_PERMISSIONS.split(",")
    .map((permission) => permission.trim())
    .filter(Boolean),
);
const ADMIN_SEED_EMAIL = String(
  process.env.ADMIN_PRIMARY_EMAIL || "admin@buyonegram.com",
)
  .trim()
  .toLowerCase();
const MANAGER_SEED_EMAIL = String(
  process.env.MANAGER_PRIMARY_EMAIL || "manager@buyonegram.com",
)
  .trim()
  .toLowerCase();
const ADMIN_SEED_PASSWORD = String(
  process.env.ADMIN_PRIMARY_PASSWORD || "",
).trim();
const MANAGER_SEED_PASSWORD = String(
  process.env.MANAGER_PRIMARY_PASSWORD || "",
).trim();

// Peanut Butter Categories
const categories = [
  {
    name: "Classic Peanut Butter",
    slug: "classic-peanut-butter",
    description: "Traditional creamy and crunchy peanut butter",
    icon: "🥜",
    image: "/product_1.webp",
    isFeatured: true,
    isActive: true,
    sortOrder: 1,
  },
  {
    name: "Flavored Peanut Butter",
    slug: "flavored-peanut-butter",
    description: "Unique flavored peanut butter varieties",
    icon: "🍫",
    image: "/product_1.webp",
    isFeatured: true,
    isActive: true,
    sortOrder: 2,
  },
  {
    name: "Organic & Natural",
    slug: "organic-natural",
    description: "100% organic and all-natural peanut butter",
    icon: "🌿",
    image: "/product_1.webp",
    isFeatured: true,
    isActive: true,
    sortOrder: 3,
  },
  {
    name: "Protein Peanut Butter",
    slug: "protein-peanut-butter",
    description: "High protein peanut butter for fitness enthusiasts",
    icon: "💪",
    image: "/product_1.webp",
    isFeatured: true,
    isActive: true,
    sortOrder: 4,
  },
  {
    name: "Gift Packs",
    slug: "gift-packs",
    description: "Peanut butter gift sets and combos",
    icon: "🎁",
    image: "/product_1.webp",
    isFeatured: false,
    isActive: true,
    sortOrder: 5,
  },
];

// Peanut Butter Products
const products = [
  // Classic Peanut Butter
  {
    name: "Classic Creamy Peanut Butter",
    slug: "classic-creamy-peanut-butter",
    description:
      "Our signature creamy peanut butter made from premium roasted peanuts. Smooth texture, rich taste. No added sugar, no preservatives. Perfect for spreading on toast, making smoothies, or baking.",
    shortDescription: "Smooth & creamy, made from 100% roasted peanuts",
    brand: "Buy One Gram",
    price: 299,
    originalPrice: 399,
    stock: 150,
    rating: 4.8,
    numReviews: 245,
    isFeatured: true,
    isNewArrival: false,
    isBestSeller: true,
    tags: ["creamy", "classic", "bestseller", "no-sugar"],
    categorySlug: "classic-peanut-butter",
    weight: 500,
    unit: "g",
  },
  {
    name: "Classic Crunchy Peanut Butter",
    slug: "classic-crunchy-peanut-butter",
    description:
      "Crunchy peanut butter with real peanut chunks. Made from hand-picked peanuts, roasted to perfection. The perfect balance of smooth and crunchy. No added oils or preservatives.",
    shortDescription: "Crunchy texture with real peanut chunks",
    brand: "Buy One Gram",
    price: 349,
    originalPrice: 499,
    stock: 120,
    rating: 4.7,
    numReviews: 189,
    isFeatured: true,
    isNewArrival: false,
    isBestSeller: true,
    tags: ["crunchy", "classic", "bestseller", "chunky"],
    categorySlug: "classic-peanut-butter",
    weight: 500,
    unit: "g",
  },
  {
    name: "Classic Creamy - Large Pack",
    slug: "classic-creamy-large",
    description:
      "Family size classic creamy peanut butter. Same great taste, bigger jar. Perfect for peanut butter lovers.",
    shortDescription: "1kg family pack of our classic creamy",
    brand: "Buy One Gram",
    price: 549,
    originalPrice: 749,
    stock: 80,
    rating: 4.9,
    numReviews: 67,
    isFeatured: false,
    isNewArrival: false,
    tags: ["creamy", "family-pack", "value"],
    categorySlug: "classic-peanut-butter",
    weight: 1000,
    unit: "g",
  },

  // Flavored Peanut Butter
  {
    name: "Chocolate Peanut Butter",
    slug: "chocolate-peanut-butter",
    description:
      "Rich dark chocolate meets creamy peanut butter. Made with premium cocoa and roasted peanuts. A guilt-free indulgence with no added sugar.",
    shortDescription: "Dark chocolate + creamy peanut butter",
    brand: "Buy One Gram",
    price: 399,
    originalPrice: 549,
    stock: 100,
    rating: 4.9,
    numReviews: 312,
    isFeatured: true,
    isNewArrival: false,
    isBestSeller: true,
    tags: ["chocolate", "flavored", "bestseller", "indulgent"],
    categorySlug: "flavored-peanut-butter",
    weight: 350,
    unit: "g",
  },
  {
    name: "Honey Peanut Butter",
    slug: "honey-peanut-butter",
    description:
      "Natural honey blended with creamy peanut butter. Sweet, smooth, and absolutely delicious. Made with organic honey.",
    shortDescription: "Sweet honey meets creamy peanut butter",
    brand: "Buy One Gram",
    price: 379,
    originalPrice: 499,
    stock: 90,
    rating: 4.6,
    numReviews: 156,
    isFeatured: true,
    isNewArrival: true,
    tags: ["honey", "sweet", "flavored", "new"],
    categorySlug: "flavored-peanut-butter",
    weight: 350,
    unit: "g",
  },
  {
    name: "Maple Cinnamon Peanut Butter",
    slug: "maple-cinnamon-peanut-butter",
    description:
      "Warm cinnamon and pure maple syrup combined with our creamy peanut butter base. Perfect for fall mornings.",
    shortDescription: "Maple syrup + cinnamon + peanut butter",
    brand: "Buy One Gram",
    price: 429,
    originalPrice: 549,
    stock: 60,
    rating: 4.5,
    numReviews: 89,
    isFeatured: false,
    isNewArrival: true,
    tags: ["maple", "cinnamon", "seasonal", "new"],
    categorySlug: "flavored-peanut-butter",
    weight: 350,
    unit: "g",
  },
  {
    name: "Coffee Peanut Butter",
    slug: "coffee-peanut-butter",
    description:
      "Premium arabica coffee infused peanut butter. A morning game-changer. Rich, bold, and energizing.",
    shortDescription: "Arabica coffee infused peanut butter",
    brand: "Buy One Gram",
    price: 449,
    originalPrice: 599,
    stock: 50,
    rating: 4.4,
    numReviews: 45,
    isFeatured: false,
    isNewArrival: true,
    tags: ["coffee", "energizing", "unique", "new"],
    categorySlug: "flavored-peanut-butter",
    weight: 350,
    unit: "g",
  },

  // Organic & Natural
  {
    name: "Organic Peanut Butter - Unsweetened",
    slug: "organic-peanut-butter-unsweetened",
    description:
      "100% certified organic peanuts. Single ingredient. No salt, no sugar, no oil. Just pure peanuts, stone-ground to perfection.",
    shortDescription: "100% organic, single ingredient",
    brand: "Buy One Gram",
    price: 449,
    originalPrice: 599,
    stock: 70,
    rating: 4.7,
    numReviews: 134,
    isFeatured: true,
    isNewArrival: false,
    tags: ["organic", "natural", "unsweetened", "pure"],
    categorySlug: "organic-natural",
    weight: 400,
    unit: "g",
  },
  {
    name: "Stone Ground Natural Peanut Butter",
    slug: "stone-ground-natural",
    description:
      "Traditional stone-ground peanut butter with natural oil separation. Stir before use for the most authentic peanut butter experience.",
    shortDescription: "Traditional stone-ground, natural separation",
    brand: "Buy One Gram",
    price: 399,
    originalPrice: 499,
    stock: 80,
    rating: 4.6,
    numReviews: 98,
    isFeatured: false,
    isNewArrival: false,
    tags: ["stone-ground", "traditional", "natural"],
    categorySlug: "organic-natural",
    weight: 400,
    unit: "g",
  },

  // Protein Peanut Butter
  {
    name: "High Protein Peanut Butter",
    slug: "high-protein-peanut-butter",
    description:
      "32g protein per 100g. Enhanced with whey protein isolate. Perfect post-workout fuel for athletes and fitness enthusiasts.",
    shortDescription: "32g protein per 100g serving",
    brand: "Buy One Gram",
    price: 549,
    originalPrice: 749,
    stock: 90,
    rating: 4.8,
    numReviews: 203,
    isFeatured: true,
    isNewArrival: false,
    isBestSeller: true,
    tags: ["protein", "fitness", "gym", "post-workout"],
    categorySlug: "protein-peanut-butter",
    weight: 500,
    unit: "g",
  },
  {
    name: "Protein Peanut Butter - Chocolate",
    slug: "protein-peanut-butter-chocolate",
    description:
      "High protein meets chocolate indulgence. 30g protein per 100g with rich cocoa flavor. Guilt-free gains.",
    shortDescription: "30g protein + chocolate flavor",
    brand: "Buy One Gram",
    price: 599,
    originalPrice: 799,
    stock: 70,
    rating: 4.7,
    numReviews: 156,
    isFeatured: true,
    isNewArrival: false,
    tags: ["protein", "chocolate", "fitness", "indulgent"],
    categorySlug: "protein-peanut-butter",
    weight: 500,
    unit: "g",
  },

  // Gift Packs
  {
    name: "Peanut Butter Lovers Gift Box",
    slug: "peanut-butter-lovers-gift-box",
    description:
      "The ultimate gift for peanut butter lovers. Includes: Classic Creamy, Crunchy, Chocolate, and Honey variants. Beautifully packaged.",
    shortDescription: "4 flavors gift set - perfect gift",
    brand: "Buy One Gram",
    price: 1299,
    originalPrice: 1699,
    stock: 40,
    rating: 4.9,
    numReviews: 78,
    isFeatured: true,
    isNewArrival: false,
    tags: ["gift", "combo", "variety", "special"],
    categorySlug: "gift-packs",
    weight: 1400,
    unit: "g",
  },
  {
    name: "Fitness Pack - Protein Duo",
    slug: "fitness-pack-protein-duo",
    description:
      "2 jars of our best-selling protein peanut butter. Original and Chocolate. Perfect for gym enthusiasts.",
    shortDescription: "2x Protein Peanut Butter combo",
    brand: "Buy One Gram",
    price: 999,
    originalPrice: 1299,
    stock: 50,
    rating: 4.8,
    numReviews: 45,
    isFeatured: false,
    isNewArrival: true,
    tags: ["gift", "protein", "fitness", "combo"],
    categorySlug: "gift-packs",
    weight: 1000,
    unit: "g",
  },
];

// Home Slides for Peanut Butter Store
const homeSlides = [
  {
    title: "Pure Peanut Goodness",
    subtitle: "100% Natural",
    description:
      "Made from premium hand-picked peanuts. No added sugar, no preservatives. Just pure, delicious peanut butter.",
    image: "/slide_1.webp",
    buttonText: "Shop Now",
    buttonLink: "/products",
    textPosition: "left",
    isActive: true,
    sortOrder: 1,
  },
  {
    title: "New: Chocolate Peanut Butter",
    subtitle: "Bestseller",
    description:
      "Rich dark chocolate meets creamy peanut butter. Try our most loved flavor today!",
    image: "/slide_2.webp",
    buttonText: "Try Now",
    buttonLink: "/product/chocolate-peanut-butter",
    textPosition: "center",
    isActive: true,
    sortOrder: 2,
  },
  {
    title: "Fuel Your Workout",
    subtitle: "32g Protein",
    description:
      "High protein peanut butter for fitness enthusiasts. Power up your gains!",
    image: "/slide_3.webp",
    buttonText: "Shop Protein",
    buttonLink: "/products?category=protein-peanut-butter",
    textPosition: "right",
    isActive: true,
    sortOrder: 3,
  },
];

// Banners
const banners = [
  {
    title: "Free Delivery",
    subtitle: "On orders above ₹499",
    image: "/prodImage1.webp",
    link: "/products",
    position: "home-top",
    isActive: true,
    sortOrder: 1,
  },
  {
    title: "Subscribe & Save 10%",
    subtitle: "Monthly peanut butter delivery",
    image: "/prodImage2.webp",
    link: "/subscribe",
    position: "home-middle",
    isActive: true,
    sortOrder: 1,
  },
];

// Seed functions
const seedCategories = async () => {
  await CategoryModel.deleteMany({});
  const createdCategories = await CategoryModel.insertMany(categories);
  console.log(`✅ ${createdCategories.length} categories seeded`);
  return createdCategories;
};

const seedProducts = async (createdCategories) => {
  await ProductModel.deleteMany({});

  // Map category slugs to category IDs
  const categoryMap = {};
  for (const cat of createdCategories) {
    categoryMap[cat.slug] = cat._id;
  }

  // Add category IDs to products
  const productsWithCategories = products.map((product, index) => {
    const seededImage = resolveSeedPublicImage(index);
    return {
      name: product.name,
      slug: product.slug,
      description: product.description,
      shortDescription: product.shortDescription,
      brand: product.brand,
      price: product.price,
      originalPrice: product.originalPrice,
      discount: Math.round(
        ((product.originalPrice - product.price) / product.originalPrice) * 100,
      ),
      // Use local images from client public folder - admin can upload custom images
      images: [seededImage],
      thumbnail: seededImage,
      category: categoryMap[product.categorySlug],
      stock: product.stock,
      rating: product.rating,
      numReviews: product.numReviews,
      isFeatured: product.isFeatured || false,
      isNewArrival: product.isNewArrival || false,
      isBestSeller: product.isBestSeller || false,
      isOnSale: product.originalPrice > product.price,
      tags: product.tags,
      specifications: {
        Weight: `${product.weight}${product.unit}`,
        "Shelf Life": "6 months",
        Storage: "Store in a cool, dry place",
      },
      ingredients: "Roasted Peanuts",
      nutritionalInfo: {
        Protein: "25g per 100g",
        Fat: "50g per 100g",
        Carbs: "20g per 100g",
        Fiber: "8g per 100g",
      },
    };
  });

  const createdProducts = await ProductModel.insertMany(productsWithCategories);
  console.log(`✅ ${createdProducts.length} peanut butter products seeded`);

  // Update category product counts
  for (const category of createdCategories) {
    const count = await ProductModel.countDocuments({ category: category._id });
    await CategoryModel.findByIdAndUpdate(category._id, {
      productCount: count,
    });
  }

  return createdProducts;
};

const seedCombos = async (createdProducts = []) => {
  await ComboModel.deleteMany({});
  await ComboItemModel.deleteMany({});

  const productBySlug = new Map(
    (Array.isArray(createdProducts) ? createdProducts : []).map((product) => [
      String(product?.slug || "").trim(),
      product,
    ]),
  );

  const getProductId = (slug) => productBySlug.get(String(slug || ""))?._id;

  const comboSeeds = [
    {
      name: "Classic Duo Combo",
      slug: "classic-duo-combo",
      shortDescription: "Creamy + Crunchy â€” save more together",
      description:
        "Our two all-time classics bundled together for better value and everyday use.",
      tags: ["best_seller", "featured"],
      priority: 60,
      isFeatured: true,
      isBestSeller: true,
      pricing: { type: "percent_discount", value: 12 },
      items: [
        {
          productId: getProductId("classic-creamy-peanut-butter"),
          quantity: 1,
        },
        {
          productId: getProductId("classic-crunchy-peanut-butter"),
          quantity: 1,
        },
      ],
    },
    {
      name: "Breakfast Flavors Combo",
      slug: "breakfast-flavors-combo",
      shortDescription: "Chocolate + Honey + Maple Cinnamon bundle",
      description:
        "Three sweet favorites that go perfectly with toast, oats, and smoothies.",
      tags: ["trending", "recommended"],
      priority: 50,
      isFeatured: true,
      pricing: { type: "percent_discount", value: 10 },
      items: [
        { productId: getProductId("chocolate-peanut-butter"), quantity: 1 },
        { productId: getProductId("honey-peanut-butter"), quantity: 1 },
        {
          productId: getProductId("maple-cinnamon-peanut-butter"),
          quantity: 1,
        },
      ],
    },
    {
      name: "Protein Duo Combo",
      slug: "protein-duo-combo",
      shortDescription: "High Protein + Chocolate Protein pack",
      description:
        "A gym-friendly duo with extra protein â€” perfect for pre or post workout.",
      tags: ["high_demand", "featured"],
      priority: 45,
      isBestSeller: true,
      pricing: { type: "percent_discount", value: 15 },
      items: [
        { productId: getProductId("high-protein-peanut-butter"), quantity: 1 },
        {
          productId: getProductId("protein-peanut-butter-chocolate"),
          quantity: 1,
        },
      ],
    },
    {
      name: "Organic Essentials Combo",
      slug: "organic-essentials-combo",
      shortDescription: "Organic Unsweetened + Stone Ground bundle",
      description:
        "Two clean, single-ingredient picks for a more natural peanut butter routine.",
      tags: ["recommended"],
      priority: 40,
      pricing: { type: "percent_discount", value: 8 },
      items: [
        {
          productId: getProductId("organic-peanut-butter-unsweetened"),
          quantity: 1,
        },
        { productId: getProductId("stone-ground-peanut-butter"), quantity: 1 },
      ],
    },
  ];

  const createdCombos = [];

  for (const comboSeed of comboSeeds) {
    const filteredItems = (
      Array.isArray(comboSeed?.items) ? comboSeed.items : []
    ).filter((item) => item?.productId);
    if (filteredItems.length === 0) continue;

    const { snapshots } = await buildComboItemsSnapshot({
      items: filteredItems,
    });
    const pricing = comboSeed?.pricing || { type: "fixed_price", value: 0 };
    const pricingResult = buildComboPricing({ items: snapshots, pricing });
    const comboImage =
      snapshots.map((entry) => entry?.image).find(Boolean) || "";

    const combo = await ComboModel.create({
      name: comboSeed.name,
      slug: comboSeed.slug,
      shortDescription: comboSeed.shortDescription || "",
      description: comboSeed.description || "",
      brand: "Buy One Gram",
      sku: buildComboSkuFromItems(snapshots),
      comboType: "fixed_bundle",
      items: snapshots,
      pricing,
      comboImages: snapshots
        .map((entry) => entry?.image)
        .filter(Boolean)
        .slice(0, 6),
      comboThumbnail: comboImage,
      image: comboImage,
      thumbnail: comboImage,
      originalTotal: pricingResult.originalTotal,
      comboPrice: pricingResult.comboPrice,
      totalSavings: pricingResult.totalSavings,
      discountPercentage: pricingResult.discountPercentage,
      priority: Number(comboSeed.priority || 0),
      tags: Array.isArray(comboSeed.tags) ? comboSeed.tags : [],
      isFeatured: Boolean(comboSeed.isFeatured),
      isBestSeller: Boolean(comboSeed.isBestSeller),
      isActive: true,
      isVisible: true,
      status: "active",
    });

    await upsertComboItems(combo._id, snapshots);
    createdCombos.push(combo);
  }

  console.log(`âœ… ${createdCombos.length} combos seeded`);
};

// Seed home slides
const seedSlides = async () => {
  await HomeSlideModel.deleteMany({});
  const createdSlides = await HomeSlideModel.insertMany(homeSlides);
  console.log(`✅ ${createdSlides.length} home slides seeded`);
};

const seedBanners = async () => {
  await BannerModel.deleteMany({});
  const createdBanners = await BannerModel.insertMany(banners);
  console.log(`✅ ${createdBanners.length} banners seeded`);
};

const seedPrivilegedUser = async ({
  name,
  email,
  password,
  role,
  managerPermissions = null,
}) => {
  const normalizedEmail = String(email || "")
    .trim()
    .toLowerCase();
  if (!normalizedEmail) return;

  const existingUser = await UserModel.findOne({ email: normalizedEmail });
  const hashedPassword = await bcrypt.hash(password, 10);

  if (!existingUser) {
    const createdUser = await UserModel.create({
      name,
      email: normalizedEmail,
      password: hashedPassword,
      role,
      verifyEmail: true,
      status: "active",
      managerPermissions:
        role === "Manager"
          ? normalizeManagerPermissions(
              Array.isArray(managerPermissions) ? managerPermissions : [],
            )
          : [],
    });

    console.log(`✅ ${role} user created: ${createdUser.email}`);
    console.log(
      "   Password: [set in seeder script] (change this immediately!)",
    );
    return;
  }

  let didUpdate = false;
  if (existingUser.role !== role) {
    existingUser.role = role;
    didUpdate = true;
  }
  if (existingUser.verifyEmail !== true) {
    existingUser.verifyEmail = true;
    didUpdate = true;
  }
  if (existingUser.status !== "active") {
    existingUser.status = "active";
    didUpdate = true;
  }
  if (role === "Manager" && Array.isArray(managerPermissions)) {
    const normalized = normalizeManagerPermissions(managerPermissions);
    if (
      JSON.stringify(existingUser.managerPermissions || []) !==
      JSON.stringify(normalized)
    ) {
      existingUser.managerPermissions = normalized;
      didUpdate = true;
    }
  } else if (
    Array.isArray(existingUser.managerPermissions) &&
    existingUser.managerPermissions.length > 0
  ) {
    existingUser.managerPermissions = [];
    didUpdate = true;
  }
  if (!existingUser.password) {
    existingUser.password = hashedPassword;
    didUpdate = true;
  }

  if (didUpdate) {
    await existingUser.save();
    console.log(`✅ ${role} user updated: ${existingUser.email}`);
  } else {
    console.log(`ℹ️  ${role} user already exists: ${existingUser.email}`);
  }
};

const seedAdminUser = async () => {
  if (!ADMIN_SEED_PASSWORD) {
    console.log(
      "⚠️  Skipping Admin user seed: ADMIN_PRIMARY_PASSWORD is not set.",
    );
    return;
  }

  await seedPrivilegedUser({
    name: "Admin",
    email: ADMIN_SEED_EMAIL,
    password: ADMIN_SEED_PASSWORD,
    role: "Admin",
    managerPermissions: null,
  });
};

const seedManagerUser = async () => {
  if (!MANAGER_SEED_PASSWORD) {
    console.log(
      "⚠️  Skipping Manager user seed: MANAGER_PRIMARY_PASSWORD is not set.",
    );
    return;
  }

  await seedPrivilegedUser({
    name: "Manager",
    email: MANAGER_SEED_EMAIL,
    password: MANAGER_SEED_PASSWORD,
    role: "Manager",
    managerPermissions: HAS_SEED_MANAGER_DEFAULT_PERMISSIONS
      ? SEED_MANAGER_DEFAULT_PERMISSIONS
      : null,
  });
};

// Main seed function
const seedDatabase = async () => {
  try {
    await connectDB();

    console.log("\n🌱 Seeding database...\n");

    const createdCategories = await seedCategories();
    const createdProducts = await seedProducts(createdCategories);
    await seedCombos(createdProducts);
    await seedSlides();
    await seedBanners();
    await seedAdminUser();
    await seedManagerUser();

    console.log("\n✨ Database seeded successfully!\n");
    process.exit(0);
  } catch (error) {
    console.error("❌ Seeding error:", error);
    process.exit(1);
  }
};

// Destroy function
const destroyData = async () => {
  try {
    await connectDB();

    console.log("\n🗑️  Destroying data...\n");

    await CategoryModel.deleteMany({});
    await ProductModel.deleteMany({});
    await ComboModel.deleteMany({});
    await ComboItemModel.deleteMany({});
    await HomeSlideModel.deleteMany({});
    await BannerModel.deleteMany({});

    console.log("✅ All data destroyed (except users)\n");
    process.exit(0);
  } catch (error) {
    console.error("❌ Destroy error:", error);
    process.exit(1);
  }
};

// Check command line arguments
if (process.argv[2] === "-d" || process.argv[2] === "--destroy") {
  destroyData();
} else {
  seedDatabase();
}
