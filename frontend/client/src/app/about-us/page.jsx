"use client";

export default function AboutUsPage() {
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
            Nutrition without the{" "}
            <span style={{ color: "#02b290" }}>noise.</span>
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
            We built Buy One Gram to answer a simple question: Why is it so hard
            to find peanut butter that is exactly what it says it is? No palm
            oil, no hidden sugars—just pure, verified nutrition.
          </p>
        </div>

        {/* SECTION 2: THE "CARD" (Who We Are) */}
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
              Our Standard
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
              The "One Gram" Philosophy.
            </h2>
            <p
              style={{
                fontSize: "1.1rem",
                color: "#4a4a4a",
                marginBottom: "2rem",
                lineHeight: 1.6,
              }}
            >
              The peanut butter industry is crowded with misleading labels. We
              prefer transparency. Buy One Gram was founded to bridge the gap
              between premium ingredients and everyday nutrition. We source
              peanuts based on quality, not cost.
            </p>

            {/* Trust Grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "1.5rem",
              }}
            >
              <div>
                <h3
                  style={{
                    fontSize: "1.25rem",
                    fontWeight: 700,
                    color: "#111",
                    marginBottom: "0.25rem",
                  }}
                >
                  100%
                </h3>
                <p style={{ fontSize: "0.9rem", color: "#666", margin: 0 }}>
                  Roasted Peanuts
                </p>
              </div>
              <div>
                <h3
                  style={{
                    fontSize: "1.25rem",
                    fontWeight: 700,
                    color: "#111",
                    marginBottom: "0.25rem",
                  }}
                >
                  0g
                </h3>
                <p style={{ fontSize: "0.9rem", color: "#666", margin: 0 }}>
                  Added Sugar
                </p>
              </div>
              <div>
                <h3
                  style={{
                    fontSize: "1.25rem",
                    fontWeight: 700,
                    color: "#111",
                    marginBottom: "0.25rem",
                  }}
                >
                  FSSAI
                </h3>
                <p style={{ fontSize: "0.9rem", color: "#666", margin: 0 }}>
                  Certified Facility
                </p>
              </div>
              <div>
                <h3
                  style={{
                    fontSize: "1.25rem",
                    fontWeight: 700,
                    color: "#111",
                    marginBottom: "0.25rem",
                  }}
                >
                  No
                </h3>
                <p style={{ fontSize: "0.9rem", color: "#666", margin: 0 }}>
                  Palm Oil
                </p>
              </div>
            </div>
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

        {/* SECTION 3: CONTACT / FOOTER CARD */}
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
              Ready to level up?
            </h2>
            <p
              style={{
                color: "#aaa",
                fontSize: "1.1rem",
                marginBottom: "3rem",
                maxWidth: 600,
                margin: "0 auto 3rem auto",
              }}
            >
              Partner with us or reach out to learn more about our products.
            </p>

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                justifyContent: "center",
                gap: "2rem",
              }}
            >
              <div
                style={{
                  background: "rgba(255,255,255,0.08)",
                  padding: "2rem",
                  borderRadius: 16,
                  minWidth: 280,
                  textAlign: "left",
                  border: "1px solid rgba(255,255,255,0.1)",
                }}
              >
                <p
                  style={{
                    color: "#02b290",
                    fontSize: "0.85rem",
                    textTransform: "uppercase",
                    fontWeight: 700,
                    marginBottom: "0.75rem",
                    letterSpacing: "0.05em",
                  }}
                >
                  General Inquiries
                </p>
                <a
                  href="mailto:support@buyonegram.com"
                  style={{
                    color: "white",
                    textDecoration: "none",
                    fontSize: "1.2rem",
                    fontWeight: 500,
                  }}
                >
                  support@buyonegram.com
                </a>
              </div>
              <div
                style={{
                  background: "rgba(255,255,255,0.08)",
                  padding: "2rem",
                  borderRadius: 16,
                  minWidth: 280,
                  textAlign: "left",
                  border: "1px solid rgba(255,255,255,0.1)",
                }}
              >
                <p
                  style={{
                    color: "#02b290",
                    fontSize: "0.85rem",
                    textTransform: "uppercase",
                    fontWeight: 700,
                    marginBottom: "0.75rem",
                    letterSpacing: "0.05em",
                  }}
                >
                  Phone
                </p>
                <p
                  style={{
                    color: "white",
                    fontSize: "1.1rem",
                    margin: 0,
                    lineHeight: 1.5,
                  }}
                >
                  (+91) 8619-641-968
                </p>
              </div>
            </div>

            <footer
              style={{
                marginTop: "5rem",
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
