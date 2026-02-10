/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "rgb(90 58 34 / <alpha-value>)",        /* #5A3A22 brown */
        "primary-light": "rgb(122 90 58 / <alpha-value>)",
        "primary-dark": "rgb(62 39 20 / <alpha-value>)",
        accent: "rgb(255 140 66 / <alpha-value>)",        /* #FF8C42 orange */
        "accent-light": "rgb(255 169 107 / <alpha-value>)",
        "accent-dark": "rgb(224 117 48 / <alpha-value>)",
        secondary: "rgb(31 122 99 / <alpha-value>)",      /* #1F7A63 green */
        "secondary-light": "rgb(42 158 128 / <alpha-value>)",
        "secondary-dark": "rgb(21 93 75 / <alpha-value>)",
        "brand-bg": "#F8F6F2",
        "brand-bg-warm": "#FFF9F0",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "system-ui", "sans-serif"],
        heading: ["var(--font-poppins)", "Poppins", "system-ui", "sans-serif"],
      },
      borderRadius: {
        DEFAULT: "0.75rem",
        "card": "1rem",
        "btn": "0.75rem",
      },
      boxShadow: {
        "card": "0 2px 16px rgba(90, 58, 34, 0.06)",
        "card-hover": "0 8px 30px rgba(90, 58, 34, 0.12)",
        "btn": "0 4px 14px rgba(255, 140, 66, 0.25)",
        "soft": "0 10px 30px rgba(90, 58, 34, 0.06)",
      },
    },
  },
  plugins: [],
};
