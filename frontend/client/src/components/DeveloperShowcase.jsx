"use client";

import { useState, useEffect } from "react";
import { FiCode, FiX, FiCheckCircle, FiDatabase, FiCpu, FiLayout, FiBookOpen, FiArrowRight, FiShield, FiSliders } from "react-icons/fi";
import { io } from "socket.io-client";

export default function DeveloperShowcase({ isOpen, onClose }) {
  const [socketStatus, setSocketStatus] = useState("connecting");
  const [eventCount, setEventCount] = useState(0);

  useEffect(() => {
    if (!isOpen) return undefined;

    const socketUrl = process.env.NEXT_PUBLIC_APP_API_URL || "https://healthyonegram-api-v2-xb7znoco6a-uc.a.run.app";
    const socket = io(socketUrl, {
      transports: ["websocket", "polling"],
      autoConnect: true,
    });

    socket.on("connect", () => {
      setSocketStatus("connected");
    });

    socket.on("disconnect", () => {
      setSocketStatus("disconnected");
    });

    socket.on("connect_error", () => {
      setSocketStatus("error");
    });

    socket.onAny(() => {
      setEventCount((prev) => prev + 1);
    });

    return () => {
      socket.disconnect();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <>
      {/* Slide-over Drawer Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm transition-opacity duration-300"
      />

      {/* Slide-over Drawer Panel */}
      <div
        className="fixed inset-y-0 left-0 z-50 w-full max-w-md bg-white/95 backdrop-blur-xl shadow-2xl transition-transform duration-500 ease-out border-r border-[#5A3A22]/10 flex flex-col translate-x-0"
      >
        {/* Drawer Header */}
        <div className="p-6 border-b border-[#5A3A22]/10 flex items-center justify-between bg-[#F8F6F2]">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-[#5A3A22] flex items-center justify-center text-[#FFF9F0] shadow-md">
              <FiCode className="text-lg" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 leading-none">Engineering Case Study</h2>
              <span className="text-[10px] uppercase font-bold tracking-wider text-[#FF8C42] mt-1 block">Architecture & Design</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-200/50 text-gray-500 hover:text-gray-900 transition-colors"
          >
            <FiX className="text-xl" />
          </button>
        </div>

        {/* Drawer Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Section: What this project demonstrates */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#5A3A22]">What This Project Demonstrates</h3>
            <div className="p-4 rounded-xl border border-[#5A3A22]/10 bg-[#FFF9F0]/50 space-y-2">
              <ul className="space-y-2 text-xs text-gray-700">
                <li className="flex items-start gap-2">
                  <FiCheckCircle className="text-[#1F7A63] mt-0.5 shrink-0" />
                  <span><strong>Design System Alignment:</strong> Enforced tokens for colors, typography, margins, and custom utility classes.</span>
                </li>
                <li className="flex items-start gap-2">
                  <FiCheckCircle className="text-[#1F7A63] mt-0.5 shrink-0" />
                  <span><strong>Material UI Integration:</strong> Seamless global overrides without breaking built-in framework layers.</span>
                </li>
                <li className="flex items-start gap-2">
                  <FiCheckCircle className="text-[#1F7A63] mt-0.5 shrink-0" />
                  <span><strong>Robust Security:</strong> HMAC-SHA256 signature verification, server-only API credentials, and JWT authorization.</span>
                </li>
                <li className="flex items-start gap-2">
                  <FiCheckCircle className="text-[#1F7A63] mt-0.5 shrink-0" />
                  <span><strong>Build stability:</strong> Compilation safety on static caching, routes, and Turbopack builds.</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Section: System Architecture Visual */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">System Architecture Flow</h3>
            <div className="p-4 rounded-xl border border-gray-100 bg-gray-50 flex flex-col items-center gap-3">
              {/* Architecture Diagram blocks */}
              <div className="w-full flex items-center justify-between gap-1 text-[11px] font-bold">
                <div className="px-2.5 py-1.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-800 text-center shrink-0">
                  Client <br/> (Next.js)
                </div>
                <div className="flex flex-col items-center">
                  <FiArrowRight className="text-gray-400 text-sm" />
                  <span className="text-[9px] text-gray-400 font-normal">HTTP/WS</span>
                </div>
                <div className="px-2.5 py-1.5 rounded-lg bg-green-50 border border-green-200 text-green-800 text-center shrink-0">
                  Server <br/> (Express)
                </div>
                <div className="flex flex-col items-center">
                  <FiArrowRight className="text-gray-400 text-sm" />
                  <span className="text-[9px] text-gray-400 font-normal">Mongoose</span>
                </div>
                <div className="px-2.5 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-center shrink-0">
                  Database <br/> (MongoDB)
                </div>
              </div>
            </div>
          </div>

          {/* Section: Tech Stack Choices */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">Tech Stack & Rationale</h3>
            <div className="space-y-3 text-xs text-gray-700 leading-relaxed">
              <div className="flex gap-2.5">
                <FiCpu className="text-[#3B82F6] text-lg shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-gray-900">Next.js 16 Storefront</h4>
                  <p className="text-gray-600 mt-0.5">Leverages server components, static pre-rendering, and Turbopack pipelines to achieve fast Largest Contentful Paint (LCP) and zero Cumulative Layout Shift (CLS).</p>
                </div>
              </div>
              <div className="flex gap-2.5">
                <FiDatabase className="text-[#1F7A63] text-lg shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-gray-900">MongoDB Database</h4>
                  <p className="text-gray-600 mt-0.5">Optimized collections with targeted index mappings for rapid catalog retrieval, and transactional enums ensuring data integrity.</p>
                </div>
              </div>
              <div className="flex gap-2.5">
                <FiShield className="text-[#FF8C42] text-lg shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-gray-900">Secured Back-office</h4>
                  <p className="text-gray-600 mt-0.5">Integrated Razorpay with server-only verification webhooks and state controls, completely preventing client-side data tampering.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Section: WebSocket Status */}
          <div className="space-y-3 p-4 rounded-xl border border-[#1F7A63]/20 bg-[#1F7A63]/5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#1F7A63] flex items-center gap-1.5">
              <span className="relative flex h-2.5 w-2.5">
                {socketStatus === "connected" && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#1F7A63] opacity-75"></span>
                )}
                <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${socketStatus === "connected" ? "bg-[#1F7A63]" : "bg-red-500"}`}></span>
              </span>
              Live Sync Syncing
            </h3>
            <div className="space-y-2 text-xs text-gray-700">
              <div className="flex justify-between">
                <span>Socket connection:</span>
                <span className="font-bold capitalize">{socketStatus}</span>
              </div>
              <div className="flex justify-between">
                <span>Events tracked:</span>
                <span className="font-bold">{eventCount}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Drawer Footer */}
        <div className="p-6 border-t border-[#5A3A22]/10 bg-[#F8F6F2]">
          <div className="flex gap-3">
            <a
              href="/DESIGN_SYSTEM.md"
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-2 rounded-full border border-[#5A3A22]/30 bg-white py-2.5 text-xs font-black text-[#5A3A22] transition hover:bg-gray-100 cursor-pointer"
            >
              <FiBookOpen />
              Design Guide
            </a>
          </div>
        </div>
      </div>
    </>
  );
}
