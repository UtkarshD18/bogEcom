import mongoose from "mongoose";
import CategoryModel from "../models/category.model.js";
import ProductModel from "../models/product.model.js";
import { checkExclusiveAccess } from "../middlewares/membershipGuard.js";

const isProduction = process.env.NODE_ENV === "production";
// Debug-only logging to keep production output clean
const debugLog = (...args) => {
  if (!isProduction) {
    console.log(...args);
  }
};

const canRequestViewExclusive = async (req) => {
  if (req?.userIsAdmin === true || req?.membershipActive === true) {
    return true;
  }
  if (!req?.user) {
    return false;
  }
  return checkExclusiveAccess(req.user);
};

const toBoolean = (value) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    return value.trim().toLowerCase() === "true";
  }
  return Boolean(value);
};

/**
 * Product Controller
 *
 * CRUD operations for products (Admin)
 * Public operations for viewing products
 */

// ==================== PUBLIC ENDPOINTS ====================

/**
 * Get all products with filtering, sorting, and pagination
 * @route GET /api/products
 */
export const getProducts = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 15,
      search,
      category,
      subCategory,
      brand,
      minPrice,
      maxPrice,
      rating,
      sortBy = "createdAt",
      order = "desc",
      featured,
      newArrivals,
      onSale,
      inStock,
      lowStock,
      exclude,
    } = req.query;

    const canViewExclusive = req?.userIsAdmin === true;

    // Build filter object
    const filter = { isActive: true };
    // Exclusive products are never part of normal storefront listings.
    // Only admins can include them in this endpoint for dashboard management.
    if (!canViewExclusive) {
      filter.isExclusive = { $ne: true };
    }
    const exprFilters = [];

    // Debug: Count all products first
    const totalAllProducts = await ProductModel.countDocuments({});
    const totalActiveProducts = await ProductModel.countDocuments({
      isActive: true,
    });
    debugLog(
      "[Product Search] Total products in DB:",
      totalAllProducts,
      "Active:",
      totalActiveProducts,
    );

    // Text search - supports 1+ character partial matching with regex
    if (search && search.trim().length >= 1) {
      const searchTerm = search.trim();

      // Sanitize search term to prevent ReDoS attacks
      // Escape special regex characters
      const sanitizedTerm = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const searchRegex = new RegExp(sanitizedTerm, "i");

      debugLog(
        "[Product Search] Searching for:",
        searchTerm,
        "Regex:",
        searchRegex,
      );

      // Find categories matching the search term to include products in those categories
      const matchingCategories = await CategoryModel.find({
        name: { $regex: searchRegex },
      })
        .select("_id")
        .lean();
      const categoryIds = matchingCategories.map((c) => c._id);

      debugLog(
        "[Product Search] Matching categories:",
        matchingCategories.length,
      );

      // Build search conditions
      const searchConditions = [
        { name: { $regex: searchRegex } },
        { brand: { $regex: searchRegex } },
        { tags: { $elemMatch: { $regex: searchRegex } } },
      ];

      // Add category match if any categories match the search
      if (categoryIds.length > 0) {
        searchConditions.push({ category: { $in: categoryIds } });
      }

      // For longer queries, also search description
      if (searchTerm.length >= 3) {
        searchConditions.push({ description: { $regex: searchRegex } });
      }

      filter.$or = searchConditions;

      debugLog("[Product Search] Filter:", JSON.stringify(filter));

      // Debug: Test the name search directly
      const nameMatchTest = await ProductModel.find({
        name: { $regex: searchRegex },
        isActive: true,
      })
        .select("name")
        .limit(5)
        .lean();
      debugLog(
        "[Product Search] Direct name match test:",
        nameMatchTest.map((p) => p.name),
      );
    }

    // Category filter - support both ObjectId and slug
    if (category) {
      // Check if it's a valid ObjectId
      const mongoose = (await import("mongoose")).default;
      const isValidObjectId = mongoose.Types.ObjectId.isValid(category);

      if (isValidObjectId) {
        if (category.includes(",")) {
          filter.category = { $in: category.split(",") };
        } else {
          filter.category = category;
        }
      } else {
        // It's a slug - look up the category by slug
        const categoryDoc = await CategoryModel.findOne({ slug: category });
        if (categoryDoc) {
          filter.category = categoryDoc._id;
        } else {
          // Try to find by name (case-insensitive)
          const categoryByName = await CategoryModel.findOne({
            name: { $regex: new RegExp(`^${category}$`, "i") },
          });
          if (categoryByName) {
            filter.category = categoryByName._id;
          }
        }
      }
    }

    if (subCategory) {
      filter.subCategory = subCategory;
    }

    // Brand filter
    if (brand) {
      filter.brand = { $regex: brand, $options: "i" };
    }

    // Price range
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = Number(minPrice);
      if (maxPrice) filter.price.$lte = Number(maxPrice);
    }

    // Rating filter
    if (rating) {
      filter.rating = { $gte: Number(rating) };
    }

    // Boolean filters
    if (featured === "true") filter.isFeatured = true;
    if (newArrivals === "true") filter.isNewArrival = true;
    if (onSale === "true") filter.isOnSale = true;
    if (inStock === "true") {
      exprFilters.push({
        $gt: [
          {
            $subtract: [
              { $ifNull: ["$stock_quantity", "$stock"] },
              { $ifNull: ["$reserved_quantity", 0] },
            ],
          },
          0,
        ],
      });
    }

    if (lowStock === "true") {
      const thresholdExpr = {
        $ifNull: [
          "$low_stock_threshold",
          { $ifNull: ["$lowStockThreshold", 5] },
        ],
      };
      const trackExpr = {
        $ne: [
          {
            $ifNull: [
              "$track_inventory",
              { $ifNull: ["$trackInventory", true] },
            ],
          },
          false,
        ],
      };
      const productAvailableExpr = {
        $subtract: [
          { $ifNull: ["$stock_quantity", "$stock"] },
          { $ifNull: ["$reserved_quantity", 0] },
        ],
      };
      const variantAvailableExpr = {
        $map: {
          input: { $ifNull: ["$variants", []] },
          as: "v",
          in: {
            $subtract: [
              { $ifNull: ["$$v.stock_quantity", "$$v.stock"] },
              { $ifNull: ["$$v.reserved_quantity", 0] },
            ],
          },
        },
      };
      exprFilters.push({
        $and: [
          trackExpr,
          {
            $cond: [
              { $eq: ["$hasVariants", true] },
              {
                $anyElementTrue: {
                  $map: {
                    input: variantAvailableExpr,
                    as: "available",
                    in: { $lte: ["$$available", thresholdExpr] },
                  },
                },
              },
              { $lte: [productAvailableExpr, thresholdExpr] },
            ],
          },
        ],
      });
    }

    // Exclude specific product
    if (exclude) {
      filter._id = { $ne: exclude };
    }

    if (exprFilters.length > 0) {
      filter.$expr =
        exprFilters.length === 1 ? exprFilters[0] : { $and: exprFilters };
    }

    // Build sort object
    const sortOptions = {};
    sortOptions[sortBy] = order === "asc" ? 1 : -1;

    // Execute query
    const skip = (Number(page) - 1) * Number(limit);

    const [products, totalProducts] = await Promise.all([
      ProductModel.find(filter)
        .populate("category", "name slug")
        .populate("subCategory", "name slug")
        .select("-reviews -description") // Exclude heavy fields for list view
        .sort(sortOptions)
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      ProductModel.countDocuments(filter),
    ]);

    debugLog("[Product Search] Found:", totalProducts, "products");
    if (search && products.length > 0) {
      debugLog("[Product Search] First result:", products[0]?.name);
    }

    const totalPages = Math.ceil(totalProducts / Number(limit));

    res.status(200).json({
      error: false,
      success: true,
      data: products,
      totalProducts,
      totalPages,
      currentPage: Number(page),
      hasNextPage: Number(page) < totalPages,
      hasPrevPage: Number(page) > 1,
    });
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).json({
      error: true,
      success: false,
      message: "Failed to fetch products",
      details: error.message,
    });
  }
};

/**
 * Get single product by ID or slug
 * @route GET /api/products/:id
 */
export const getProductById = async (req, res) => {
  try {
    const { id } = req.params;
    const canViewExclusive = await canRequestViewExclusive(req);

    // Try to find by ID or slug
    let product;
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      product = await ProductModel.findById(id)
        .populate("category", "name slug")
        .populate("subCategory", "name slug")
        .populate("reviews.user", "name avatar");
    } else {
      product = await ProductModel.findOne({ slug: id, isActive: true })
        .populate("category", "name slug")
        .populate("subCategory", "name slug")
        .populate("reviews.user", "name avatar");
    }

    if (!product || (product.isExclusive && !canViewExclusive)) {
      return res.status(404).json({
        error: true,
        success: false,
        message: "Product not found",
      });
    }

    // Increment view count using updateOne to avoid triggering save middleware
    await ProductModel.updateOne(
      { _id: product._id },
      { $inc: { viewCount: 1 } },
    );

    res.status(200).json({
      error: false,
      success: true,
      data: product,
    });
  } catch (error) {
    console.error("Error fetching product:", error);
    res.status(500).json({
      error: true,
      success: false,
      message: "Failed to fetch product",
      details: error.message,
    });
  }
};

/**
 * Get featured products
 * @route GET /api/products/featured
 */
export const getFeaturedProducts = async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const canViewExclusive = req?.userIsAdmin === true;

    const filter = {
      isActive: true,
      isFeatured: true,
      ...(canViewExclusive ? {} : { isExclusive: { $ne: true } }),
    };

    const products = await ProductModel.find(filter)
      .populate("category", "name slug")
      .select("-reviews -description")
      .sort({ sortOrder: 1, createdAt: -1 })
      .limit(Number(limit))
      .lean();

    res.status(200).json({
      error: false,
      success: true,
      data: products,
    });
  } catch (error) {
    res.status(500).json({
      error: true,
      success: false,
      message: "Failed to fetch featured products",
    });
  }
};

/**
 * Get exclusive products for active members only
 * @route GET /api/products/exclusive
 */
export const getExclusiveProducts = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 15,
      search = "",
      sortBy = "createdAt",
      order = "desc",
    } = req.query;

    const safePage = Math.max(Number(page) || 1, 1);
    const safeLimit = Math.min(Math.max(Number(limit) || 15, 1), 100);
    const skip = (safePage - 1) * safeLimit;

    const filter = {
      isActive: true,
      isExclusive: true,
    };

    const searchTerm = String(search || "").trim();
    if (searchTerm) {
      const escapedTerm = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(escapedTerm, "i");
      filter.$or = [
        { name: { $regex: regex } },
        { brand: { $regex: regex } },
        { tags: { $elemMatch: { $regex: regex } } },
      ];
    }

    const sortOptions = { [sortBy]: order === "asc" ? 1 : -1 };

    const [products, totalProducts] = await Promise.all([
      ProductModel.find(filter)
        .populate("category", "name slug")
        .populate("subCategory", "name slug")
        .select("-reviews -description")
        .sort(sortOptions)
        .skip(skip)
        .limit(safeLimit)
        .lean(),
      ProductModel.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(totalProducts / safeLimit) || 1;

    res.status(200).json({
      error: false,
      success: true,
      data: products,
      totalProducts,
      totalPages,
      currentPage: safePage,
      hasNextPage: safePage < totalPages,
      hasPrevPage: safePage > 1,
    });
  } catch (error) {
    console.error("Error fetching exclusive products:", error);
    res.status(500).json({
      error: true,
      success: false,
      message: "Failed to fetch exclusive products",
      details: error.message,
    });
  }
};

/**
 * Get related products by category
 * @route GET /api/products/:id/related
 */
export const getRelatedProducts = async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 5 } = req.query;
    const canViewExclusive = await canRequestViewExclusive(req);

    const product = await ProductModel.findById(id);
    if (!product || (product.isExclusive && !canViewExclusive)) {
      return res.status(404).json({
        error: true,
        success: false,
        message: "Product not found",
      });
    }

    const relatedFilter = {
      _id: { $ne: id },
      category: product.category,
      isActive: true,
      ...(canViewExclusive ? {} : { isExclusive: { $ne: true } }),
    };

    const relatedProducts = await ProductModel.find(relatedFilter)
      .select("-reviews -description")
      .limit(Number(limit))
      .lean();

    res.status(200).json({
      error: false,
      success: true,
      data: relatedProducts,
    });
  } catch (error) {
    res.status(500).json({
      error: true,
      success: false,
      message: "Failed to fetch related products",
    });
  }
};

// ==================== ADMIN ENDPOINTS ====================

/**
 * Create new product (Admin only)
 * @route POST /api/products
 */
export const createProduct = async (req, res) => {
  try {
    const {
      name,
      description,
      shortDescription,
      brand,
      price,
      originalPrice,
      images,
      thumbnail,
      category,
      subCategory,
      sku,
      stock,
      hasVariants,
      variants,
      variantType,
      weight,
      unit,
      tags,
      isFeatured,
      isNewArrival,
      isExclusive,
      demandStatus,
      specifications,
      ingredients,
      freeShipping,
      metaTitle,
      metaDescription,
      metaKeywords,
      discount,
      rating,
    } = req.body;

    // Validate required fields
    if (!name || price === undefined || price === null || !category) {
      return res.status(400).json({
        error: true,
        success: false,
        message: "Name, price, and category are required",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(category)) {
      return res.status(400).json({
        error: true,
        success: false,
        message: "Invalid category",
      });
    }

    if (subCategory && !mongoose.Types.ObjectId.isValid(subCategory)) {
      return res.status(400).json({
        error: true,
        success: false,
        message: "Invalid subcategory",
      });
    }

    const normalizedPrice = Number(price);
    if (!Number.isFinite(normalizedPrice) || normalizedPrice <= 0) {
      return res.status(400).json({
        error: true,
        success: false,
        message: "Please enter a valid price",
      });
    }

    // Check if category exists
    const categoryExists = await CategoryModel.findById(category);
    if (!categoryExists) {
      return res.status(400).json({
        error: true,
        success: false,
        message: "Invalid category",
      });
    }

    // Create product
    const normalizedStock = Number(stock ?? req.body?.stock_quantity ?? 0);
    const normalizedReserved = Number(req.body?.reserved_quantity ?? 0);
    const normalizedLowStock = Number(
      req.body?.low_stock_threshold ?? req.body?.lowStockThreshold ?? 5,
    );
    const normalizedTrackInventory =
      typeof req.body?.track_inventory === "boolean"
        ? req.body.track_inventory
        : typeof req.body?.trackInventory === "boolean"
          ? req.body.trackInventory
          : true;

    // Validate variants if present
    let processedVariants = variants || [];
    if (hasVariants && Array.isArray(processedVariants) && processedVariants.length > 0) {
      // Check for duplicate weights
      const weightKeys = processedVariants.map((v) => `${v.weight || 0}-${v.unit || "g"}`);
      const uniqueWeights = new Set(weightKeys);
      if (uniqueWeights.size !== weightKeys.length) {
        return res.status(400).json({
          error: true,
          success: false,
          message: "Duplicate variant weights are not allowed",
        });
      }
      // Ensure exactly one default
      const defaults = processedVariants.filter((v) => v.isDefault);
      if (defaults.length === 0) {
        processedVariants[0].isDefault = true;
      } else if (defaults.length > 1) {
        processedVariants.forEach((v, i) => { v.isDefault = i === processedVariants.indexOf(defaults[0]); });
      }
    }

    const product = new ProductModel({
      name: String(name || "").trim(),
      description,
      shortDescription,
      brand,
      price: normalizedPrice,
      originalPrice:
        originalPrice === undefined || originalPrice === null
          ? undefined
          : Number(originalPrice),
      images: images || [],
      thumbnail,
      category,
      subCategory,
      sku,
      stock: normalizedStock,
      stock_quantity: normalizedStock,
      reserved_quantity: Math.max(normalizedReserved, 0),
      low_stock_threshold: normalizedLowStock,
      track_inventory: normalizedTrackInventory,
      hasVariants: hasVariants || false,
      variants: processedVariants,
      variantType,
      weight,
      unit,
      tags: tags || [],
      isFeatured: isFeatured || false,
      isNewArrival: isNewArrival || false,
      isExclusive: toBoolean(isExclusive),
      demandStatus: demandStatus || "NORMAL",
      specifications,
      ingredients,
      freeShipping: freeShipping || false,
      metaTitle,
      metaDescription,
      metaKeywords,
      discount: discount ? Number(discount) : 0,
      rating: rating === undefined || rating === null ? undefined : rating,
      adminStarRating:
        rating === undefined || rating === null ? undefined : Number(rating),
    });

    await product.save();

    // Update category product count
    await CategoryModel.findByIdAndUpdate(category, {
      $inc: { productCount: 1 },
    });

    res.status(201).json({
      error: false,
      success: true,
      message: "Product created successfully",
      data: product,
    });
  } catch (error) {
    console.error("Error creating product:", error);

    if (error.name === "ValidationError") {
      const firstValidationError = Object.values(error.errors || {})[0];
      return res.status(400).json({
        error: true,
        success: false,
        message: firstValidationError?.message || "Invalid product data",
      });
    }

    // Handle duplicate key error
    if (error.code === 11000) {
      return res.status(400).json({
        error: true,
        success: false,
        message: "Product with this SKU or slug already exists",
      });
    }

    res.status(500).json({
      error: true,
      success: false,
      message: "Failed to create product",
      details: error.message,
    });
  }
};

/**
 * Update product (Admin only)
 * @route PUT /api/products/:id
 */
export const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Remove fields that shouldn't be updated directly
    delete updateData._id;
    delete updateData.createdAt;
    delete updateData.viewCount;
    delete updateData.soldCount;

    if ("stock" in updateData && !("stock_quantity" in updateData)) {
      updateData.stock_quantity = updateData.stock;
    }
    if ("stock_quantity" in updateData && !("stock" in updateData)) {
      updateData.stock = updateData.stock_quantity;
    }
    if (
      "low_stock_threshold" in updateData &&
      !("lowStockThreshold" in updateData)
    ) {
      updateData.lowStockThreshold = updateData.low_stock_threshold;
    }
    if ("track_inventory" in updateData && !("trackInventory" in updateData)) {
      updateData.trackInventory = updateData.track_inventory;
    }
    if ("adminStarRating" in updateData && !("rating" in updateData)) {
      updateData.rating = updateData.adminStarRating;
    }
    if ("rating" in updateData && !("adminStarRating" in updateData)) {
      updateData.adminStarRating = updateData.rating;
    }

    const product = await ProductModel.findById(id);
    if (!product) {
      return res.status(404).json({
        error: true,
        success: false,
        message: "Product not found",
      });
    }

    // Validate variants if being updated
    if (updateData.hasVariants && Array.isArray(updateData.variants) && updateData.variants.length > 0) {
      // Check for duplicate weights
      const weightKeys = updateData.variants.map((v) => `${v.weight || 0}-${v.unit || "g"}`);
      const uniqueWeights = new Set(weightKeys);
      if (uniqueWeights.size !== weightKeys.length) {
        return res.status(400).json({
          error: true,
          success: false,
          message: "Duplicate variant weights are not allowed",
        });
      }
      // Ensure exactly one default
      const defaults = updateData.variants.filter((v) => v.isDefault);
      if (defaults.length === 0) {
        updateData.variants[0].isDefault = true;
      } else if (defaults.length > 1) {
        updateData.variants.forEach((v, i) => {
          v.isDefault = i === updateData.variants.indexOf(defaults[0]);
        });
      }
    }

    // If category is being changed, update product counts
    if (
      updateData.category &&
      updateData.category !== product.category.toString()
    ) {
      await CategoryModel.findByIdAndUpdate(product.category, {
        $inc: { productCount: -1 },
      });
      await CategoryModel.findByIdAndUpdate(updateData.category, {
        $inc: { productCount: 1 },
      });
    }

    const updatedProduct = await ProductModel.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true },
    ).populate("category", "name slug");

    res.status(200).json({
      error: false,
      success: true,
      message: "Product updated successfully",
      data: updatedProduct,
    });
  } catch (error) {
    console.error("Error updating product:", error);
    res.status(500).json({
      error: true,
      success: false,
      message: "Failed to update product",
      details: error.message,
    });
  }
};

/**
 * Delete product (Admin only)
 * @route DELETE /api/products/:id
 */
export const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await ProductModel.findById(id);
    if (!product) {
      return res.status(404).json({
        error: true,
        success: false,
        message: "Product not found",
      });
    }

    // Update category product count
    await CategoryModel.findByIdAndUpdate(product.category, {
      $inc: { productCount: -1 },
    });

    await ProductModel.findByIdAndDelete(id);

    res.status(200).json({
      error: false,
      success: true,
      message: "Product deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting product:", error);
    res.status(500).json({
      error: true,
      success: false,
      message: "Failed to delete product",
      details: error.message,
    });
  }
};

/**
 * Bulk update products (Admin only)
 * @route PATCH /api/products/bulk
 */
export const bulkUpdateProducts = async (req, res) => {
  try {
    const { ids, updateData } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        error: true,
        success: false,
        message: "Product IDs are required",
      });
    }

    if ("stock" in updateData && !("stock_quantity" in updateData)) {
      updateData.stock_quantity = updateData.stock;
    }
    if ("stock_quantity" in updateData && !("stock" in updateData)) {
      updateData.stock = updateData.stock_quantity;
    }
    if (
      "low_stock_threshold" in updateData &&
      !("lowStockThreshold" in updateData)
    ) {
      updateData.lowStockThreshold = updateData.low_stock_threshold;
    }
    if ("track_inventory" in updateData && !("trackInventory" in updateData)) {
      updateData.trackInventory = updateData.track_inventory;
    }
    if ("adminStarRating" in updateData && !("rating" in updateData)) {
      updateData.rating = updateData.adminStarRating;
    }
    if ("rating" in updateData && !("adminStarRating" in updateData)) {
      updateData.adminStarRating = updateData.rating;
    }

    const result = await ProductModel.updateMany(
      { _id: { $in: ids } },
      { $set: updateData },
    );

    res.status(200).json({
      error: false,
      success: true,
      message: `${result.modifiedCount} products updated`,
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      error: true,
      success: false,
      message: "Failed to bulk update products",
    });
  }
};

/**
 * Update product stock (Admin only)
 * @route PATCH /api/products/:id/stock
 */
export const updateStock = async (req, res) => {
  try {
    const { id } = req.params;
    const { stock, variantId } = req.body;
    const normalizedStock = Number(stock ?? 0);

    const product = await ProductModel.findById(id);
    if (!product) {
      return res.status(404).json({
        error: true,
        success: false,
        message: "Product not found",
      });
    }

    if (variantId) {
      // Update variant stock
      const variant = product.variants.id(variantId);
      if (variant) {
        variant.stock = normalizedStock;
        variant.stock_quantity = normalizedStock;
      }
    } else {
      product.stock = normalizedStock;
      product.stock_quantity = normalizedStock;
    }

    await product.save();

    res.status(200).json({
      error: false,
      success: true,
      message: "Stock updated successfully",
      data: product,
    });
  } catch (error) {
    res.status(500).json({
      error: true,
      success: false,
      message: "Failed to update stock",
    });
  }
};

// ==================== REVIEW ENDPOINTS ====================

/**
 * Add product review
 * @route POST /api/products/:id/reviews
 */
export const addReview = async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, title, comment, images } = req.body;
    const userId = req.user;

    const product = await ProductModel.findById(id);
    if (!product) {
      return res.status(404).json({
        error: true,
        success: false,
        message: "Product not found",
      });
    }

    // Check if user already reviewed
    const existingReview = product.reviews.find(
      (r) => r.user.toString() === userId,
    );
    if (existingReview) {
      return res.status(400).json({
        error: true,
        success: false,
        message: "You have already reviewed this product",
      });
    }

    // Get user name
    const UserModel = (await import("../models/user.model.js")).default;
    const user = await UserModel.findById(userId);

    product.reviews.push({
      user: userId,
      userName: user?.name || "Anonymous",
      rating,
      title,
      comment,
      images: images || [],
    });

    await product.calculateAverageRating();

    res.status(201).json({
      error: false,
      success: true,
      message: "Review added successfully",
      data: product.reviews[product.reviews.length - 1],
    });
  } catch (error) {
    res.status(500).json({
      error: true,
      success: false,
      message: "Failed to add review",
    });
  }
};

/**
 * Delete review (User can delete own review, Admin can delete any)
 * @route DELETE /api/products/:id/reviews/:reviewId
 */
export const deleteReview = async (req, res) => {
  try {
    const { id, reviewId } = req.params;
    const userId = req.user;

    const product = await ProductModel.findById(id);
    if (!product) {
      return res.status(404).json({
        error: true,
        success: false,
        message: "Product not found",
      });
    }

    const review = product.reviews.id(reviewId);
    if (!review) {
      return res.status(404).json({
        error: true,
        success: false,
        message: "Review not found",
      });
    }

    // Check ownership (or admin)
    // Note: Admin check would need to be added based on your auth middleware
    if (review.user.toString() !== userId) {
      return res.status(403).json({
        error: true,
        success: false,
        message: "Not authorized to delete this review",
      });
    }

    product.reviews.pull(reviewId);
    await product.calculateAverageRating();

    res.status(200).json({
      error: false,
      success: true,
      message: "Review deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      error: true,
      success: false,
      message: "Failed to delete review",
    });
  }
};

/**
 * Update product demand status (Admin only)
 * @route PATCH /api/products/:id/demand
 */
export const updateDemandStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { demandStatus } = req.body;

    // Validate demandStatus
    if (!demandStatus || !["NORMAL", "HIGH"].includes(demandStatus)) {
      return res.status(400).json({
        error: true,
        success: false,
        message: "Invalid demandStatus. Must be 'NORMAL' or 'HIGH'",
      });
    }

    const product = await ProductModel.findByIdAndUpdate(
      id,
      { demandStatus },
      { new: true, runValidators: true },
    );

    if (!product) {
      return res.status(404).json({
        error: true,
        success: false,
        message: "Product not found",
      });
    }

    res.status(200).json({
      error: false,
      success: true,
      message: `Product demand status updated to ${demandStatus}`,
      data: product,
    });
  } catch (error) {
    console.error("Update demand status error:", error);
    res.status(500).json({
      error: true,
      success: false,
      message: "Failed to update demand status",
    });
  }
};

export default {
  getProducts,
  getProductById,
  getFeaturedProducts,
  getExclusiveProducts,
  getRelatedProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  bulkUpdateProducts,
  updateStock,
  addReview,
  deleteReview,
  updateDemandStatus,
};
