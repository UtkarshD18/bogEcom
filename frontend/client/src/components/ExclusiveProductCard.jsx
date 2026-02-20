"use client";

import ProductItem from "@/components/ProductItem";
import VIPGlassOverlay from "@/components/VIPGlassOverlay";

const ExclusiveProductCard = ({ product, isMember = true }) => {
  if (!product) return null;

  return (
    <VIPGlassOverlay isMember={isMember} overlayRadiusClass="rounded-[24px]">
      <ProductItem product={{ ...product, isExclusive: true }} />
    </VIPGlassOverlay>
  );
};

export default ExclusiveProductCard;
