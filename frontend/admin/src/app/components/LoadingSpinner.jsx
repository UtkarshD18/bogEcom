"use client";

export default function LoadingSpinner({ label = "Loading..." }) {
  return (
    <div className="min-h-[50vh] flex items-center justify-center">
      <div className="flex items-center gap-3 text-gray-600">
        <span className="inline-block h-6 w-6 rounded-full border-2 border-gray-300 border-t-blue-600 animate-spin" />
        <span className="text-sm font-medium">{label}</span>
      </div>
    </div>
  );
}

