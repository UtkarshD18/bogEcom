import mongoose from "mongoose";

const slugifyText = (value = "") =>
  String(value)
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

const BLOG_CONTENT_FONT_FAMILIES = [
  "modern-sans",
  "editorial-serif",
  "clean-serif",
  "compact-sans",
];

const BLOG_CONTENT_FONT_SIZES = ["sm", "base", "lg", "xl"];

const blogSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      default: "Untitled Blog",
      trim: true,
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true,
    },
    content: {
      type: String,
      default: "",
    },
    contentFormat: {
      type: String,
      enum: ["plain", "html"],
      default: "plain",
    },
    contentHtml: {
      type: String,
      default: "",
    },
    contentHtmlFileName: {
      type: String,
      trim: true,
    },
    contentFontFamily: {
      type: String,
      enum: BLOG_CONTENT_FONT_FAMILIES,
      default: "modern-sans",
    },
    contentFontSize: {
      type: String,
      enum: BLOG_CONTENT_FONT_SIZES,
      default: "base",
    },
    excerpt: {
      type: String,
      maxlength: 500,
    },
    image: {
      type: String,
    },
    referenceLink: {
      type: String,
      trim: true,
    },
    mediaType: {
      type: String,
      enum: ["image", "video"],
      default: "image",
    },
    videoUrl: {
      type: String,
    },
    author: {
      type: String,
      default: "Admin",
    },
    category: {
      type: String,
      default: "General",
    },
    tags: [
      {
        type: String,
      },
    ],
    isPublished: {
      type: Boolean,
      default: true,
    },
    viewCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  },
);

// Auto-generate slug from title before saving
blogSchema.pre("save", async function () {
  if (!this.slug || this.isModified("title") || this.isModified("content")) {
    const titleSource = this.title?.trim();
    const contentSource = this.content?.trim();
    const baseSource = titleSource || contentSource || `blog-${this._id}`;
    const fallbackBase = slugifyText(baseSource) || `blog-${this._id}`;
    const needsUniqueSuffix = !titleSource;

    let candidateSlug = needsUniqueSuffix
      ? `${fallbackBase}-${String(this._id).slice(-6)}`
      : fallbackBase;
    let suffix = 2;

    while (
      await mongoose.models.Blog.findOne({
        slug: candidateSlug,
        _id: { $ne: this._id },
      }).select("_id")
    ) {
      candidateSlug = `${fallbackBase}-${suffix}`;
      suffix += 1;
    }

    this.slug = candidateSlug;
  }
});

const BlogModel = mongoose.models.Blog || mongoose.model("Blog", blogSchema);

export default BlogModel;
