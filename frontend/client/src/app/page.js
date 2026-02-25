import Banners from "@/components/Banners";
import CatSlider from "@/components/CatSlider";
import HomeSlider from "@/components/HomeSlider";
import MembershipCTA from "@/components/MembershipCTA";
import PopularProducts from "@/components/PopularProducts";

export default function Home() {
  return (
    <>
      {/* Negative margin cancels out the global pt-[120px] md:pt-[100px] from ClientLayout */}
      <div
        className="sliderWrapper pb-0 -mt-[120px] md:-mt-[100px] w-full overflow-x-hidden"
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
