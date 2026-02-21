"use client";
import Link from "next/link";
import {
  FiAlertCircle,
  FiCheck,
  FiCreditCard,
  FiLock,
  FiShield,
} from "react-icons/fi";
import { SiMastercard, SiVisa } from "react-icons/si";

const SecurePayment = () => {
  const securityFeatures = [
    {
      icon: <FiShield className="text-3xl" />,
      title: "256-bit SSL Encryption",
      description:
        "All your payment information is encrypted using industry-standard SSL technology.",
    },
    {
      icon: <FiLock className="text-3xl" />,
      title: "PCI DSS Compliant",
      description:
        "We follow Payment Card Industry Data Security Standards to protect your data.",
    },
    {
      icon: <FiCreditCard className="text-3xl" />,
      title: "Secure Payment Gateway",
      description:
        "Powered by PhonePe, one of India's most trusted payment platforms.",
    },
  ];

  const paymentMethods = [
    {
      name: "Credit Cards",
      icon: <SiVisa className="text-4xl text-blue-600" />,
    },
    {
      name: "Debit Cards",
      icon: <SiMastercard className="text-4xl text-red-500" />,
    },
    {
      name: "UPI",
      icon: <span className="text-2xl font-bold text-primary">UPI</span>,
    },
    { name: "Net Banking", icon: <span className="text-2xl">🏦</span> },
    { name: "Wallets", icon: <span className="text-2xl">💳</span> },
  ];

  const safetyTips = [
    "Never share your OTP or CVV with anyone",
    "Always check for the padlock icon in your browser",
    "Use strong, unique passwords for your account",
    "Enable two-factor authentication when available",
    "Regularly monitor your bank statements",
    "Report suspicious activity immediately",
  ];

  return (
    <section className="bg-gray-50 min-h-screen">
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f3460] text-white py-16">
        <div className="container mx-auto px-4 text-center">
          <div className="w-20 h-20 bg-[var(--flavor-glass)] rounded-full flex items-center justify-center mx-auto mb-6 text-primary">
            <FiShield className="text-green-400 text-4xl" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Secure Payment
          </h1>
          <p className="text-gray-300 text-lg max-w-2xl mx-auto">
            Your security is our top priority. Shop with confidence knowing your
            payments are protected.
          </p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-12">
        {/* Security Features */}
        <div className="mb-16">
          <h2 className="text-2xl font-bold text-gray-800 text-center mb-10">
            How We Protect You
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {securityFeatures.map((feature, index) => (
              <div
                key={index}
                className="bg-white rounded-xl p-8 shadow-md text-center hover:shadow-lg transition-shadow"
              >
                <div className="w-16 h-16 bg-[var(--flavor-glass)] rounded-full flex items-center justify-center mx-auto mb-4 text-primary">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-bold text-gray-800 mb-3">
                  {feature.title}
                </h3>
                <p className="text-gray-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Payment Gateway Partner */}
        <div className="bg-white rounded-xl p-8 shadow-md mb-16">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-gray-800 mb-4">
                Powered by PhonePe
              </h2>
              <p className="text-gray-600 mb-4">
                We've partnered with PhonePe, India's leading payment platform
                trusted by millions of businesses. Your transactions are
                processed securely with bank-grade security protocols.
              </p>
              <ul className="space-y-2">
                <li className="flex items-center gap-2 text-gray-600">
                  <FiCheck className="text-green-500" /> RBI regulated payment
                  gateway
                </li>
                <li className="flex items-center gap-2 text-gray-600">
                  <FiCheck className="text-green-500" /> Real-time transaction
                  monitoring
                </li>
                <li className="flex items-center gap-2 text-gray-600">
                  <FiCheck className="text-green-500" /> Fraud detection &
                  prevention
                </li>
              </ul>
            </div>
            <div className="flex items-center justify-center bg-gray-50 rounded-xl p-8">
              <span className="text-3xl font-bold text-primary">
                PhonePe
              </span>
            </div>
          </div>
        </div>

        {/* Accepted Payment Methods */}
        <div className="mb-16">
          <h2 className="text-2xl font-bold text-gray-800 text-center mb-10">
            Accepted Payment Methods
          </h2>
          <div className="flex flex-wrap justify-center gap-6">
            {paymentMethods.map((method, index) => (
              <div
                key={index}
                className="bg-white rounded-xl p-6 shadow-md text-center min-w-[140px] hover:shadow-lg transition-shadow"
              >
                <div className="h-12 flex items-center justify-center mb-3">
                  {method.icon}
                </div>
                <p className="text-gray-700 font-medium">{method.name}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Safety Tips */}
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl p-8 mb-16 border border-amber-200">
          <div className="flex items-start gap-4 mb-6">
            <FiAlertCircle className="text-amber-600 text-2xl shrink-0 mt-1" />
            <div>
              <h2 className="text-xl font-bold text-gray-800 mb-2">
                Stay Safe Online
              </h2>
              <p className="text-gray-600">
                Follow these tips to protect yourself while shopping online:
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {safetyTips.map((tip, index) => (
              <div
                key={index}
                className="flex items-center gap-3 bg-white/60 rounded-lg p-3"
              >
                <FiCheck className="text-green-500 shrink-0" />
                <span className="text-gray-700">{tip}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Contact Support */}
        <div className="bg-white rounded-xl p-8 shadow-md text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">
            Need Help with Payments?
          </h2>
          <p className="text-gray-600 mb-6 max-w-xl mx-auto">
            If you experience any issues with your payment or have questions
            about security, our support team is here to help.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/contact"
              className="inline-block px-8 py-3 bg-primary text-white font-semibold rounded-lg hover:brightness-110 transition-colors"
            >
              Contact Support
            </Link>
            <Link
              href="https://wa.me/918619641968"
              target="_blank"
              className="inline-block px-8 py-3 bg-primary text-white font-semibold rounded-lg hover:brightness-110 transition-colors"
            >
              Chat on WhatsApp
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
};

export default SecurePayment;
