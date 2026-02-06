import CategoryModel from "../models/category.model.js";
import ProductModel from "../models/product.model.js";

const isProduction = process.env.NODE_ENV === "production";
// Debug-only logging to keep production output clean
const debugLog = (...args) => {
  if (!isProduction) {
    console.log(...args);
  }
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
      exclude,
    } = req.query;

    // Build filter object
    const filter = { isActive: true };

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
    if (inStock === "true") filter.stock = { $gt: 0 };

    // Exclude specific product
    if (exclude) {
      filter._id = { $ne: exclude };
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

    if (!product) {
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

    const products = await ProductModel.find({
      isActive: true,
      isFeatured: true,
    })
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
 * Get related products by category
 * @route GET /api/products/:id/related
 */
export const getRelatedProducts = async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 5 } = req.query;

    const product = await ProductModel.findById(id);
    if (!product) {
      return res.status(404).json({
        error: true,
        success: false,
        message: "Product not found",
      });
    }

    const relatedProducts = await ProductModel.find({
      _id: { $ne: id },
      category: product.category,
      isActive: true,
    })
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
      demandStatus,
      specifications,
      ingredients,
      freeShipping,
      metaTitle,
      metaDescription,
      metaKeywords,
    } = req.body;

    // Validate required fields
    if (!name || !price || !category) {
      return res.status(400).json({
        error: true,
        success: false,
        message: "Name, price, and category are required",
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
    const product = new ProductModel({
      name,
      description,
      shortDescription,
      brand,
      price,
      originalPrice,
      images: images || [],
      thumbnail,
      category,
      subCategory,
      sku,
      stock: stock || 0,
      hasVariants: hasVariants || false,
      variants: variants || [],
      variantType,
      weight,
      unit,
      tags: tags || [],
      isFeatured: isFeatured || false,
      isNewArrival: isNewArrival || false,
      demandStatus: demandStatus || "NORMAL",
      specifications,
      ingredients,
      freeShipping: freeShipping || false,
      metaTitle,
      metaDescription,
      metaKeywords,
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

    const product = await ProductModel.findById(id);
    if (!product) {
      return res.status(404).json({
        error: true,
        success: false,
        message: "Product not found",
      });
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
        variant.stock = stock;
      }
    } else {
      product.stock = stock;
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
