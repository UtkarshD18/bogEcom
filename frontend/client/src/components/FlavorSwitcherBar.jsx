"use client";
import { FLAVORS, MyContext } from "@/context/ThemeContext";
import { useContext, useEffect, useState } from "react";

// Convert FLAVORS object to array for mapping
const FLAVORS_ARRAY = [
  FLAVORS.creamy,
  FLAVORS.chocolate,
  FLAVORS.millets,
  FLAVORS.nutty,
];

export default function FlavorSwitcherBar() {
  const context = useContext(MyContext);
  const [selected, setSelected] = useState(FLAVORS.creamy.name);
  const [mounted, setMounted] = useState(false);

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
    FLAVORS_ARRAY.find((f) => f.name === selected) || FLAVORS.creamy;

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
            padding: 8px 14px !important;
          }
        }
      `}</style>
      <div className="flavor-bar">
        {FLAVORS_ARRAY.map((flavor) => (
          <button
            key={flavor.name}
            className="flavor-btn"
            onClick={() => handleClick(flavor)}
            style={{
              background:
                selected === flavor.name ? flavor.color : flavor.glass,
              color: selected === flavor.name ? "#fff" : flavor.color,
              fontWeight: "600",
              fontSize: "0.95rem",
              border:
                selected === flavor.name
                  ? "2px solid rgba(255,255,255,0.5)"
                  : "2px solid transparent",
              borderRadius: "12px",
              padding: "10px 24px",
              boxShadow:
                selected === flavor.name
                  ? `0 4px 16px ${flavor.color}40`
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
