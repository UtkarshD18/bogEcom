"use client";
import { Button, TextField } from "@mui/material";
import Link from "next/link";
import { useState } from "react";
import { FiClock, FiMail, FiMapPin, FiPhone, FiSend } from "react-icons/fi";
import { IoChatboxOutline } from "react-icons/io5";

const Contact = () => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    subject: "",
    message: "",
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setLoading(true);
    // Simulate form submission
    setTimeout(() => {
      setLoading(false);
      setSuccess(true);
      setFormData({ name: "", email: "", phone: "", subject: "", message: "" });
      setTimeout(() => setSuccess(false), 5000);
    }, 1500);
  };

  return (
    <section className="bg-gray-50 min-h-screen">
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f3460] text-white py-16">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Contact Us</h1>
          <p className="text-gray-300 text-lg max-w-2xl mx-auto">
            Have questions? We'd love to hear from you. Send us a message and
            we'll respond as soon as possible.
          </p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Contact Info Cards */}
          <div className="lg:col-span-1 space-y-6">
            {/* Address Card */}
            <div className="bg-white rounded-xl p-6 shadow-md hover:shadow-lg transition-shadow">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-[var(--flavor-glass)] rounded-full flex items-center justify-center shrink-0">
                  <FiMapPin className="text-primary text-xl" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-800 mb-2">Our Address</h3>
                  <p className="text-gray-600 text-sm leading-relaxed">
                    Healthy One Gram – Mega Health Store
                    <br />
                    Rajasthan Centre of Advanced Technology (R-CAT)
                    <br />
                    Jaipur, Rajasthan, India
                  </p>
                </div>
              </div>
            </div>

            {/* Phone Card */}
            <div className="bg-white rounded-xl p-6 shadow-md hover:shadow-lg transition-shadow">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-[var(--flavor-glass)] rounded-full flex items-center justify-center shrink-0">
                  <FiPhone className="text-primary text-xl" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-800 mb-2">Phone Number</h3>
                  <a
                    href="tel:+918619641968"
                    className="text-primary font-semibold hover:underline"
                  >
                    (+91) 8619-641-968
                  </a>
                  <p className="text-gray-500 text-sm mt-1">
                    Mon - Sat: 9:00 AM - 6:00 PM
                  </p>
                </div>
              </div>
            </div>

            {/* Email Card */}
            <div className="bg-white rounded-xl p-6 shadow-md hover:shadow-lg transition-shadow">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-[var(--flavor-glass)] rounded-full flex items-center justify-center shrink-0">
                  <FiMail className="text-primary text-xl" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-800 mb-2">
                    Email Address
                  </h3>
                  <a
                    href="mailto:support@healthyonegram.com"
                    className="text-primary font-semibold hover:underline"
                  >
                    support@healthyonegram.com
                  </a>
                  <p className="text-gray-500 text-sm mt-1">
                    We reply within 24 hours
                  </p>
                </div>
              </div>
            </div>

            {/* WhatsApp Card */}
            <Link
              href="https://wa.me/918619641968?text=Hello%20Healthy%20One%20Gram,%20I%20need%20help%20with..."
              target="_blank"
              className="block bg-gradient-to-r from-green-500 to-green-600 rounded-xl p-6 shadow-md hover:shadow-lg transition-all hover:-translate-y-1"
            >
              <div className="flex items-center gap-4 text-white">
                <IoChatboxOutline className="text-4xl" />
                <div>
                  <h3 className="font-bold mb-1">Chat on WhatsApp</h3>
                  <p className="text-green-100 text-sm">Get instant support</p>
                </div>
              </div>
            </Link>

            {/* Business Hours */}
            <div className="bg-white rounded-xl p-6 shadow-md">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-[var(--flavor-glass)] rounded-full flex items-center justify-center shrink-0">
                  <FiClock className="text-primary text-xl" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-800 mb-3">
                    Business Hours
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Monday - Friday</span>
                      <span className="text-gray-800 font-medium">
                        9:00 AM - 6:00 PM
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Saturday</span>
                      <span className="text-gray-800 font-medium">
                        10:00 AM - 4:00 PM
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Sunday</span>
                      <span className="text-red-500 font-medium">Closed</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Contact Form */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl p-8 shadow-md">
              <h2 className="text-2xl font-bold text-gray-800 mb-2">
                Send us a Message
              </h2>
              <p className="text-gray-500 mb-8">
                Fill out the form below and we'll get back to you shortly.
              </p>

              {success && (
                <div className="mb-6 p-4 bg-[var(--flavor-card-bg)] border border-primary rounded-lg text-primary">
                  ✓ Thank you! Your message has been sent successfully. We'll
                  get back to you soon.
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <TextField
                    label="Your Name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    fullWidth
                    variant="outlined"
                  />
                  <TextField
                    label="Email Address"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    fullWidth
                    variant="outlined"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <TextField
                    label="Phone Number"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    fullWidth
                    variant="outlined"
                  />
                  <TextField
                    label="Subject"
                    name="subject"
                    value={formData.subject}
                    onChange={handleChange}
                    required
                    fullWidth
                    variant="outlined"
                  />
                </div>

                <TextField
                  label="Your Message"
                  name="message"
                  value={formData.message}
                  onChange={handleChange}
                  required
                  fullWidth
                  multiline
                  rows={6}
                  variant="outlined"
                />

                <Button
                  type="submit"
                  disabled={loading}
                  sx={{
                    backgroundColor: "var(--primary)",
                    color: "white",
                    textTransform: "none",
                    fontWeight: 600,
                    padding: "14px 32px",
                    borderRadius: "8px",
                    fontSize: "16px",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    "&:hover": {
                      backgroundColor: "#a04a17",
                    },
                    "&:disabled": {
                      backgroundColor: "#ccc",
                    },
                  }}
                >
                  {loading ? (
                    <>Sending...</>
                  ) : (
                    <>
                      <FiSend /> Send Message
                    </>
                  )}
                </Button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Contact;
