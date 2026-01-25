import mongoose from "mongoose";

/**
 * Banner Model
 *
 * For promotional banners displayed on the website.
 * Admin can manage these through the admin panel.
 */
const bannerSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Banner title is required"],
      trim: true,
      maxLength: [100, "Title cannot exceed 100 characters"],
    },
    subtitle: {
      type: String,
      default: "",
      maxLength: [200, "Subtitle cannot exceed 200 characters"],
    },
    image: {
      type: String,
      required: [true, "Banner image is required"],
    },
    mobileImage: {
      type: String,
      default: "", // Separate image for mobile view
    },
    link: {
      type: String,
      default: "",
    },
    linkText: {
      type: String,
      default: "Shop Now",
    },
    position: {
      type: String,
      enum: [
        "home-top",
        "home-middle",
        "home-bottom",
        "sidebar",
        "category",
        "product",
      ],
      default: "home-top",
      index: true,
    },
    backgroundColor: {
      type: String,
      default: "#ffffff",
    },
    textColor: {
      type: String,
      default: "#000000",
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
    startDate: {
      type: Date,
      default: null,
    },
    endDate: {
      type: Date,
      default: null,
    },
    clickCount: {
      type: Number,
      default: 0,
    },
    viewCount: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true },
);

// Virtual to check if banner is currently active based on dates
bannerSchema.virtual("isCurrentlyActive").get(function () {
  const now = new Date();
  if (!this.isActive) return false;
  if (this.startDate && now < this.startDate) return false;
  if (this.endDate && now > this.endDate) return false;
  return true;
});

bannerSchema.index({ position: 1, isActive: 1, sortOrder: 1 });

const BannerModel = mongoose.model("Banner", bannerSchema);
export default BannerModel;
