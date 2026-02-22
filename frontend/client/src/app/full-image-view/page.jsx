"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";

function LegacyFullImageRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    const query = params.toString();
    router.replace(`/product-image-zoom${query ? `?${query}` : ""}`);
  }, [router, searchParams]);

  return (
    <section className="min-h-screen bg-black text-white flex items-center justify-center">
      <p className="text-sm text-white/80">Redirecting to image zoom...</p>
    </section>
  );
}

export default function FullImageViewPage() {
  return (
    <Suspense
      fallback={
        <section className="min-h-screen bg-black text-white flex items-center justify-center">
          <p className="text-sm text-white/80">Redirecting to image zoom...</p>
        </section>
      }
    >
      <LegacyFullImageRedirect />
    </Suspense>
  );
}
