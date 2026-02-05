import CategoryModel from "../models/category.model.js";
import ProductModel from "../models/product.model.js";

/**
 * Category Controller
 *
 * CRUD operations for categories (Admin)
 * Public operations for viewing categories
 */

// ==================== PUBLIC ENDPOINTS ====================

/**
 * Get all categories
 * @route GET /api/categories
 */
export const getCategories = async (req, res) => {
  try {
    const {
      parent,
      featured,
      active = "true",
      flat = "false",
      includeProductCount = "true",
    } = req.query;

    const filter = {};

    // Filter by parent (null for root categories)
    if (parent === "null" || parent === "root") {
      filter.parentCategory = null;
    } else if (parent) {
      filter.parentCategory = parent;
    }

    // Filter by featured
    if (featured === "true") {
      filter.isFeatured = true;
    }

    // Filter by active status
    if (active === "true") {
      filter.isActive = true;
    }

    let query = CategoryModel.find(filter).sort({ sortOrder: 1, name: 1 });

    // Populate subcategories if not flat view
    if (flat !== "true") {
      query = query.populate({
        path: "subcategories",
        match: { isActive: true },
        options: { sort: { sortOrder: 1 } },
      });
    }

    const categories = await query.lean();

    res.status(200).json({
      error: false,
      success: true,
      data: categories,
      total: categories.length,
    });
  } catch (error) {
    console.error("Error fetching categories:", error);
    res.status(500).json({
      error: true,
      success: false,
      message: "Failed to fetch categories",
      details: error.message,
    });
  }
};

/**
 * Get single category by ID or slug
 * @route GET /api/categories/:id
 */
export const getCategoryById = async (req, res) => {
  try {
    const { id } = req.params;

    let category;
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      category = await CategoryModel.findById(id)
        .populate({
          path: "subcategories",
          match: { isActive: true },
        })
        .populate("parentCategory", "name slug");
    } else {
      category = await CategoryModel.findOne({ slug: id })
        .populate({
          path: "subcategories",
          match: { isActive: true },
        })
        .populate("parentCategory", "name slug");
    }

    if (!category) {
      return res.status(404).json({
        error: true,
        success: false,
        message: "Category not found",
      });
    }

    res.status(200).json({
      error: false,
      success: true,
      data: category,
    });
  } catch (error) {
    res.status(500).json({
      error: true,
      success: false,
      message: "Failed to fetch category",
    });
  }
};

/**
 * Get category tree (hierarchical structure)
 * @route GET /api/categories/tree
 */
export const getCategoryTree = async (req, res) => {
  try {
    const rootCategories = await CategoryModel.find({
      parentCategory: null,
      isActive: true,
    })
      .sort({ sortOrder: 1 })
      .lean();

    // Recursively build tree
    const buildTree = async (categories) => {
      const tree = [];
      for (const cat of categories) {
        const children = await CategoryModel.find({
          parentCategory: cat._id,
          isActive: true,
        })
          .sort({ sortOrder: 1 })
          .lean();

        tree.push({
          ...cat,
          children: children.length > 0 ? await buildTree(children) : [],
        });
      }
      return tree;
    };

    const categoryTree = await buildTree(rootCategories);

    res.status(200).json({
      error: false,
      success: true,
      data: categoryTree,
    });
  } catch (error) {
    res.status(500).json({
      error: true,
      success: false,
      message: "Failed to fetch category tree",
    });
  }
};

// ==================== ADMIN ENDPOINTS ====================

/**
 * Create new category (Admin only)
 * @route POST /api/categories
 */
export const createCategory = async (req, res) => {
  try {
    const {
      name,
      slug,
      description,
      image,
      icon,
      parentCategory,
      isFeatured,
      sortOrder,
      metaTitle,
      metaDescription,
      metaKeywords,
    } = req.body;

    if (!name) {
      return res.status(400).json({
        error: true,
        success: false,
        message: "Category name is required",
      });
    }

    // Generate slug if not provided
    const categorySlug =
      slug ||
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");

    // Check if slug already exists
    const existingCategory = await CategoryModel.findOne({
      slug: categorySlug,
    });
    if (existingCategory) {
      return res.status(400).json({
        error: true,
        success: false,
        message: "Category with this slug already exists",
      });
    }

    // Determine level based on parent
    let level = 0;
    if (parentCategory) {
      const parent = await CategoryModel.findById(parentCategory);
      if (parent) {
        level = parent.level + 1;
      }
    }

    const category = new CategoryModel({
      name,
      slug: categorySlug,
      description,
      image,
      icon,
      parentCategory: parentCategory || null,
      level,
      isFeatured: isFeatured || false,
      sortOrder: sortOrder || 0,
      metaTitle,
      metaDescription,
      metaKeywords,
    });

    await category.save();

    res.status(201).json({
      error: false,
      success: true,
      message: "Category created successfully",
      data: category,
    });
  } catch (error) {
    console.error("Error creating category:", error);
    res.status(500).json({
      error: true,
      success: false,
      message: "Failed to create category",
      details: error.message,
    });
  }
};

/**
 * Update category (Admin only)
 * @route PUT /api/categories/:id
 */
export const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Remove fields that shouldn't be updated directly
    delete updateData._id;
    delete updateData.productCount;

    const category = await CategoryModel.findById(id);
    if (!category) {
      return res.status(404).json({
        error: true,
        success: false,
        message: "Category not found",
      });
    }

    // If parent is being changed, update level
    if (updateData.parentCategory !== undefined) {
      if (updateData.parentCategory) {
        const parent = await CategoryModel.findById(updateData.parentCategory);
        updateData.level = parent ? parent.level + 1 : 0;
      } else {
        updateData.level = 0;
      }
    }

    const updatedCategory = await CategoryModel.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true },
    );

    res.status(200).json({
      error: false,
      success: true,
      message: "Category updated successfully",
      data: updatedCategory,
    });
  } catch (error) {
    res.status(500).json({
      error: true,
      success: false,
      message: "Failed to update category",
      details: error.message,
    });
  }
};

/**
 * Delete category (Admin only)
 * @route DELETE /api/categories/:id
 */
export const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { moveProductsTo, deleteProducts } = req.query;

    const category = await CategoryModel.findById(id);
    if (!category) {
      return res.status(404).json({
        error: true,
        success: false,
        message: "Category not found",
      });
    }

    // Check for subcategories
    const subcategories = await CategoryModel.find({ parentCategory: id });
    if (subcategories.length > 0) {
      return res.status(400).json({
        error: true,
        success: false,
        message:
          "Cannot delete category with subcategories. Delete subcategories first.",
      });
    }

    // Handle products in this category
    const productsInCategory = await ProductModel.countDocuments({
      category: id,
    });
    if (productsInCategory > 0) {
      if (moveProductsTo) {
        await ProductModel.updateMany(
          { category: id },
          { category: moveProductsTo },
        );
        await CategoryModel.findByIdAndUpdate(moveProductsTo, {
          $inc: { productCount: productsInCategory },
        });
      } else if (deleteProducts === "true") {
        await ProductModel.deleteMany({ category: id });
      } else {
        return res.status(400).json({
          error: true,
          success: false,
          message: `Category has ${productsInCategory} products. Specify moveProductsTo or deleteProducts=true`,
        });
      }
    }

    await CategoryModel.findByIdAndDelete(id);

    res.status(200).json({
      error: false,
      success: true,
      message: "Category deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      error: true,
      success: false,
      message: "Failed to delete category",
    });
  }
};

/**
 * Reorder categories (Admin only)
 * @route PATCH /api/categories/reorder
 */
export const reorderCategories = async (req, res) => {
  try {
    const { categories } = req.body; // Array of { id, sortOrder }

    if (!Array.isArray(categories)) {
      return res.status(400).json({
        error: true,
        success: false,
        message: "Categories array is required",
      });
    }

    const bulkOps = categories.map((cat) => ({
      updateOne: {
        filter: { _id: cat.id },
        update: { $set: { sortOrder: cat.sortOrder } },
      },
    }));

    await CategoryModel.bulkWrite(bulkOps);

    res.status(200).json({
      error: false,
      success: true,
      message: "Categories reordered successfully",
    });
  } catch (error) {
    res.status(500).json({
      error: true,
      success: false,
      message: "Failed to reorder categories",
    });
  }
};

export default {
  getCategories,
  getCategoryById,
  getCategoryTree,
  createCategory,
  updateCategory,
  deleteCategory,
  reorderCategories,
};
