import Banners from "@/components/Banners";
import CatSlider from "@/components/CatSlider";
import HomeSlider from "@/components/HomeSlider";
import MembershipCTA from "@/components/MembershipCTA";
import PopularProducts from "@/components/PopularProducts";

export default function Home() {
  return (
    <>
      <div className="sliderWrapper bg-[#f1f1f1] py-5 pb-0">
        <HomeSlider />
        <CatSlider />
        <Banners />
        <PopularProducts />
        <MembershipCTA />
      </div>
    </>
  );
}
