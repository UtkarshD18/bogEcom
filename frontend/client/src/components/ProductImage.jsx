"use client";

import { getImageUrl, getResponsiveImageSet } from "@/utils/imageUtils";
import { useEffect, useMemo, useState } from "react";

const ProductImage = ({
  src,
  alt = "",
  className = "",
  imgClassName = "",
  aspect = "aspect-square",
  rounded = "rounded-2xl",
  padding = "p-0",
  fit = "contain",
  cardImage = false,
  natural = false,
  responsiveProfile = "",
  sizes = "",
  eager = false,
  children,
  ...props
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const resolvedProfile =
    responsiveProfile || (natural ? "zoom" : cardImage ? "card" : "content");
  const responsiveImage = useMemo(
    () => getResponsiveImageSet(src, { profile: resolvedProfile, sizes }),
    [resolvedProfile, sizes, src],
  );
  const resolvedSrc = responsiveImage?.src || getImageUrl(src);
  const objectFit = fit === "cover" ? "object-cover" : "object-contain";
  const aspectClass = aspect ? aspect : "";
  const imageSizeClass = natural ? "max-h-full max-w-full" : "h-full w-full";

  useEffect(() => {
    setIsLoaded(false);
  }, [resolvedSrc, responsiveImage?.srcSet]);

  return (
    <div
      className={`product-image-container relative overflow-hidden bg-[#f5f5f5] ${aspectClass} ${rounded} ${padding} ${className}`}
      {...props}
    >
      <img
        src={resolvedSrc || "/product_1.webp"}
        srcSet={responsiveImage?.srcSet}
        sizes={responsiveImage?.sizes}
        alt={alt}
        loading={eager ? "eager" : "lazy"}
        fetchPriority={eager ? "high" : "auto"}
        decoding="async"
        onLoad={() => setIsLoaded(true)}
        className={`product-image block ${imageSizeClass} ${objectFit} shadow-none transition-[opacity,transform,filter] duration-500 ease-out will-change-transform ${
          isLoaded ? "opacity-100 scale-100" : "opacity-0 scale-[1.015]"
        } ${imgClassName}`}
        draggable={false}
      />
      {children}
    </div>
  );
};

export default ProductImage;
