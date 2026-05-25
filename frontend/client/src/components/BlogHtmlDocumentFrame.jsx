"use client";

import sanitizeBlogHtmlDocument from "@/utils/blogHtml";
import { useEffect, useRef, useState } from "react";

const BlogHtmlDocumentFrame = ({ html, title, immersive = false }) => {
  const iframeRef = useRef(null);
  const [frameHeight, setFrameHeight] = useState(720);
  const [viewportHeight, setViewportHeight] = useState(900);
  const sanitizedDocument = sanitizeBlogHtmlDocument(html);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const syncViewportHeight = () => {
      setViewportHeight(window.innerHeight || 900);
    };

    syncViewportHeight();
    window.addEventListener("resize", syncViewportHeight);
    return () => window.removeEventListener("resize", syncViewportHeight);
  }, []);

  useEffect(() => {
    if (immersive) return undefined;

    const iframe = iframeRef.current;
    if (!iframe) return undefined;

    let resizeObserver = null;

    const syncHeight = () => {
      const iframeDocument = iframe.contentDocument;
      if (!iframeDocument) return;

      const nextHeight = Math.max(
        iframeDocument.documentElement?.scrollHeight || 0,
        iframeDocument.body?.scrollHeight || 0,
        720,
      );
      setFrameHeight(nextHeight);
    };

    const handleLoad = () => {
      syncHeight();

      if (typeof ResizeObserver !== "undefined" && iframe.contentDocument?.body) {
        resizeObserver = new ResizeObserver(() => {
          syncHeight();
        });
        resizeObserver.observe(iframe.contentDocument.body);
      }
    };

    iframe.addEventListener("load", handleLoad);
    return () => {
      iframe.removeEventListener("load", handleLoad);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  }, [immersive, sanitizedDocument]);

  const resolvedFrameHeight = immersive
    ? Math.max(Math.round(viewportHeight * 0.78), 520)
    : frameHeight;

  return (
    <div
      className={`overflow-hidden border shadow-[0_16px_45px_rgba(15,23,42,0.08)] ${
        immersive
          ? "rounded-[28px] border-slate-300 bg-slate-950"
          : "rounded-[24px] border-slate-200 bg-white"
      }`}
    >
      <iframe
        ref={iframeRef}
        title={title ? `${title} imported HTML article` : "Imported blog article"}
        srcDoc={sanitizedDocument}
        sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin"
        className="w-full bg-white"
        style={{ height: `${resolvedFrameHeight}px` }}
      />
    </div>
  );
};

export default BlogHtmlDocumentFrame;
