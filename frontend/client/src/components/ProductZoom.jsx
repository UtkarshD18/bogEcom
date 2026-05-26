"use client";

import SeoImg from "@/components/SeoImg";
import { getImageUrl } from "@/utils/imageUtils";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import "swiper/css";
import { Swiper, SwiperSlide } from "swiper/react";

/**
 * Product Zoom Component
 * Displays product images with thumbnail navigation
 *
 * @param {Object} props
 * @param {string[]} props.images - Array of image URLs
 */
const ProductZoom = ({
  images = ["/product_1.webp", "/product_1.webp", "/product_1.webp"],
  productId = "",
  zoomType = "product",
}) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const bigSliderRef = useRef(null);
  const router = useRouter();

  // Normalize images to handle Cloudinary and local URLs
  const normalizedImages = images.map((img) => getImageUrl(img));

  const goToSlide = (index) => {
    setActiveIndex(index);
    if (bigSliderRef.current?.swiper) {
      bigSliderRef.current.swiper.slideTo(index);
    }
  };

  const openFullImageView = (index) => {
    if (!productId) return;
    const isComboZoom = String(zoomType || "").toLowerCase() === "combo";
    const idParam = isComboZoom ? "comboId" : "productId";
    router.push(
      `/product-image-zoom?${idParam}=${encodeURIComponent(productId)}&type=${encodeURIComponent(zoomType)}&index=${Math.max(Number(index || 0), 0)}`,
    );
  };

  const handleMouseMove = (e, index) => {
    // Only zoom if this is the active slide
    if (activeIndex !== index) return;
    
    // Get the container dimensions 
    const { left, top, width, height } = e.currentTarget.getBoundingClientRect();
    
    // Calculate mouse position relative to image (handle window scroll as well)
    const x = ((e.clientX - left) / width) * 100;
    const y = ((e.clientY - top) / height) * 100;

    // Apply the position to custom properties for smooth CSS zoom
    e.currentTarget.style.setProperty("--zoom-x", `${x}%`);
    e.currentTarget.style.setProperty("--zoom-y", `${y}%`);
  };

  return (
    <div className="w-full">
      {/* Main Product Image */}
      <div
        className="relative w-full aspect-square overflow-hidden rounded-2xl border shadow-sm"
        style={{
          backgroundColor: "var(--flavor-card-bg, #fffbf5)",
          borderColor:
            "color-mix(in srgb, var(--flavor-color, #a7f3d0) 30%, transparent)",
        }}
      >
        <Swiper
          ref={bigSliderRef}
          className="productBigSlider h-full group"
          onSlideChange={(swiper) => setActiveIndex(swiper.activeIndex)}
        >
          {normalizedImages.map((img, index) => (
            <SwiperSlide key={index}>
              <div 
                className="relative h-full w-full overflow-hidden zoom-container cursor-zoom-in"
                onMouseMove={(e) => handleMouseMove(e, index)}
                onClick={() => openFullImageView(index)}
                style={{
                  "--zoom-x": "50%",
                  "--zoom-y": "50%",
                }}
              >
                <SeoImg
                  src={img}
                  fallbackAlt={`Product Image ${index + 1}`}
                  className="h-full w-full object-cover transition-all duration-300 ease-out origin-[var(--zoom-x,50%)_var(--zoom-y,50%)] group-hover:scale-[2.5]"
                />
              </div>
            </SwiperSlide>
          ))}
        </Swiper>
      </div>

      {/* Thumbnail Slider */}
      {normalizedImages.length > 1 && (
        <div className="pt-4">
          <Swiper
            slidesPerView={Math.min(normalizedImages.length, 5)}
            spaceBetween={10}
            className="productThumbSlider"
          >
            {normalizedImages.map((img, index) => (
              <SwiperSlide key={index}>
                <div
                  onClick={() => goToSlide(index)}
                  className={`cursor-pointer border rounded-lg p-2 transition-all duration-300 ${
                    activeIndex === index
                      ? "border-primary shadow-md"
                      : "hover:border-gray-300"
                  }`}
                  style={{
                    backgroundColor: "var(--flavor-card-bg, #fffbf5)",
                    borderColor:
                      activeIndex === index
                        ? "var(--primary)"
                        : "color-mix(in srgb, var(--flavor-color, #a7f3d0) 30%, transparent)",
                  }}
                >
                  <img
                    src={img}
                    alt={`Thumbnail ${index + 1}`}
                    className="w-full h-20 object-contain"
                  />
                </div>
              </SwiperSlide>
            ))}
          </Swiper>
        </div>
      )}
    </div>
  );
};

export default ProductZoom;
