export default function TermsPage() {
  const sections = [
    {
      num: "1",
      title: "Acceptance of Terms",
      icon: "✅",
      content:
        "By accessing and using this website, you accept and agree to be bound by these terms. If you do not agree, please do not use this service.",
    },
    {
      num: "2",
      title: "Use License",
      icon: "📋",
      content:
        "You may temporarily download materials for personal, non-commercial use only. You may not modify, copy, use commercially, or remove copyright notices from materials.",
    },
    {
      num: "3",
      title: "Disclaimer",
      icon: "⚠️",
      content:
        "Materials are provided 'as is' without warranties. Healthy One Gram disclaims all implied warranties including merchantability and fitness for particular purpose.",
    },
    {
      num: "4",
      title: "Limitations",
      icon: "🔒",
      content:
        "Healthy One Gram is not liable for damages from use or inability to use website materials, including loss of data or profits.",
    },
    {
      num: "5",
      title: "Accuracy of Materials",
      icon: "🔍",
      content:
        "While we strive for accuracy, materials may contain technical or typographical errors. We do not warrant that all materials are accurate or complete.",
    },
    {
      num: "6",
      title: "External Links",
      icon: "🔗",
      content:
        "We are not responsible for content on linked websites. Links do not imply endorsement. Use linked sites at your own risk.",
    },
    {
      num: "7",
      title: "Modifications",
      icon: "♻️",
      content:
        "We may revise these terms without notice. By using our website, you agree to be bound by the current version.",
    },
    {
      num: "8",
      title: "Governing Law",
      icon: "⚖️",
      content:
        "These terms are governed by Indian law. You irrevocably submit to the jurisdiction of courts in India.",
    },
  ];

  return (
    <>
      <main className="min-h-screen bg-gradient-to-b from-blue-50 to-white py-12">
        <div className="container mx-auto px-4 max-w-5xl">
          {/* Header */}
          <div className="mb-12 text-center">
            <div className="inline-block bg-blue-100 text-blue-600 px-4 py-2 rounded-full text-sm font-semibold mb-4">
              📜 Terms & Conditions
            </div>
            <h1 className="text-5xl font-bold text-gray-900 mb-4">
              Terms and Conditions of Use
            </h1>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Please read these terms carefully before using our website
            </p>
          </div>

          {/* Table of Contents */}
          <div className="bg-white rounded-lg shadow p-6 mb-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              📑 Quick Navigation
            </h2>
            <div className="grid md:grid-cols-2 gap-3">
              {sections.map((section) => (
                <a
                  key={section.num}
                  href={`#section-${section.num}`}
                  className="text-orange-600 hover:text-orange-700 font-medium transition"
                >
                  {section.num}. {section.title}
                </a>
              ))}
            </div>
          </div>

          {/* Terms Sections */}
          <div className="space-y-6 mb-12">
            {sections.map((section) => (
              <div
                key={section.num}
                id={`section-${section.num}`}
                className="bg-white rounded-lg shadow-md p-8 hover:shadow-lg transition border-l-4 border-orange-600"
              >
                <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-3">
                  <span className="text-3xl">{section.icon}</span>
                  {section.num}. {section.title}
                </h2>
                <p className="text-gray-700 leading-relaxed">
                  {section.content}
                </p>
              </div>
            ))}
          </div>

          {/* Important Notice */}
          <section className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg shadow-lg p-8 text-white mb-12">
            <h3 className="text-2xl font-bold mb-4 flex items-center gap-2">
              ⚡ Important Notice
            </h3>
            <p className="mb-3 text-orange-100">
              By using Healthy One Gram, you acknowledge that you have read,
              understood, and agree to be bound by all terms and conditions
              outlined above.
            </p>
            <p className="text-sm opacity-90">
              These terms are subject to change at any time. Continued use of
              the website following any changes constitutes your acceptance of
              the new terms.
            </p>
          </section>

          {/* Your Rights & Responsibilities */}
          <section className="grid md:grid-cols-2 gap-6 mb-12">
            <div className="bg-green-50 rounded-lg p-6 border border-green-200">
              <h3 className="text-xl font-bold text-green-900 mb-4 flex items-center gap-2">
                ✅ Your Rights
              </h3>
              <ul className="space-y-3">
                <li className="flex gap-2">
                  <span className="text-green-600">✓</span>
                  <span>Access our website for personal use</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-green-600">✓</span>
                  <span>Browse and purchase products</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-green-600">✓</span>
                  <span>Request refunds within 7 days</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-green-600">✓</span>
                  <span>Contact customer support anytime</span>
                </li>
              </ul>
            </div>

            <div className="bg-red-50 rounded-lg p-6 border border-red-200">
              <h3 className="text-xl font-bold text-red-900 mb-4 flex items-center gap-2">
                ❌ Prohibited Actions
              </h3>
              <ul className="space-y-3">
                <li className="flex gap-2">
                  <span className="text-red-600">✕</span>
                  <span>Reproduce or modify content</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-red-600">✕</span>
                  <span>Use for commercial purposes</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-red-600">✕</span>
                  <span>Attempt to hack or reverse engineer</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-red-600">✕</span>
                  <span>Harass or abuse other users</span>
                </li>
              </ul>
            </div>
          </section>

          {/* Contact Section */}
          <section className="bg-blue-50 border-2 border-blue-200 rounded-lg p-8 text-center">
            <h3 className="text-2xl font-bold text-gray-900 mb-3">
              ❓ Need Clarification?
            </h3>
            <p className="text-gray-700 mb-6">
              If you have questions about our terms and conditions, we're happy
              to help
            </p>
            <a
              href="mailto:support@healthyonegram.com"
              className="inline-block bg-orange-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-orange-700 transition"
            >
              📧 Contact Support
            </a>
          </section>

          {/* Last Updated */}
          <p className="text-center text-gray-500 text-sm mt-8">
            Last updated: January 2026 | Version 1.0
          </p>
        </div>
      </main>
    </>
  );
}
