"use client";
import { useState } from "react";
import { FaCloudUploadAlt, FaRegImage } from "react-icons/fa";

const UploadBox = ({ onChange, accept = "image/*", multiple = false }) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      // Create a synthetic event-like object for the onChange handler
      const syntheticEvent = {
        target: {
          files: files,
        },
      };
      onChange(syntheticEvent);
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`w-[150px] h-[150px] rounded-md p-5 border-2 border-dashed flex items-center justify-center flex-col gap-2 relative transition-all duration-200 cursor-pointer ${
        isDragging
          ? "bg-blue-50 border-blue-500 scale-105"
          : "bg-gray-100 border-gray-300 hover:bg-gray-50 hover:border-blue-400"
      }`}
    >
      {isDragging ? (
        <>
          <FaCloudUploadAlt
            size={40}
            className="text-blue-500 animate-bounce"
          />
          <span className="text-blue-600 text-[12px] text-center font-medium">
            Drop here!
          </span>
        </>
      ) : (
        <>
          <FaRegImage size={32} className="text-gray-400" />
          <span className="text-gray-600 text-[12px] text-center">
            {multiple ? "Drop or Click" : "Drop or Click"}
          </span>
          <span className="text-gray-400 text-[10px]">to upload</span>
        </>
      )}
      <input
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={onChange}
        className="absolute top-0 left-0 w-full h-full z-50 opacity-0 cursor-pointer"
      />
    </div>
  );
};

export default UploadBox;
