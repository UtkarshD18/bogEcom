"use client";

import cookies from "js-cookie";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function MembershipPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [membershipStatus, setMembershipStatus] = useState(null);
  const [activePlan, setActivePlan] = useState(null);
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      const token = cookies.get("accessToken");
      if (token) {
        setIsLoggedIn(true);
        // Fetch membership status
        try {
          const res = await fetch(`${API_URL}/api/membership/status`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const data = await res.json();
          if (data.success) {
            setMembershipStatus(data.data);
          }
        } catch (err) {
          console.error("Failed to fetch membership status:", err);
        }
      }
      // Fetch active plan
      try {
        const res = await fetch(`${API_URL}/api/membership/active`);
        const data = await res.json();
        if (data.success) {
          setActivePlan(data.data);
        }
      } catch (err) {
        console.error("Failed to fetch active plan:", err);
      }
      setIsLoading(false);
    };
    checkAuth();
  }, []);

  const handleSubscribe = () => {
    if (!isLoggedIn) {
      router.push("/login?redirect=/membership");
      return;
    }
    if (membershipStatus?.isMember && !membershipStatus?.isExpired) {
      // Already a member
      return;
    }
    router.push("/membership/checkout");
  };

  if (isLoading) {
    return (
      <div style={{ textAlign: "center", paddingTop: "100px" }}>Loading...</div>
    );
  }

  const isMemberActive =
    membershipStatus?.isMember && !membershipStatus?.isExpired;

  return (
    <main
      style={{
        maxWidth: 1000,
        margin: "120px auto 3rem auto",
        padding: "2.5rem 1.5rem 2.5rem 1.5rem",
        fontFamily: "Inter, system-ui, sans-serif",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <header style={{ textAlign: "center", marginBottom: "3rem" }}>
        <h1
          style={{
            fontSize: "3.5rem",
            fontWeight: 900,
            background: "linear-gradient(135deg, #ff6b35 0%, #c1591c 100%)",
            backgroundClip: "text",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            marginBottom: 12,
          }}
        >
          {activePlan?.name || "Buy One Gram Club"}
        </h1>
        <p
          style={{
            color: "#555",
            fontSize: "1.3rem",
            maxWidth: 700,
            margin: "0 auto",
            fontWeight: 500,
          }}
        >
          {activePlan?.description ||
            "Join our exclusive community and unlock premium benefits designed for your wellness journey"}
        </p>
        {isMemberActive && (
          <div
            style={{
              marginTop: 20,
              padding: "12px 24px",
              background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
              color: "#fff",
              borderRadius: 12,
              display: "inline-block",
              fontWeight: 600,
            }}
          >
            ✓ You're a Member! Expires:{" "}
            {new Date(membershipStatus.membershipExpiry).toLocaleDateString()}
          </div>
        )}
      </header>

      <section style={{ marginBottom: "3rem" }}>
        <h2
          style={{
            textAlign: "center",
            color: "#ff6b35",
            fontWeight: 800,
            fontSize: "2.2rem",
            marginBottom: 24,
          }}
        >
          Unlock Exclusive Benefits
        </h2>
        <p
          style={{
            textAlign: "center",
            color: "#666",
            fontSize: "1.1rem",
            marginBottom: 32,
            maxWidth: 600,
            margin: "0 auto 32px",
          }}
        >
          Start earning rewards today and take your health journey to the next
          level with premium perks
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 24,
            marginBottom: 32,
          }}
        >
          <div
            style={{
              background: "linear-gradient(135deg, #fff5f0 0%, #ffe8db 100%)",
              borderRadius: 20,
              padding: 28,
              boxShadow: "0 4px 20px rgba(255, 107, 53, 0.1)",
              border: "2px solid #ff6b35",
            }}
          >
            <div style={{ fontSize: 52, marginBottom: 16 }}>🏆</div>
            <h3
              style={{
                color: "#c1591c",
                fontWeight: 800,
                fontSize: "1.2rem",
                marginBottom: 10,
              }}
            >
              Earn Points
            </h3>
            <p style={{ color: "#555", fontSize: "1rem", lineHeight: "1.6" }}>
              Get 1 point for every ₹1 spent. Redeem points for discounts and
              exclusive products.
            </p>
          </div>

          <div
            style={{
              background: "linear-gradient(135deg, #fff5f0 0%, #ffe8db 100%)",
              borderRadius: 20,
              padding: 28,
              boxShadow: "0 4px 20px rgba(255, 107, 53, 0.1)",
              border: "2px solid #ff6b35",
            }}
          >
            <div style={{ fontSize: 52, marginBottom: 16 }}>🚀</div>
            <h3
              style={{
                color: "#c1591c",
                fontWeight: 800,
                fontSize: "1.2rem",
                marginBottom: 10,
              }}
            >
              Early Access
            </h3>
            <p style={{ color: "#555", fontSize: "1rem", lineHeight: "1.6" }}>
              Be the first to try our latest products before they're available
              to the public.
            </p>
          </div>

          <div
            style={{
              background: "linear-gradient(135deg, #fff5f0 0%, #ffe8db 100%)",
              borderRadius: 20,
              padding: 28,
              boxShadow: "0 4px 20px rgba(255, 107, 53, 0.1)",
              border: "2px solid #ff6b35",
            }}
          >
            <div style={{ fontSize: 52, marginBottom: 16 }}>💰</div>
            <h3
              style={{
                color: "#c1591c",
                fontWeight: 800,
                fontSize: "1.2rem",
                marginBottom: 10,
              }}
            >
              Special Discounts
            </h3>
            <p style={{ color: "#555", fontSize: "1rem", lineHeight: "1.6" }}>
              Enjoy exclusive pricing and promotions available only to our
              members.
            </p>
          </div>

          <div
            style={{
              background: "linear-gradient(135deg, #fff5f0 0%, #ffe8db 100%)",
              borderRadius: 20,
              padding: 28,
              boxShadow: "0 4px 20px rgba(255, 107, 53, 0.1)",
              border: "2px solid #ff6b35",
            }}
          >
            <div style={{ fontSize: 52, marginBottom: 16 }}>📦</div>
            <h3
              style={{
                color: "#c1591c",
                fontWeight: 800,
                fontSize: "1.2rem",
                marginBottom: 10,
              }}
            >
              Free Shipping
            </h3>
            <p style={{ color: "#555", fontSize: "1rem", lineHeight: "1.6" }}>
              Enjoy free shipping on all orders above ₹500. No hidden charges.
            </p>
          </div>

          <div
            style={{
              background: "linear-gradient(135deg, #fff5f0 0%, #ffe8db 100%)",
              borderRadius: 20,
              padding: 28,
              boxShadow: "0 4px 20px rgba(255, 107, 53, 0.1)",
              border: "2px solid #ff6b35",
            }}
          >
            <div style={{ fontSize: 52, marginBottom: 16 }}>🎁</div>
            <h3
              style={{
                color: "#c1591c",
                fontWeight: 800,
                fontSize: "1.2rem",
                marginBottom: 10,
              }}
            >
              Birthday Gifts
            </h3>
            <p style={{ color: "#555", fontSize: "1rem", lineHeight: "1.6" }}>
              Receive special birthday surprises and exclusive member-only
              offers monthly.
            </p>
          </div>

          <div
            style={{
              background: "linear-gradient(135deg, #fff5f0 0%, #ffe8db 100%)",
              borderRadius: 20,
              padding: 28,
              boxShadow: "0 4px 20px rgba(255, 107, 53, 0.1)",
              border: "2px solid #ff6b35",
            }}
          >
            <div style={{ fontSize: 52, marginBottom: 16 }}>👥</div>
            <h3
              style={{
                color: "#c1591c",
                fontWeight: 800,
                fontSize: "1.2rem",
                marginBottom: 10,
              }}
            >
              VIP Support
            </h3>
            <p style={{ color: "#555", fontSize: "1rem", lineHeight: "1.6" }}>
              Get priority customer support and personalized recommendations.
            </p>
          </div>
        </div>

        <div style={{ textAlign: "center", marginTop: 40 }}>
          {activePlan && (
            <div style={{ marginBottom: 20 }}>
              <span
                style={{
                  fontSize: "2.5rem",
                  fontWeight: 800,
                  color: "#c1591c",
                }}
              >
                ₹{activePlan.price}
              </span>
              {activePlan.originalPrice > activePlan.price && (
                <span
                  style={{
                    fontSize: "1.2rem",
                    color: "#999",
                    textDecoration: "line-through",
                    marginLeft: 12,
                  }}
                >
                  ₹{activePlan.originalPrice}
                </span>
              )}
              <span
                style={{
                  display: "block",
                  color: "#666",
                  fontSize: "0.9rem",
                  marginTop: 4,
                }}
              >
                for {activePlan.duration} {activePlan.durationUnit}
              </span>
            </div>
          )}
          <button
            onClick={handleSubscribe}
            disabled={isMemberActive}
            style={{
              display: "inline-block",
              padding: "16px 48px",
              background: isMemberActive
                ? "linear-gradient(135deg, #10b981 0%, #059669 100%)"
                : "linear-gradient(135deg, #ff6b35 0%, #c1591c 100%)",
              color: "#fff",
              fontWeight: 800,
              fontSize: "1.15rem",
              borderRadius: 32,
              textDecoration: "none",
              border: "none",
              boxShadow: isMemberActive
                ? "0 6px 24px rgba(16, 185, 129, 0.3)"
                : "0 6px 24px rgba(255, 107, 53, 0.3)",
              cursor: isMemberActive ? "default" : "pointer",
              transition: "all 0.3s ease",
              opacity: isMemberActive ? 0.9 : 1,
            }}
            onMouseEnter={(e) => {
              if (!isMemberActive) {
                e.target.style.boxShadow =
                  "0 10px 32px rgba(255, 107, 53, 0.4)";
                e.target.style.transform = "translateY(-2px)";
              }
            }}
            onMouseLeave={(e) => {
              if (!isMemberActive) {
                e.target.style.boxShadow = "0 6px 24px rgba(255, 107, 53, 0.3)";
                e.target.style.transform = "translateY(0)";
              }
            }}
          >
            {isMemberActive
              ? "✓ Active Member"
              : isLoggedIn
                ? "Join Membership"
                : "Login to Join"}
          </button>
          <p style={{ color: "#999", fontSize: "0.9rem", marginTop: 12 }}>
            {isMemberActive
              ? "Enjoy your exclusive member benefits!"
              : isLoggedIn
                ? "Click above to proceed to checkout"
                : "Login required to activate membership"}
          </p>
        </div>
      </section>
    </main>
  );
}
