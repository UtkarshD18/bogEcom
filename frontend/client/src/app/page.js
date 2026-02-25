import Banners from "@/components/Banners";
import CatSlider from "@/components/CatSlider";
import HomeSlider from "@/components/HomeSlider";
import MembershipCTA from "@/components/MembershipCTA";
import PopularProducts from "@/components/PopularProducts";

export default function Home() {
  return (
    <>
      <div
        className="sliderWrapper pb-0 w-full overflow-x-hidden"
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
