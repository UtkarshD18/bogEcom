import { deleteFromCloudinary } from "../config/cloudinary.js";
import { invalidatePublicResponseCache } from "../middlewares/publicResponseCache.js";
import BlogModel from "../models/blog.model.js";
import { extractPublicIdFromUrl } from "../utils/imageUtils.js";

const BLOG_RESPONSE_CACHE_NAMESPACES = ["blogs"];
const BLOG_CONTENT_FONT_FAMILIES = [
  "modern-sans",
  "editorial-serif",
  "clean-serif",
  "compact-sans",
];
const BLOG_CONTENT_FONT_SIZES = ["sm", "base", "lg", "xl"];
const DEFAULT_BLOG_CONTENT_FONT_FAMILY = "modern-sans";
const DEFAULT_BLOG_CONTENT_FONT_SIZE = "base";

const normalizeText = (value, fallback = "") => {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed || fallback;
};

const normalizeTags = (value) => {
  if (Array.isArray(value)) {
    return value.map((tag) => normalizeText(tag)).filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((tag) => normalizeText(tag))
      .filter(Boolean);
  }

  return [];
};

const resolveBlogTitle = (title, content, excerpt, referenceLink) =>
  normalizeText(
    title,
    normalizeText(content, normalizeText(excerpt, normalizeText(referenceLink, "Untitled Blog"))).slice(0, 120) ||
      "Untitled Blog",
  );

const normalizePublishFlag = (value, fallback = true) => {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;

  const normalized = String(value).trim().toLowerCase();
  if (["true", "1", "yes", "on"].includes(normalized)) return true;
  if (["false", "0", "no", "off"].includes(normalized)) return false;

  return fallback;
};

const normalizeEnumValue = (value, allowedValues, fallback) => {
  const normalized = normalizeText(value, "");
  return allowedValues.includes(normalized) ? normalized : fallback;
};

const resolvePublicBlogQuery = (identifier) => {
  const publicFilter = {
    $or: [{ isPublished: true }, { isPublished: { $exists: false } }],
  };

  const identifierFilters = [{ slug: identifier }];
  if (identifier && /^[a-fA-F0-9]{24}$/.test(identifier)) {
    identifierFilters.push({ _id: identifier });
  }

  return {
    $and: [publicFilter, { $or: identifierFilters }],
  };
};

/**
 * Get all published blogs (public)
 */
export const getAllBlogs = async (req, res) => {
  try {
    const { page = 1, limit = 10, category, search } = req.query;
    const skip = (page - 1) * limit;

    const filters = [
      { $or: [{ isPublished: true }, { isPublished: { $exists: false } }] },
    ];

    if (category) {
      filters.push({ category });
    }

    if (search) {
      filters.push({
        $or: [
          { title: { $regex: search, $options: "i" } },
          { excerpt: { $regex: search, $options: "i" } },
          { content: { $regex: search, $options: "i" } },
        ],
      });
    }

    const query = filters.length > 1 ? { $and: filters } : filters[0];

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

    const blog = await BlogModel.findOne(resolvePublicBlogQuery(slug));

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

export const incrementBlogViewCountBestEffort = async (identifier) => {
  try {
    const normalizedIdentifier = String(identifier || "").trim();
    if (!normalizedIdentifier) {
      return;
    }

    await BlogModel.updateOne(resolvePublicBlogQuery(normalizedIdentifier), {
      $inc: { viewCount: 1 },
    });
  } catch (error) {
    console.warn(
      "Blog view count cache-hit update failed:",
      error?.message || error,
    );
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
      contentFontFamily,
      contentFontSize,
      excerpt,
      image,
      referenceLink,
      mediaType,
      videoUrl,
      author,
      category,
      tags,
      isPublished,
    } = req.body;

    const normalizedTitle = resolveBlogTitle(title, content, excerpt, referenceLink);
    const normalizedContent = normalizeText(content, "");
    const normalizedExcerpt = normalizeText(
      excerpt,
      normalizedContent ? normalizedContent.slice(0, 500) : "",
    );
    const normalizedVideoUrl = normalizeText(videoUrl, "");
    const normalizedMediaType =
      mediaType === "video" || normalizedVideoUrl ? "video" : "image";

    const blog = new BlogModel({
      title: normalizedTitle,
      content: normalizedContent,
      contentFontFamily: normalizeEnumValue(
        contentFontFamily,
        BLOG_CONTENT_FONT_FAMILIES,
        DEFAULT_BLOG_CONTENT_FONT_FAMILY,
      ),
      contentFontSize: normalizeEnumValue(
        contentFontSize,
        BLOG_CONTENT_FONT_SIZES,
        DEFAULT_BLOG_CONTENT_FONT_SIZE,
      ),
      excerpt: normalizedExcerpt,
      image: normalizeText(image, "") || null,
      referenceLink: normalizeText(referenceLink, "") || null,
      mediaType: normalizedMediaType,
      videoUrl: normalizedVideoUrl || null,
      author: normalizeText(author, "Admin"),
      category: normalizeText(category, "General"),
      tags: normalizeTags(tags),
      isPublished: normalizePublishFlag(isPublished, true),
    });

    await blog.save();
    await invalidatePublicResponseCache(BLOG_RESPONSE_CACHE_NAMESPACES);

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
      contentFontFamily,
      contentFontSize,
      excerpt,
      image,
      referenceLink,
      mediaType,
      videoUrl,
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
    if (title !== undefined) {
      blog.title = resolveBlogTitle(title, content ?? blog.content, excerpt ?? blog.excerpt, referenceLink ?? blog.referenceLink);
    }
    if (content !== undefined) blog.content = normalizeText(content, "");
    if (contentFontFamily !== undefined) {
      blog.contentFontFamily = normalizeEnumValue(
        contentFontFamily,
        BLOG_CONTENT_FONT_FAMILIES,
        blog.contentFontFamily || DEFAULT_BLOG_CONTENT_FONT_FAMILY,
      );
    }
    if (contentFontSize !== undefined) {
      blog.contentFontSize = normalizeEnumValue(
        contentFontSize,
        BLOG_CONTENT_FONT_SIZES,
        blog.contentFontSize || DEFAULT_BLOG_CONTENT_FONT_SIZE,
      );
    }
    if (excerpt !== undefined) blog.excerpt = normalizeText(excerpt, "");
    if (image !== undefined) blog.image = normalizeText(image, "") || null;
    if (referenceLink !== undefined) {
      blog.referenceLink = normalizeText(referenceLink, "") || null;
    }
    if (videoUrl !== undefined) blog.videoUrl = normalizeText(videoUrl, "") || null;
    if (mediaType || videoUrl !== undefined) {
      blog.mediaType = mediaType === "video" || blog.videoUrl ? "video" : "image";
    }
    if (author !== undefined) blog.author = normalizeText(author, blog.author);
    if (category !== undefined) blog.category = normalizeText(category, blog.category);
    if (tags !== undefined) blog.tags = normalizeTags(tags);
    if (isPublished !== undefined) blog.isPublished = normalizePublishFlag(isPublished, blog.isPublished);

    await blog.save();
    await invalidatePublicResponseCache(BLOG_RESPONSE_CACHE_NAMESPACES);

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
    await invalidatePublicResponseCache(BLOG_RESPONSE_CACHE_NAMESPACES);

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
