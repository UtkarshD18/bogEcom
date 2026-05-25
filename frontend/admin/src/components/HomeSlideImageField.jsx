"use client";

import UploadBox from "@/components/UploadBox";
import {
  formatAspectRatio,
  formatImageDimensions,
} from "@/utils/homeSlideImage";
import { IoMdClose } from "react-icons/io";

const HomeSlideImageField = ({
  label,
  asset,
  onChange,
  onRemove,
  spec,
  required = false,
  hint = "",
  previewScale = 1,
  previewPositionX = 50,
  previewPositionY = 50,
}) => {
  const hasWarnings = Array.isArray(asset?.warnings) && asset.warnings.length > 0;

  return (
    <div className="flex flex-col gap-2 mt-5">
      <h3 className="text-[16px] text-gray-700 font-[600]">
        {label}
        {required ? " *" : ""}
      </h3>

      <div className="flex items-start gap-4 mt-2 flex-wrap">
        {asset ? (
          <div className="w-[300px] rounded-md border border-gray-200 bg-white p-3 shadow-sm">
            <div className="relative h-[170px] overflow-hidden rounded-md bg-gray-100">
              <img
                src={asset.preview}
                alt={`${label} preview`}
                className="h-full w-full object-cover"
                style={{
                  objectPosition: `${previewPositionX}% ${previewPositionY}%`,
                  transform: `scale(${previewScale})`,
                }}
              />
              <button
                type="button"
                onClick={onRemove}
                className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-red-600 text-white hover:bg-red-700"
                aria-label={`Remove ${label}`}
              >
                <IoMdClose size={16} />
              </button>
            </div>

            <div className="mt-3 space-y-2 text-[13px] text-gray-600">
              <p>
                Resolution:{" "}
                <span className="font-medium text-gray-800">
                  {formatImageDimensions(asset.dimensions)}
                </span>
              </p>
              {asset.dimensions?.aspectRatio ? (
                <p>
                  Aspect ratio:{" "}
                  <span className="font-medium text-gray-800">
                    {formatAspectRatio(asset.dimensions.aspectRatio)}
                  </span>
                </p>
              ) : null}
              <p>
                Recommended:{" "}
                <span className="font-medium text-gray-800">
                  {spec.width} x {spec.height}
                </span>
              </p>
            </div>

            <div
              className={`mt-3 rounded-md border px-3 py-2 text-[13px] ${
                hasWarnings
                  ? "border-amber-200 bg-amber-50 text-amber-800"
                  : "border-emerald-200 bg-emerald-50 text-emerald-700"
              }`}
            >
              {hasWarnings ? (
                <ul className="list-disc space-y-1 pl-4">
                  {asset.warnings.map((warning, index) => (
                    <li key={`${label}-warning-${index}`}>{warning}</li>
                  ))}
                </ul>
              ) : (
                <p>
                  This file matches the recommended size guidance. Please still
                  verify the composition works as a banner, because this check
                  only validates resolution and aspect ratio.
                </p>
              )}
            </div>
          </div>
        ) : (
          <UploadBox onChange={onChange} />
        )}
      </div>

      <p className="text-sm text-gray-500">
        Recommended size: {spec.width} x {spec.height}. {hint}
      </p>
    </div>
  );
};

export default HomeSlideImageField;
