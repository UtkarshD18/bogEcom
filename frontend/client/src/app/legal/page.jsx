export default function LegalPage() {
  return (
    <>
      <main className="min-h-screen bg-gradient-to-b from-red-50 to-white py-12">
        <div className="container mx-auto px-4 max-w-5xl">
          {/* Header */}
          <div className="mb-12 text-center">
            <div className="inline-block bg-red-100 text-red-600 px-4 py-2 rounded-full text-sm font-semibold mb-4">
              ⚖️ Legal & Compliance
            </div>
            <h1 className="text-5xl font-bold text-gray-900 mb-4">
              Legal Notice
            </h1>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Important information about Healthy One Gram
            </p>
          </div>

          {/* Company Information Card */}
          <section className="mb-12 bg-white rounded-lg shadow-lg p-8 border-l-4 border-orange-600">
            <h2 className="text-3xl font-bold text-gray-900 mb-6 flex items-center gap-3">
              🏢 Company Information
            </h2>
            <div className="space-y-3 text-gray-700">
              <p className="text-lg font-semibold text-gray-800">
                Healthy One Gram - Mega Health Store
              </p>
              <p className="ml-4 flex items-center gap-2">
                <span className="text-orange-600">📍</span>
                Rajasthan Centre of Advanced Technology (R-CAT)
              </p>
              <p className="ml-4 flex items-center gap-2">
                <span className="text-orange-600">🏙️</span>
                Jaipur, Rajasthan, India
              </p>
            </div>
          </section>

          {/* Sections Grid */}
          <div className="grid md:grid-cols-2 gap-6 mb-12">
            {/* Intellectual Property */}
            <div className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition">
              <h3 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                📄 Intellectual Property Rights
              </h3>
              <p className="text-gray-700">
                All content on this website, including text, graphics, logos,
                images, and software, is the property of Healthy One Gram or its
                content suppliers and protected by international copyright laws.
                Unauthorized reproduction is prohibited.
              </p>
            </div>

            {/* Product Liability */}
            <div className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition">
              <h3 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                🏭 Product Liability
              </h3>
              <p className="text-gray-700">
                All products are manufactured in compliance with relevant food
                safety standards. We are not responsible for allergic reactions
                or adverse effects if users fail to read product labels and
                ingredients carefully.
              </p>
            </div>

            {/* Disclaimer */}
            <div className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition">
              <h3 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                ⚠️ Medical Disclaimer
              </h3>
              <p className="text-gray-700">
                Information provided is for educational purposes only and should
                not be considered medical advice. Always consult with a
                healthcare professional before using any health products or
                changing your diet.
              </p>
            </div>

            {/* Liability Limitation */}
            <div className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition">
              <h3 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                ⚡ Limitation of Liability
              </h3>
              <p className="text-gray-700">
                Healthy One Gram shall not be liable for any indirect,
                incidental, special, consequential, or punitive damages
                resulting from the use of our website or products.
              </p>
            </div>
          </div>

          {/* Additional Policies */}
          <section className="bg-gradient-to-r from-orange-50 to-yellow-50 rounded-lg shadow p-8 mb-12 border border-orange-200">
            <h3 className="text-2xl font-bold text-gray-900 mb-6">
              📋 Key Policies
            </h3>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="flex gap-4">
                <span className="text-2xl">✓</span>
                <div>
                  <p className="font-semibold text-gray-800">Data Protection</p>
                  <p className="text-gray-600 text-sm">
                    Your personal information is protected and never sold to
                    third parties
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <span className="text-2xl">✓</span>
                <div>
                  <p className="font-semibold text-gray-800">
                    Secure Transactions
                  </p>
                  <p className="text-gray-600 text-sm">
                    All payments are encrypted and processed through secure
                    gateways
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <span className="text-2xl">✓</span>
                <div>
                  <p className="font-semibold text-gray-800">Compliance</p>
                  <p className="text-gray-600 text-sm">
                    We comply with all applicable laws and regulations
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <span className="text-2xl">✓</span>
                <div>
                  <p className="font-semibold text-gray-800">
                    Quality Assurance
                  </p>
                  <p className="text-gray-600 text-sm">
                    All products meet strict quality and safety standards
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Contact Section */}
          <section className="bg-red-50 border-2 border-red-200 rounded-lg p-8 text-center">
            <h3 className="text-2xl font-bold text-gray-900 mb-3">
              ❓ Legal Questions?
            </h3>
            <p className="text-gray-700 mb-6">
              We're here to help clarify any legal concerns
            </p>
            <a
              href="mailto:support@healthyonegram.com"
              className="inline-block bg-orange-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-orange-700 transition"
            >
              📧 Contact Legal Team
            </a>
          </section>

          {/* Last Updated */}
          <p className="text-center text-gray-500 text-sm mt-8">
            Last updated: January 2026
          </p>
        </div>
      </main>
    </>
  );
}
