"use client";
import { useState } from "react";

const FLAVORS = [
  {
    name: "Chocolate",
    color: "#4B2E2B",
    glass: "rgba(75,46,43,0.6)",
  },
  {
    name: "Creamy",
    color: "#F5C16C",
    glass: "rgba(245,193,108,0.6)",
  },
  {
    name: "Millets",
    color: "#A3C16C",
    glass: "rgba(163,193,108,0.6)",
  },
  {
    name: "Nutty",
    color: "#D9A066",
    glass: "rgba(217,160,102,0.6)",
  },
];

export default function FlavorSwitcher({ onChange }) {
  const [selected, setSelected] = useState(null);

  const handleClick = (flavor) => {
    setSelected(flavor.name);
    if (onChange) onChange(flavor);
    // Change site color
    document.body.style.background = `linear-gradient(135deg, ${flavor.color} 0%, #fff 100%)`;
  };

  return (
    <div
      style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        zIndex: 100,
        backdropFilter: "blur(16px)",
        background: selected
          ? FLAVORS.find((f) => f.name === selected)?.glass
          : "rgba(255,255,255,0.3)",
        borderRadius: "32px",
        boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
        padding: "32px 48px",
        display: "flex",
        gap: "32px",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {FLAVORS.map((flavor) => (
        <button
          key={flavor.name}
          onClick={() => handleClick(flavor)}
          style={{
            background: flavor.color,
            color: "#fff",
            border: selected === flavor.name ? "3px solid #fff" : "none",
            borderRadius: "16px",
            fontWeight: "bold",
            fontSize: "1.2rem",
            padding: "18px 32px",
            boxShadow: selected === flavor.name ? "0 0 16px #fff" : "none",
            cursor: "pointer",
            transition: "all 0.2s",
          }}
        >
          {flavor.name}
        </button>
      ))}
    </div>
  );
}
