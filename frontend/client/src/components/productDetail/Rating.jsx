"use client";

import { Rating as MuiRating } from "@mui/material";

const Rating = ({ value = 0, reviewCount = 0 }) => {
  const safeValue = Number(value || 0);
  const safeReviewCount = Math.max(Number(reviewCount || 0), 0);

  return (
    <div className="flex items-center gap-3 mb-4">
      <MuiRating value={safeValue} precision={0.5} readOnly size="small" />
      <span className="text-sm text-gray-500">({safeReviewCount} reviews)</span>
    </div>
  );
};

export default Rating;