import Banners from "@/components/Banners";
import CatSlider from "@/components/CatSlider";
import HomeSlider from "@/components/HomeSlider";
import MembershipCTA from "@/components/MembershipCTA";
import PopularProducts from "@/components/PopularProducts";

export default function Home() {
  return (
    <>
      <style>{`
        body {
          background: linear-gradient(135deg, #4B2E2B 0%, #fff 100%);
          transition: background 0.6s ease;
        }
        
        .sliderWrapper,
        [data-theme-color] {
          transition: background 0.6s ease;
        }
      `}</style>
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
