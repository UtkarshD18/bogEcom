"use client";
import { FLAVORS, MyContext } from "@/context/ThemeContext";
import { useSettings } from "@/context/SettingsContext";
import { useContext, useEffect, useState } from "react";

// Convert FLAVORS object to array for mapping
const FLAVORS_ARRAY = [
  FLAVORS.creamy,
  FLAVORS.chocolate,
  FLAVORS.millets,
  FLAVORS.nutty,
];
const HEX_COLOR_PATTERN = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

const normalizeHexColor = (value) => {
  const raw = String(value || "").trim();
  if (!HEX_COLOR_PATTERN.test(raw)) return "";
  const normalized = raw.toLowerCase();
  if (normalized.length === 4) {
    return `#${normalized[1]}${normalized[1]}${normalized[2]}${normalized[2]}${normalized[3]}${normalized[3]}`;
  }
  return normalized;
};

const hexToRgba = (value, alpha) => {
  const normalized = normalizeHexColor(value);
  if (!normalized) return "";
  const red = Number.parseInt(normalized.slice(1, 3), 16);
  const green = Number.parseInt(normalized.slice(3, 5), 16);
  const blue = Number.parseInt(normalized.slice(5, 7), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
};

export default function FlavorSwitcherBar() {
  const context = useContext(MyContext);
  const { settings } = useSettings();
  const [selected, setSelected] = useState(FLAVORS.creamy.name);
  const [mounted, setMounted] = useState(false);

  const configuredFlavors = FLAVORS_ARRAY.map((flavor, index) => {
    const buttonNumber = index + 1;
    const configuredLabel = String(
      settings?.[`flavour_button_${buttonNumber}_text`] || "",
    ).trim();
    const configuredBackground =
      normalizeHexColor(
        settings?.[`flavour_button_${buttonNumber}_bg_color`],
      ) || flavor.color;
    const configuredTextColor =
      normalizeHexColor(
        settings?.[`flavour_button_${buttonNumber}_text_color`],
      ) ||
      flavor.text ||
      "#111111";

    return {
      ...flavor,
      buttonLabel: configuredLabel || flavor.name,
      buttonBg: configuredBackground,
      buttonTextColor: configuredTextColor,
      buttonGlass: hexToRgba(configuredBackground, 0.18) || flavor.glass,
      buttonBorder: hexToRgba(configuredBackground, 0.24) || flavor.glass,
      buttonShadow: hexToRgba(configuredBackground, 0.32) || flavor.glass,
    };
  });

  useEffect(() => {
    const saved = localStorage.getItem("selectedFlavor");
    if (saved) {
      try {
        const flavor = JSON.parse(saved);
        setSelected(flavor.name);
      } catch {
        setSelected(FLAVORS.creamy.name);
      }
    } else {
      // Default to Creamy
      setSelected(FLAVORS.creamy.name);
    }
    setMounted(true);
  }, []);

  const handleClick = (flavor) => {
    setSelected(flavor.name);
    localStorage.setItem("selectedFlavor", JSON.stringify(flavor));
    window.dispatchEvent(new CustomEvent("themeChange", { detail: flavor }));

    // Update context if available
    if (context?.setSelectedFlavor) {
      context.setSelectedFlavor(flavor);
    }
  };

  const currentFlavor =
    configuredFlavors.find((f) => f.name === selected) || configuredFlavors[0];

  if (!mounted) return null;

  return (
    <div
      style={{
        width: "100%",
        display: "flex",
        justifyContent: "center",
        padding: "24px 16px",
        background: currentFlavor.gradient,
        zIndex: 20,
        transition: "background 0.5s cubic-bezier(0.4, 0, 0.2, 1)",
      }}
    >
      <style>{`
        .flavor-bar {
          display: flex;
          gap: 12px;
          background: ${currentFlavor.cardBg};
          border-radius: 20px;
          padding: 10px 20px;
          box-shadow: 0 4px 20px ${currentFlavor.color}15;
          backdrop-filter: blur(12px);
          border: 2px solid ${currentFlavor.color}20;
          transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
          align-items: center;
        }
        .flavor-btn { 
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); 
          position: relative; 
          overflow: hidden; 
          white-space: nowrap;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          text-align: center;
          line-height: 1.1;
        }
        .flavor-btn:hover { 
          transform: translateY(-2px); 
          box-shadow: 0 8px 24px rgba(0,0,0,0.15) !important; 
        }
        .flavor-btn::after {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: linear-gradient(180deg, rgba(255,255,255,0.2) 0%, transparent 50%);
          pointer-events: none;
        }
        @media (max-width: 640px) {
          .flavor-bar {
            gap: 8px;
            padding: 8px 10px;
            border-radius: 16px;
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
            scrollbar-width: none;
          }
          .flavor-bar::-webkit-scrollbar { display: none; }
          .flavor-btn {
            font-size: 0.85rem !important;
            padding: 9px 12px !important;
            min-width: 96px;
            min-height: 40px;
          }
        }
      `}</style>
      <div className="flavor-bar">
        {configuredFlavors.map((flavor) => (
          <button
            key={flavor.name}
            className="flavor-btn"
            onClick={() => handleClick(flavor)}
            style={{
              background:
                selected === flavor.name ? flavor.buttonBg : flavor.buttonGlass,
              color: flavor.buttonTextColor,
              fontWeight: "600",
              fontSize: "0.95rem",
              border:
                selected === flavor.name
                  ? "2px solid rgba(255,255,255,0.65)"
                  : `2px solid ${flavor.buttonBorder}`,
              borderRadius: "12px",
              padding: "10px 24px",
              boxShadow:
                selected === flavor.name
                  ? `0 4px 16px ${flavor.buttonShadow}`
                  : "none",
              outline: "none",
              cursor: "pointer",
            }}
          >
            {flavor.buttonLabel}
          </button>
        ))}
      </div>
    </div>
  );
}
