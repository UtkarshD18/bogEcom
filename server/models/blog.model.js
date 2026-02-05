import mongoose from "mongoose";

const blogSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
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
      required: true,
    },
    excerpt: {
      type: String,
      maxlength: 500,
    },
    image: {
      type: String,
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
  if (!this.slug || this.isModified("title")) {
    this.slug = this.title
      .toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-");
  }
});

const BlogModel = mongoose.models.Blog || mongoose.model("Blog", blogSchema);

export default BlogModel;
