"use client";

const ProductDetail = ({ breadcrumb, hero, tabs, sections }) => {
  return (
    <section
      className="min-h-screen bg-gradient-to-br from-[var(--flavor-light)] via-[var(--flavor-glass)] to-[var(--flavor-hero)] py-4 sm:py-8"
      style={{ fontFamily: "'Sora', 'Segoe UI', sans-serif" }}
    >
      <div className="w-full max-w-[1200px] mx-auto px-3 sm:px-4">
        {breadcrumb}

        <div className="bg-white/75 backdrop-blur-xl border border-white/70 rounded-2xl sm:rounded-3xl shadow-[0_30px_80px_-55px_rgba(15,23,42,0.45)] p-4 sm:p-6 md:p-8 transition-all duration-500">
          {hero}
        </div>

        {tabs ? (
          <div className="bg-white/75 backdrop-blur-xl border border-white/70 rounded-2xl sm:rounded-3xl shadow-[0_24px_70px_-50px_rgba(30,41,59,0.55)] mt-8 p-6 md:p-8">
            {tabs}
          </div>
        ) : null}

        {sections}
      </div>
    </section>
  );
};

export default ProductDetail;