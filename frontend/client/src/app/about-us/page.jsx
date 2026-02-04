"use client";

import { CircularProgress } from "@mui/material";
import Link from "next/link";
import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_APP_API_URL || "http://localhost:8000";

/**
 * About Us Page
 * Fetches content from API - fully editable by admin
 */
export default function AboutUsPage() {
  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchContent();
  }, []);

  const fetchContent = async () => {
    try {
      const response = await fetch(`${API_URL}/api/about/public`);
      const data = await response.json();

      if (data.success && data.data) {
        setContent(data.data);
      }
    } catch (error) {
      console.error("Error fetching about content:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <CircularProgress />
      </div>
    );
  }

  if (!content) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-gray-500">Unable to load content</p>
      </div>
    );
  }

  const { hero, standard, whyUs, values, cta } = content;

  return (
    <div
      style={{
        width: "100%",
        minHeight: "100vh",
        paddingTop: "2rem",
        paddingBottom: "4rem",
        paddingLeft: "1.5rem",
        paddingRight: "1.5rem",
        backgroundColor: "#f9fbfb",
        fontFamily:
          "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      <main style={{ maxWidth: 1100, margin: "0 auto" }}>
        {/* SECTION 1: HERO / MISSION STATEMENT */}
        <div
          style={{
            textAlign: "center",
            maxWidth: 800,
            margin: "0 auto 5rem auto",
          }}
        >
          <h1
            style={{
              fontSize: "clamp(2.5rem, 5vw, 3.5rem)",
              fontWeight: 800,
              color: "#1a1a1a",
              lineHeight: 1.1,
              marginBottom: "1.5rem",
              letterSpacing: "-0.03em",
            }}
          >
            {hero?.title}{" "}
            <span style={{ color: "#02b290" }}>{hero?.titleHighlight}</span>
          </h1>
          <p
            style={{
              color: "#555",
              fontSize: "1.25rem",
              lineHeight: 1.6,
              maxWidth: 650,
              margin: "0 auto",
            }}
          >
            {hero?.description}
          </p>
        </div>

        {/* SECTION 2: THE "CARD" (Our Standard) */}
        <section
          style={{
            background: "rgba(255, 255, 255, 0.9)",
            backdropFilter: "blur(20px)",
            borderRadius: 24,
            border: "1px solid rgba(0,0,0,0.08)",
            boxShadow: "0 20px 40px rgba(0,0,0,0.06)",
            overflow: "hidden",
            display: "flex",
            flexWrap: "wrap",
            marginBottom: "4rem",
          }}
        >
          <div style={{ flex: 1, minWidth: 320, padding: "3.5rem" }}>
            <h6
              style={{
                textTransform: "uppercase",
                fontSize: "0.85rem",
                fontWeight: 700,
                letterSpacing: "0.1em",
                color: "#02b290",
                marginBottom: "1rem",
              }}
            >
              {standard?.subtitle}
            </h6>
            <h2
              style={{
                fontSize: "2.2rem",
                fontWeight: 700,
                color: "#111",
                marginBottom: "1.5rem",
                letterSpacing: "-0.02em",
                lineHeight: 1.2,
              }}
            >
              {standard?.title}
            </h2>
            <p
              style={{
                fontSize: "1.1rem",
                color: "#4a4a4a",
                marginBottom: "2rem",
                lineHeight: 1.6,
              }}
            >
              {standard?.description}
            </p>

            {/* Stats Grid */}
            {standard?.stats?.length > 0 && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "1.5rem",
                }}
              >
                {standard.stats.map((stat, index) => (
                  <div key={index}>
                    <h3
                      style={{
                        fontSize: "1.25rem",
                        fontWeight: 700,
                        color: "#111",
                        marginBottom: "0.25rem",
                      }}
                    >
                      {stat.value}
                    </h3>
                    <p style={{ fontSize: "0.9rem", color: "#666", margin: 0 }}>
                      {stat.label}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Image Section */}
          <div
            style={{
              flex: 1,
              minWidth: 320,
              position: "relative",
              minHeight: 400,
            }}
          >
            <img
              src="https://images.pexels.com/photos/8845396/pexels-photo-8845396.jpeg?auto=compress&cs=tinysrgb&w=800"
              alt="Buy One Gram Product Focus"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                position: "absolute",
                top: 0,
                left: 0,
              }}
            />
          </div>
        </section>

        {/* SECTION 3: WHY US */}
        {whyUs?.features?.length > 0 && (
          <section style={{ marginBottom: "4rem" }}>
            <div style={{ textAlign: "center", marginBottom: "3rem" }}>
              <h6
                style={{
                  textTransform: "uppercase",
                  fontSize: "0.85rem",
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                  color: "#02b290",
                  marginBottom: "0.5rem",
                }}
              >
                {whyUs?.subtitle}
              </h6>
              <h2
                style={{
                  fontSize: "2rem",
                  fontWeight: 700,
                  color: "#111",
                }}
              >
                {whyUs?.title}
              </h2>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
                gap: "1.5rem",
              }}
            >
              {whyUs.features.map((feature, index) => (
                <div
                  key={index}
                  style={{
                    background: "white",
                    borderRadius: 16,
                    padding: "2rem",
                    boxShadow: "0 4px 16px rgba(0,0,0,0.04)",
                    border: "1px solid rgba(0,0,0,0.06)",
                  }}
                >
                  <span
                    style={{
                      fontSize: "2rem",
                      marginBottom: "1rem",
                      display: "block",
                    }}
                  >
                    {feature.icon}
                  </span>
                  <h3
                    style={{
                      fontSize: "1.1rem",
                      fontWeight: 600,
                      color: "#111",
                      marginBottom: "0.5rem",
                    }}
                  >
                    {feature.title}
                  </h3>
                  <p
                    style={{
                      fontSize: "0.95rem",
                      color: "#666",
                      margin: 0,
                      lineHeight: 1.5,
                    }}
                  >
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* SECTION 4: VALUES */}
        {values?.items?.length > 0 && (
          <section style={{ marginBottom: "4rem" }}>
            <div style={{ textAlign: "center", marginBottom: "3rem" }}>
              <h6
                style={{
                  textTransform: "uppercase",
                  fontSize: "0.85rem",
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                  color: "#02b290",
                  marginBottom: "0.5rem",
                }}
              >
                {values?.subtitle}
              </h6>
              <h2
                style={{
                  fontSize: "2rem",
                  fontWeight: 700,
                  color: "#111",
                }}
              >
                {values?.title}
              </h2>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                gap: "1.5rem",
              }}
            >
              {values.items.map((item, index) => (
                <div
                  key={index}
                  style={{
                    background:
                      "linear-gradient(135deg, #f8fffe 0%, #fff 100%)",
                    borderRadius: 16,
                    padding: "2rem",
                    borderLeft: "4px solid #02b290",
                  }}
                >
                  <h3
                    style={{
                      fontSize: "1.1rem",
                      fontWeight: 600,
                      color: "#111",
                      marginBottom: "0.75rem",
                    }}
                  >
                    {item.title}
                  </h3>
                  <p
                    style={{
                      fontSize: "0.95rem",
                      color: "#666",
                      margin: 0,
                      lineHeight: 1.6,
                    }}
                  >
                    {item.description}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* SECTION 5: CTA */}
        <section
          style={{
            backgroundColor: "#111",
            borderRadius: 24,
            padding: "4rem 2rem",
            color: "white",
            textAlign: "center",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* Subtle background glow */}
          <div
            style={{
              position: "absolute",
              top: "-50%",
              left: "50%",
              transform: "translateX(-50%)",
              width: 600,
              height: 600,
              background:
                "radial-gradient(circle, rgba(2,178,144,0.15) 0%, rgba(0,0,0,0) 70%)",
              pointerEvents: "none",
            }}
          />

          <div style={{ position: "relative", zIndex: 1 }}>
            <h2
              style={{
                fontSize: "2rem",
                fontWeight: 700,
                marginBottom: "1rem",
              }}
            >
              {cta?.title}
            </h2>
            <p
              style={{
                color: "#aaa",
                fontSize: "1.1rem",
                marginBottom: "2rem",
                maxWidth: 600,
                margin: "0 auto 2rem auto",
              }}
            >
              {cta?.description}
            </p>

            {cta?.buttonText && (
              <Link
                href={cta?.buttonLink || "/products"}
                style={{
                  display: "inline-block",
                  background: "#02b290",
                  color: "white",
                  padding: "1rem 2.5rem",
                  borderRadius: 12,
                  fontWeight: 600,
                  fontSize: "1rem",
                  textDecoration: "none",
                  transition: "all 0.2s ease",
                }}
              >
                {cta.buttonText}
              </Link>
            )}

            <footer
              style={{
                marginTop: "4rem",
                borderTop: "1px solid rgba(255,255,255,0.1)",
                paddingTop: "2rem",
                fontSize: "0.9rem",
                color: "#666",
              }}
            >
              &copy; {new Date().getFullYear()} Buy One Gram Private Limited.
            </footer>
          </div>
        </section>
      </main>
    </div>
  );
}
