import mongoose from "mongoose";

/**
 * Home Slide Model
 *
 * For hero slider/carousel on the home page.
 * Admin can manage these through the admin panel.
 */
const homeSlideSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Slide title is required"],
      trim: true,
      maxLength: [100, "Title cannot exceed 100 characters"],
    },
    subtitle: {
      type: String,
      default: "",
      maxLength: [200, "Subtitle cannot exceed 200 characters"],
    },
    description: {
      type: String,
      default: "",
      maxLength: [500, "Description cannot exceed 500 characters"],
    },
    image: {
      type: String,
      required: [true, "Slide image is required"],
    },
    mobileImage: {
      type: String,
      default: "",
    },
    buttonText: {
      type: String,
      default: "Shop Now",
    },
    buttonLink: {
      type: String,
      default: "/products",
    },
    secondaryButtonText: {
      type: String,
      default: "",
    },
    secondaryButtonLink: {
      type: String,
      default: "",
    },
    backgroundColor: {
      type: String,
      default: "#f5f5f5",
    },
    textColor: {
      type: String,
      default: "#000000",
    },
    textPosition: {
      type: String,
      enum: ["left", "center", "right"],
      default: "left",
    },
    overlayOpacity: {
      type: Number,
      default: 0,
      min: 0,
      max: 1,
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
  },
  { timestamps: true },
);

// Virtual to check if slide is currently active
homeSlideSchema.virtual("isCurrentlyActive").get(function () {
  const now = new Date();
  if (!this.isActive) return false;
  if (this.startDate && now < this.startDate) return false;
  if (this.endDate && now > this.endDate) return false;
  return true;
});

homeSlideSchema.index({ isActive: 1, sortOrder: 1 });

const HomeSlideModel = mongoose.model("HomeSlide", homeSlideSchema);
export default HomeSlideModel;
