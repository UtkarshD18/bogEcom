import Link from "next/link";

export default function DeliveryPage() {
  return (
    <>
      <main className="min-h-screen bg-gradient-to-b from-orange-50 to-white py-12">
        <div className="container mx-auto px-4 max-w-5xl">
          {/* Header Section */}
          <div className="mb-12 text-center">
            <div className="inline-block bg-orange-100 text-orange-600 px-4 py-2 rounded-full text-sm font-semibold mb-4">
              📦 Shipping & Delivery
            </div>
            <h1 className="text-5xl font-bold text-gray-900 mb-4">
              Fast & Reliable Delivery
            </h1>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              We ensure your orders reach you safely and on time
            </p>
          </div>

          {/* Key Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
            <div className="bg-white rounded-lg shadow p-6 text-center">
              <div className="text-3xl font-bold text-orange-600 mb-2">
                2-10
              </div>
              <p className="text-gray-600 text-sm">Business Days</p>
            </div>
            <div className="bg-white rounded-lg shadow p-6 text-center">
              <div className="text-3xl font-bold text-orange-600 mb-2">₹0</div>
              <p className="text-gray-600 text-sm">On All Orders</p>
            </div>
            <div className="bg-white rounded-lg shadow p-6 text-center">
              <div className="text-3xl font-bold text-orange-600 mb-2">
                24/7
              </div>
              <p className="text-gray-600 text-sm">Support</p>
            </div>
            <div className="bg-white rounded-lg shadow p-6 text-center">
              <div className="text-3xl font-bold text-orange-600 mb-2">
                100%
              </div>
              <p className="text-gray-600 text-sm">Safe Delivery</p>
            </div>
          </div>

          {/* Delivery Timeline */}
          <section className="mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-8">
              Delivery Timeline
            </h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-orange-600">
                <h3 className="text-xl font-semibold text-gray-800 mb-3 flex items-center gap-2">
                  🏙️ Metro Cities
                </h3>
                <p className="text-gray-600 font-semibold text-lg">
                  2-3 business days
                </p>
                <p className="text-gray-500 mt-2">
                  Delhi, Mumbai, Bangalore, Hyderabad, Chennai
                </p>
              </div>
              <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-blue-600">
                <h3 className="text-xl font-semibold text-gray-800 mb-3 flex items-center gap-2">
                  🌆 Tier 1 Cities
                </h3>
                <p className="text-gray-600 font-semibold text-lg">
                  3-5 business days
                </p>
                <p className="text-gray-500 mt-2">
                  Major city areas and nearby regions
                </p>
              </div>
              <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-green-600">
                <h3 className="text-xl font-semibold text-gray-800 mb-3 flex items-center gap-2">
                  🏘️ Tier 2 & 3 Cities
                </h3>
                <p className="text-gray-600 font-semibold text-lg">
                  5-7 business days
                </p>
                <p className="text-gray-500 mt-2">Secondary cities and towns</p>
              </div>
              <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-purple-600">
                <h3 className="text-xl font-semibold text-gray-800 mb-3 flex items-center gap-2">
                  🗺️ Remote Areas
                </h3>
                <p className="text-gray-600 font-semibold text-lg">
                  7-10 business days
                </p>
                <p className="text-gray-500 mt-2">Rural and remote locations</p>
              </div>
            </div>
          </section>

          {/* Shipping Information */}
          <section className="mb-12 bg-white rounded-lg shadow p-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-6">
              Shipping Charges
            </h2>
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="text-3xl">✓</div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-800">
                    Free Shipping
                  </h3>
                  <p className="text-gray-600">
                    Shipping charges are free on every order.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Tracking Section */}
          <section className="mb-12 bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg shadow-lg p-8 text-white">
            <h2 className="text-3xl font-bold mb-4">📍 Track Your Order</h2>
            <p className="mb-4 text-orange-100">
              Receive a tracking ID via email once your order ships. Monitor
              your package in real-time with updates at every step.
            </p>
            <p className="text-sm opacity-90">
              Tracking updates sent via SMS and Email
            </p>
          </section>

          {/* Returns & Exchanges */}
          <section className="mb-12 bg-white rounded-lg shadow p-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-6">
              Returns & Exchanges
            </h2>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="text-4xl mb-3">📅</div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">
                  7-Day Window
                </h3>
                <p className="text-gray-600">
                  Return or exchange within 7 days of delivery
                </p>
              </div>
              <div className="text-center">
                <div className="text-4xl mb-3">📦</div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">
                  Original Condition
                </h3>
                <p className="text-gray-600">
                  Items must be unused with original packaging
                </p>
              </div>
              <div className="text-center">
                <div className="text-4xl mb-3">⭐</div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">
                  Customer Satisfaction
                </h3>
                <p className="text-gray-600">
                  Quality guaranteed on all orders
                </p>
              </div>
            </div>
          </section>

          {/* Support Section */}
          <section className="bg-blue-50 border-2 border-blue-200 rounded-lg p-8 text-center">
            <h3 className="text-2xl font-bold text-gray-900 mb-3">
              💬 Need Help?
            </h3>
            <p className="text-gray-700 mb-4">
              Our support team is available 24/7 to help
            </p>
            <div className="flex flex-col md:flex-row gap-4 justify-center items-center">
              <a
                href="mailto:support@healthyonegram.com"
                className="inline-block bg-orange-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-orange-700 transition"
              >
                📧 support@healthyonegram.com
              </a>
              <span className="text-gray-600">or</span>
              <Link
                href="/contact"
                className="inline-block bg-orange-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-orange-700 transition"
              >
                Contact Us
              </Link>
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
