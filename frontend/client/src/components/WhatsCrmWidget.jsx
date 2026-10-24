"use client";

import { useEffect } from "react";

export default function WhatsCrmWidget() {
  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return;

    if (document.querySelector(".b1g-widget-btn")) return;

    const widgetUrl =
      "https://omnicrms-api.onrender.com/api/website/widget/script?uid=local-user-uid&domain=bog-ecom-client.vercel.app";

    const existing = document.querySelector(`script[src*="omnicrms-api"]`);
    if (existing) {
      existing.remove();
    }

    const script = document.createElement("script");
    script.src = widgetUrl;
    script.async = true;
    document.body.appendChild(script);
  }, []);

  return null;
}
