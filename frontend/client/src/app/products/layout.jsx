export const metadata = {
  title: "PRODUCTS PAGE",
  description: "PRODUCTS",
};

// src/app/products/layout.jsx
export default function ProductsLayout({ children }) {
  return <section className="overflow-x-hidden">{children}</section>;
}
