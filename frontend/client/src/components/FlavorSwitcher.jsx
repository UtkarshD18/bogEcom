"use client";
import { useState } from "react";

const FLAVORS = [
  {
    name: "Creamy",
    color: "#F6E6C9",
    glass: "rgba(246,230,201,0.6)",
  },
  {
    name: "Chocolate",
    color: "#5A3A2E",
    glass: "rgba(90,58,46,0.6)",
  },
  {
    name: "Daizu",
    color: "#8FAE5D",
    glass: "rgba(143,174,93,0.6)",
  },
  {
    name: "Low-calorie",
    color: "#CFEFE8",
    glass: "rgba(207,239,232,0.6)",
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
