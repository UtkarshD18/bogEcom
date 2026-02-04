"use client";

import { getImageUrl } from "@/utils/imageUtils";
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
  images = ["/product_1.png", "/product_1.png", "/product_1.png"],
}) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const bigSliderRef = useRef(null);

  // Normalize images to handle Cloudinary and local URLs
  const normalizedImages = images.map((img) => getImageUrl(img));

  const goToSlide = (index) => {
    setActiveIndex(index);
    if (bigSliderRef.current?.swiper) {
      bigSliderRef.current.swiper.slideTo(index);
    }
  };

  return (
    <div className="w-full">
      {/* Main Product Image */}
      <div
        className="border rounded-2xl p-4 overflow-hidden shadow-sm"
        style={{
          backgroundColor: "var(--flavor-card-bg, #fffbf5)",
          borderColor:
            "color-mix(in srgb, var(--flavor-color, #a7f3d0) 30%, transparent)",
        }}
      >
        <Swiper
          ref={bigSliderRef}
          className="productBigSlider"
          onSlideChange={(swiper) => setActiveIndex(swiper.activeIndex)}
        >
          {normalizedImages.map((img, index) => (
            <SwiperSlide key={index}>
              <div className="flex justify-center items-center aspect-square">
                <img
                  src={img}
                  alt={`Product Image ${index + 1}`}
                  className="w-full h-auto max-h-[500px] object-contain transition-transform duration-300 hover:scale-105"
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
                      ? "border-[#059669] shadow-md"
                      : "hover:border-gray-300"
                  }`}
                  style={{
                    backgroundColor: "var(--flavor-card-bg, #fffbf5)",
                    borderColor:
                      activeIndex === index
                        ? "#059669"
                        : "color-mix(in srgb, var(--flavor-color, #a7f3d0) 30%, transparent)",
                  }}
                >
                  <img
                    src={img}
                    alt={`Thumbnail ${index + 1}`}
                    className="w-full h-[80px] object-contain"
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
