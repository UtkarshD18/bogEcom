"use client";

import ProductItem from "@/components/ProductItem";

const ExclusiveProductCard = ({ product }) => {
  if (!product) return null;

  return <ProductItem product={{ ...product, isExclusive: true }} />;
};

export default ExclusiveProductCard;
