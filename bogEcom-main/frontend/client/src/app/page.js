import Banners from "@/components/Banners";
import CatSlider from "@/components/CatSlider";
import HomeSlider from "@/components/HomeSlider";
import MembershipCTA from "@/components/MembershipCTA";
import PopularProducts from "@/components/PopularProducts";

export default function Home() {
  return (
    <>
      {/* Negative margin cancels out the global pt-[130px] md:pt-[110px] from ClientLayout */}
      {/* Mobile: -mt-[100px] to account for shorter mobile header spacing */}
      {/* Desktop: -mt-[110px] unchanged for pixel-perfect desktop layout */}
      <div
        className="sliderWrapper pb-0 -mt-[100px] md:-mt-[110px] w-full overflow-x-hidden"
        style={{
          background: "var(--flavor-gradient)",
          transition: "background 0.5s cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      >
        <HomeSlider />
        <CatSlider />
        <Banners />
        <PopularProducts />
        <MembershipCTA />
      </div>
    </>
  );
}
