import { deleteFromCloudinary } from "../config/cloudinary.js";
import BlogModel from "../models/blog.model.js";
import { extractPublicIdFromUrl } from "../utils/imageUtils.js";

/**
 * Get all published blogs (public)
 */
export const getAllBlogs = async (req, res) => {
  try {
    const { page = 1, limit = 10, category, search } = req.query;
    const skip = (page - 1) * limit;

    let query = { isPublished: true };

    if (category) {
      query.category = category;
    }

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { excerpt: { $regex: search, $options: "i" } },
        { content: { $regex: search, $options: "i" } },
      ];
    }

    const blogs = await BlogModel.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    const totalBlogs = await BlogModel.countDocuments(query);

    res.status(200).json({
      error: false,
      success: true,
      data: blogs,
      totalBlogs,
      totalPages: Math.ceil(totalBlogs / limit),
      currentPage: Number(page),
    });
  } catch (error) {
    console.error("Error fetching blogs:", error);
    res.status(500).json({
      error: true,
      success: false,
      message: "Failed to fetch blogs",
    });
  }
};

/**
 * Get single blog by slug (public)
 */
export const getBlogBySlug = async (req, res) => {
  try {
    const { slug } = req.params;

    const blog = await BlogModel.findOne({ slug, isPublished: true });

    if (!blog) {
      return res.status(404).json({
        error: true,
        success: false,
        message: "Blog not found",
      });
    }

    // Increment view count
    blog.viewCount += 1;
    await blog.save();

    res.status(200).json({
      error: false,
      success: true,
      data: blog,
    });
  } catch (error) {
    console.error("Error fetching blog:", error);
    res.status(500).json({
      error: true,
      success: false,
      message: "Failed to fetch blog",
    });
  }
};

/**
 * Get single blog by ID (Admin - for editing)
 */
export const getBlogById = async (req, res) => {
  try {
    const { id } = req.params;

    const blog = await BlogModel.findById(id);

    if (!blog) {
      return res.status(404).json({
        error: true,
        success: false,
        message: "Blog not found",
      });
    }

    res.status(200).json({
      error: false,
      success: true,
      blog: blog,
    });
  } catch (error) {
    console.error("Error fetching blog:", error);
    res.status(500).json({
      error: true,
      success: false,
      message: "Failed to fetch blog",
    });
  }
};

/**
 * Get all blogs including drafts (Admin only)
 */
export const getAllBlogsAdmin = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const blogs = await BlogModel.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    const totalBlogs = await BlogModel.countDocuments();

    res.status(200).json({
      error: false,
      success: true,
      data: blogs,
      totalBlogs,
      totalPages: Math.ceil(totalBlogs / limit),
    });
  } catch (error) {
    console.error("Error fetching blogs:", error);
    res.status(500).json({
      error: true,
      success: false,
      message: "Failed to fetch blogs",
    });
  }
};

/**
 * Create blog (Admin only)
 */
export const createBlog = async (req, res) => {
  try {
    const {
      title,
      content,
      excerpt,
      image,
      author,
      category,
      tags,
      isPublished,
    } = req.body;

    if (!title || !content || !image) {
      return res.status(400).json({
        error: true,
        success: false,
        message: "Title, content, and image are required",
      });
    }

    const blog = new BlogModel({
      title,
      content,
      excerpt: excerpt || content.substring(0, 500),
      image,
      author: author || "Admin",
      category: category || "General",
      tags: tags || [],
      isPublished: isPublished !== false,
    });

    await blog.save();

    res.status(201).json({
      error: false,
      success: true,
      message: "Blog created successfully",
      data: blog,
    });
  } catch (error) {
    console.error("Error creating blog:", error);
    res.status(500).json({
      error: true,
      success: false,
      message: "Failed to create blog",
      details: error.message,
    });
  }
};

/**
 * Update blog (Admin only)
 */
export const updateBlog = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      content,
      excerpt,
      image,
      author,
      category,
      tags,
      isPublished,
    } = req.body;

    let blog = await BlogModel.findById(id);

    if (!blog) {
      return res.status(404).json({
        error: true,
        success: false,
        message: "Blog not found",
      });
    }

    // Clean up old image if being replaced
    if (image && blog.image !== image) {
      const oldPublicId = extractPublicIdFromUrl(blog.image);
      if (oldPublicId) {
        deleteFromCloudinary(oldPublicId).catch((err) => {
          console.warn("Failed to delete old blog image:", oldPublicId, err);
        });
      }
    }

    // Update fields
    if (title) blog.title = title;
    if (content) blog.content = content;
    if (excerpt) blog.excerpt = excerpt;
    if (image) blog.image = image;
    if (author) blog.author = author;
    if (category) blog.category = category;
    if (tags) blog.tags = tags;
    if (isPublished !== undefined) blog.isPublished = isPublished;

    await blog.save();

    res.status(200).json({
      error: false,
      success: true,
      message: "Blog updated successfully",
      blog: blog,
    });
  } catch (error) {
    console.error("Error updating blog:", error);
    res.status(500).json({
      error: true,
      success: false,
      message: "Failed to update blog",
      details: error.message,
    });
  }
};

/**
 * Delete blog (Admin only)
 */
export const deleteBlog = async (req, res) => {
  try {
    const { id } = req.params;

    const blog = await BlogModel.findByIdAndDelete(id);

    if (!blog) {
      return res.status(404).json({
        error: true,
        success: false,
        message: "Blog not found",
      });
    }

    // Clean up image from Cloudinary
    if (blog.image) {
      const publicId = extractPublicIdFromUrl(blog.image);
      if (publicId) {
        deleteFromCloudinary(publicId).catch((err) => {
          console.warn("Failed to delete blog image:", publicId, err);
        });
      }
    }

    res.status(200).json({
      error: false,
      success: true,
      message: "Blog deleted successfully",
      data: blog,
    });
  } catch (error) {
    console.error("Error deleting blog:", error);
    res.status(500).json({
      error: true,
      success: false,
      message: "Failed to delete blog",
      details: error.message,
    });
  }
};
