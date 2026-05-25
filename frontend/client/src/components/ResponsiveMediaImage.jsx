import { getImageUrl, getResponsiveImageSet } from "@/utils/imageUtils";

const resolveSrcSet = (candidate) => candidate?.srcSet || candidate?.src || "";

export default function ResponsiveMediaImage({
  desktopSrc = "",
  mobileSrc = "",
  alt = "",
  className = "",
  imgClassName = "",
  desktopProfile = "heroDesktop",
  mobileProfile = "heroMobile",
  desktopSizes = "",
  mobileSizes = "",
  desktopPosition = "50% 50%",
  mobilePosition = "50% 50%",
  desktopScale = 1,
  mobileScale = 1,
  backgroundColor = "",
  loading = "lazy",
  fetchPriority = "auto",
  style = undefined,
}) {
  const resolvedDesktopSrc = desktopSrc || mobileSrc;
  const resolvedMobileSrc = mobileSrc || desktopSrc;
  const desktopImage = getResponsiveImageSet(resolvedDesktopSrc, {
    profile: desktopProfile,
    sizes: desktopSizes,
  });
  const mobileImage = getResponsiveImageSet(resolvedMobileSrc, {
    profile: mobileProfile,
    sizes: mobileSizes,
  });
  const fallbackSrc =
    desktopImage?.src ||
    mobileImage?.src ||
    getImageUrl(resolvedDesktopSrc || resolvedMobileSrc);
  const wrapperStyle = {
    ...style,
    ...(backgroundColor ? { backgroundColor } : {}),
    "--responsive-media-mobile-position": mobilePosition,
    "--responsive-media-desktop-position": desktopPosition || mobilePosition,
    "--responsive-media-mobile-scale": String(mobileScale || 1),
    "--responsive-media-desktop-scale": String(desktopScale || mobileScale || 1),
  };

  return (
    <div className={`relative overflow-hidden ${className}`} style={wrapperStyle}>
      <picture className="responsive-media__picture">
        {resolvedDesktopSrc ? (
          <source
            media="(min-width: 768px)"
            srcSet={resolveSrcSet(desktopImage)}
            sizes={desktopImage?.sizes}
          />
        ) : null}
        {resolvedMobileSrc ? (
          <source
            media="(max-width: 767px)"
            srcSet={resolveSrcSet(mobileImage)}
            sizes={mobileImage?.sizes}
          />
        ) : null}
        <img
          src={fallbackSrc || "/product_1.webp"}
          alt={alt}
          loading={loading}
          fetchPriority={fetchPriority}
          decoding="async"
          className={`responsive-media__img ${imgClassName}`}
          draggable={false}
        />
      </picture>

      <style jsx>{`
        .responsive-media__picture {
          display: block;
          height: 100%;
          width: 100%;
        }

        .responsive-media__img {
          display: block;
          height: 100%;
          width: 100%;
          object-fit: cover;
          object-position: var(--responsive-media-mobile-position);
          transform: scale(var(--responsive-media-mobile-scale));
          transform-origin: center;
        }

        @media (min-width: 768px) {
          .responsive-media__img {
            object-position: var(--responsive-media-desktop-position);
            transform: scale(var(--responsive-media-desktop-scale));
          }
        }
      `}</style>
    </div>
  );
}
