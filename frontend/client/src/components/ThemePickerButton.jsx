"use client";

import { FLAVORS, MyContext } from "@/context/ThemeContext";
import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { FaCheck } from "react-icons/fa6";
import { MdPalette } from "react-icons/md";

export default function ThemePickerButton({ variant = "desktop" }) {
  const context = useContext(MyContext);
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const isPanel = variant === "mobile" || variant === "panel";
  const flavorOptions = useMemo(() => Object.values(FLAVORS), []);
  const selectedFlavor = context?.flavor || flavorOptions[0];

  const handleSelectFlavor = (flavor) => {
    context?.setSelectedFlavor?.(flavor);
    if (typeof window !== "undefined") {
      localStorage.setItem("selectedFlavor", JSON.stringify(flavor));
      window.dispatchEvent(new CustomEvent("themeChange", { detail: flavor }));
    }
    setOpen(false);
  };

  useEffect(() => {
    if (!open || isPanel) return undefined;

    const handleOutsideClick = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [isPanel, open]);

  if (isPanel) {
    return (
      <div
        ref={rootRef}
        className={
          variant === "panel"
            ? "rounded-2xl border border-[#eadfd4] bg-white/80 px-4 py-3 shadow-sm"
            : "mx-2 mt-2 rounded-2xl border border-[#eadfd4] bg-white/70 px-4 py-3 shadow-sm"
        }
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-3 text-[15px] font-semibold text-gray-700">
            <span
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-sm"
              style={{
                color: "var(--flavor-color)",
                boxShadow:
                  "0 0 0 1px color-mix(in srgb, var(--flavor-color, #f5c16c) 22%, transparent)",
              }}
            >
              <MdPalette size={19} />
            </span>
            Theme
          </span>
          <span className="text-xs font-bold text-[var(--flavor-color)]">
            {selectedFlavor?.name || "Choose"}
          </span>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {flavorOptions.map((flavor) => {
            const isSelected = selectedFlavor?.name === flavor.name;
            return (
              <button
                key={flavor.name}
                type="button"
                onClick={() => handleSelectFlavor(flavor)}
                aria-label={`Use ${flavor.name} theme`}
                aria-pressed={isSelected}
                className="flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl border bg-white/85 px-1.5 py-2 text-[10px] font-bold text-gray-700 transition active:scale-[0.98]"
                style={{
                  borderColor: isSelected
                    ? flavor.color
                    : "rgba(226, 214, 202, 0.9)",
                  boxShadow: isSelected
                    ? `0 0 0 2px ${flavor.glass || "rgba(0,0,0,0.08)"}`
                    : "none",
                }}
              >
                <span
                  className="flex h-5 w-5 items-center justify-center rounded-full border border-black/10"
                  style={{ background: flavor.color }}
                >
                  {isSelected ? (
                    <FaCheck
                      className="text-[10px]"
                      style={{ color: flavor.text || "#111111" }}
                    />
                  ) : null}
                </span>
                <span className="max-w-full truncate">{flavor.name}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={rootRef}
      className="relative"
    >
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-label="Choose theme color"
        title="Choose theme color"
        className={
          "group relative flex h-10 w-10 items-center justify-center rounded-full border bg-white/90 text-[var(--flavor-color)] shadow-sm transition-all duration-200 hover:scale-[1.04] hover:shadow-md"
        }
        style={
          {
            borderColor:
              "color-mix(in srgb, var(--flavor-color, #f5c16c) 28%, transparent)",
          }
        }
      >
        <span className="inline-flex items-center gap-3">
          <span
            className="relative flex h-7 w-7 items-center justify-center rounded-full bg-white shadow-sm"
            style={{
              color: selectedFlavor?.color || "var(--flavor-color)",
              boxShadow:
                "0 0 0 1px color-mix(in srgb, var(--flavor-color, #f5c16c) 22%, transparent)",
            }}
          >
            <MdPalette size={18} />
          </span>
        </span>
        <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md border bg-white/95 px-2 py-1 text-xs font-medium text-gray-700 opacity-0 shadow-md transition-opacity duration-200 group-hover:opacity-100">
          Theme color
        </span>
      </button>

      {open ? (
        <div
          className="absolute right-0 top-[calc(100%+0.75rem)] z-[90] w-[300px] rounded-2xl border border-[#eadfd4] bg-white/95 p-4 shadow-[0_20px_50px_rgba(35,24,16,0.18)] backdrop-blur"
        >
          <div className="mb-2 px-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#8a5b18]">
              Theme
            </p>
            <p className="text-xs text-gray-500">
              Pick your shopping color.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {flavorOptions.map((flavor) => {
              const isSelected = selectedFlavor?.name === flavor.name;
              return (
                <button
                  key={flavor.name}
                  type="button"
                  onClick={() => handleSelectFlavor(flavor)}
                  aria-pressed={isSelected}
                  className="flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm font-semibold text-gray-700 transition hover:bg-[#fff8ef]"
                  style={{
                    borderColor: isSelected
                      ? flavor.color
                      : "rgba(226, 214, 202, 0.9)",
                    boxShadow: isSelected
                      ? `0 0 0 2px ${flavor.glass || "rgba(0,0,0,0.08)"}`
                      : "none",
                  }}
                >
                  <span
                    className="flex h-5 w-5 items-center justify-center rounded-full border border-black/10"
                    style={{ background: flavor.color }}
                  >
                    {isSelected ? (
                      <FaCheck
                        className="text-[10px]"
                        style={{ color: flavor.text || "#111111" }}
                      />
                    ) : null}
                  </span>
                  <span className="min-w-0 truncate">{flavor.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
