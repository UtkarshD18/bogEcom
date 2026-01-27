"use client";
import { useEffect, useState } from "react";

const FLAVORS = [
  { name: "Chocolate", color: "#4B2E2B", glass: "rgba(75,46,43,0.6)" },
  { name: "Creamy", color: "#F5C16C", glass: "rgba(245,193,108,0.6)" },
  { name: "Millets", color: "#A3C16C", glass: "rgba(163,193,108,0.6)" },
  { name: "Nutty", color: "#D9A066", glass: "rgba(217,160,102,0.6)" },
];

export default function FlavorSwitcherBar() {
  const [selected, setSelected] = useState(FLAVORS[0].name);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("selectedFlavor");
    if (saved) {
      try {
        const flavor = JSON.parse(saved);
        setSelected(flavor.name);
      } catch {
        setSelected(FLAVORS[0].name);
      }
    }
    setMounted(true);
  }, []);

  const handleClick = (flavor) => {
    setSelected(flavor.name);
    localStorage.setItem("selectedFlavor", JSON.stringify(flavor));
    window.dispatchEvent(new CustomEvent("themeChange", { detail: flavor }));
    document.body.style.background = `linear-gradient(135deg, ${flavor.color} 0%, #fff 100%)`;
    const mainWrappers = document.querySelectorAll(
      ".sliderWrapper, .catSlider, .banners, [data-theme-color]",
    );
    mainWrappers.forEach((el) => {
      el.style.background = `linear-gradient(135deg, ${flavor.color} 0%, #fff 100%)`;
    });
  };

  if (!mounted) return null;

  return (
    <div
      style={{
        width: "100%",
        display: "flex",
        justifyContent: "center",
        margin: "32px 0 16px 0",
        zIndex: 20,
      }}
    >
      <style>{`
        .flavor-btn { transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); position: relative; overflow: hidden; }
        .flavor-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.15) !important; }
      `}</style>
      <div
        style={{
          display: "flex",
          gap: "32px",
          background: "rgba(0,0,0,0.08)",
          borderRadius: "32px",
          padding: "18px 32px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
          backdropFilter: "blur(12px)",
        }}
      >
        {FLAVORS.map((flavor) => (
          <button
            key={flavor.name}
            className="flavor-btn"
            onClick={() => handleClick(flavor)}
            style={{
              background:
                selected === flavor.name ? flavor.color : flavor.glass,
              color: selected === flavor.name ? "#fff" : "#4B2E2B",
              fontWeight: "bold",
              fontSize: "1.1rem",
              border: selected === flavor.name ? "2px solid #fff" : "none",
              borderRadius: "16px",
              padding: "12px 32px",
              boxShadow:
                selected === flavor.name
                  ? "0 6px 20px rgba(0,0,0,0.15)"
                  : "none",
              outline: "none",
              cursor: "pointer",
            }}
          >
            {flavor.name}
          </button>
        ))}
      </div>
    </div>
  );
}
