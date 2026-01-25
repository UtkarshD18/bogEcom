"use client";

import { Button } from "@mui/material";
import { useRouter } from "next/navigation";
import { AiOutlineCheck } from "react-icons/ai";

export default function MembershipCTA() {
  const router = useRouter();
  return (
    <section className="bg-linear-to-r from-orange-600 to-orange-700 py-16 my-12">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          {/* Left - Text Content */}
          <div className="text-white">
            <h2 className="text-4xl font-bold mb-4">
              Join Our Buy One Gram Club
            </h2>
            <p className="text-xl mb-6 opacity-90">
              Get exclusive benefits, early access to new products, and special
              discounts on all your favorite health products.
            </p>

            <div className="space-y-3 mb-8">
              <div className="flex items-center gap-3">
                <AiOutlineCheck className="text-2xl" />
                <span>15% discount on all orders</span>
              </div>
              <div className="flex items-center gap-3">
                <AiOutlineCheck className="text-2xl" />
                <span>Free shipping on every purchase</span>
              </div>
              <div className="flex items-center gap-3">
                <AiOutlineCheck className="text-2xl" />
                <span>Exclusive member-only products</span>
              </div>
              <div className="flex items-center gap-3">
                <AiOutlineCheck className="text-2xl" />
                <span>Priority customer support</span>
              </div>
              <div className="flex items-center gap-3">
                <AiOutlineCheck className="text-2xl" />
                <span>Monthly wellness tips & guides</span>
              </div>
            </div>

            <Button
              onClick={() => router.push("/membership")}
              sx={{
                backgroundColor: "white",
                color: "#c1591c",
                fontWeight: "bold",
                px: 4,
                py: 1.5,
                cursor: "pointer",
                "&:hover": {
                  backgroundColor: "#f3f3f3",
                },
              }}
            >
              Explore Membership Plans
            </Button>
          </div>

          {/* Right - Benefits Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white bg-opacity-90 p-6 rounded-lg text-gray-900 border border-white border-opacity-30 hover:bg-opacity-100 transition-all duration-300 shadow-lg">
              <div className="text-4xl mb-3">💰</div>
              <h3 className="text-xl font-bold mb-2 text-gray-900">
                Save ₹2000+
              </h3>
              <p className="text-gray-700 text-sm">
                Annually with member discounts
              </p>
            </div>
            <div className="bg-white bg-opacity-90 p-6 rounded-lg text-gray-900 border border-white border-opacity-30 hover:bg-opacity-100 transition-all duration-300 shadow-lg">
              <div className="text-4xl mb-3">📦</div>
              <h3 className="text-xl font-bold mb-2 text-gray-900">
                Free Shipping
              </h3>
              <p className="text-gray-700 text-sm">On all your orders</p>
            </div>
            <div className="bg-white bg-opacity-90 p-6 rounded-lg text-gray-900 border border-white border-opacity-30 hover:bg-opacity-100 transition-all duration-300 shadow-lg">
              <div className="text-4xl mb-3">🎧</div>
              <h3 className="text-xl font-bold mb-2 text-gray-900">
                24/7 Support
              </h3>
              <p className="text-gray-700 text-sm">Dedicated member hotline</p>
            </div>
            <div className="bg-white bg-opacity-90 p-6 rounded-lg text-gray-900 border border-white border-opacity-30 hover:bg-opacity-100 transition-all duration-300 shadow-lg">
              <div className="text-4xl mb-3">🚀</div>
              <h3 className="text-xl font-bold mb-2 text-gray-900">
                Early Access
              </h3>
              <p className="text-gray-700 text-sm">To new product launches</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
