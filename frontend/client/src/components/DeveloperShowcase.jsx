"use client";

import { useState, useEffect } from "react";
import { FiCode, FiX, FiCheckCircle, FiDatabase, FiCpu, FiLayout, FiBookOpen } from "react-icons/fi";
import { io } from "socket.io-client";

export default function DeveloperShowcase() {
  const [isOpen, setIsOpen] = useState(false);
  const [socketStatus, setSocketStatus] = useState("connecting");
  const [eventCount, setEventCount] = useState(0);

  useEffect(() => {
    // Attempt to connect to the backend socket to show live developer metrics
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

    // Listen to real-time events to increment showcase counter
    socket.onAny(() => {
      setEventCount((prev) => prev + 1);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  return (
    <>
      {/* Floating Action Button */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 left-6 z-50 flex items-center gap-2 rounded-full bg-[#5A3A22] px-4 py-3 text-sm font-black text-[#FFF9F0] shadow-[0_12px_36px_rgba(90,58,34,0.3)] transition-all duration-300 hover:-translate-y-1 hover:bg-[#7A5A3A] hover:shadow-[0_16px_40px_rgba(90,58,34,0.4)] cursor-pointer"
        aria-label="Open Developer Showcase Panel"
      >
        <FiCode className="text-base animate-pulse" />
        <span className="hidden sm:inline">Engineering Showcase</span>
      </button>

      {/* Slide-over Drawer Backdrop */}
      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm transition-opacity duration-300"
        />
      )}

      {/* Slide-over Drawer Panel */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-full max-w-md bg-white/95 backdrop-blur-xl shadow-2xl transition-transform duration-500 ease-out border-r border-[#5A3A22]/10 flex flex-col ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Drawer Header */}
        <div className="p-6 border-b border-[#5A3A22]/10 flex items-center justify-between bg-[#F8F6F2]">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-[#5A3A22] flex items-center justify-center text-[#FFF9F0] shadow-md">
              <FiCode className="text-lg" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 leading-none">System Architecture</h2>
              <span className="text-[10px] uppercase font-bold tracking-wider text-[#FF8C42] mt-1 block">Recruiter Walkthrough</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="p-2 rounded-full hover:bg-gray-200/50 text-gray-500 hover:text-gray-900 transition-colors"
          >
            <FiX className="text-xl" />
          </button>
        </div>

        {/* Drawer Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Section: Overview */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">Platform Purpose</h3>
            <p className="text-sm text-gray-700 leading-relaxed">
              This storefront showcases a production-ready SaaS setup built with strict design systems, robust databases, and secure transactional pipelines.
            </p>
          </div>

          {/* Section: Technology Stack */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">Core SaaS Stack</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-start gap-2.5 p-3 rounded-xl border border-gray-100 bg-gray-50/50">
                <FiCpu className="text-[#FF8C42] mt-0.5 text-base shrink-0" />
                <div>
                  <h4 className="text-xs font-black text-gray-900">Next.js 16</h4>
                  <p className="text-[10px] text-gray-500">Turbopack, SSR</p>
                </div>
              </div>
              <div className="flex items-start gap-2.5 p-3 rounded-xl border border-gray-100 bg-gray-50/50">
                <FiDatabase className="text-[#1F7A63] mt-0.5 text-base shrink-0" />
                <div>
                  <h4 className="text-xs font-black text-gray-900">MongoDB</h4>
                  <p className="text-[10px] text-gray-500">Indexing, Schemas</p>
                </div>
              </div>
              <div className="flex items-start gap-2.5 p-3 rounded-xl border border-gray-100 bg-gray-50/50">
                <FiCpu className="text-[#3B82F6] mt-0.5 text-base shrink-0" />
                <div>
                  <h4 className="text-xs font-black text-gray-900">Node / Express</h4>
                  <p className="text-[10px] text-gray-500">Secure Web APIs</p>
                </div>
              </div>
              <div className="flex items-start gap-2.5 p-3 rounded-xl border border-gray-100 bg-gray-50/50">
                <FiLayout className="text-[#5A3A22] mt-0.5 text-base shrink-0" />
                <div>
                  <h4 className="text-xs font-black text-gray-900">Design System</h4>
                  <p className="text-[10px] text-gray-500">Tokens & Utilities</p>
                </div>
              </div>
            </div>
          </div>

          {/* Section: Live WebSocket Sync Status */}
          <div className="space-y-3 p-4 rounded-xl border border-[#1F7A63]/20 bg-[#1F7A63]/5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#1F7A63] flex items-center gap-1.5">
              <span className="relative flex h-2.5 w-2.5">
                {socketStatus === "connected" && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#1F7A63] opacity-75"></span>
                )}
                <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${socketStatus === "connected" ? "bg-[#1F7A63]" : "bg-red-500"}`}></span>
              </span>
              Real-time synchronization
            </h3>
            <div className="space-y-2 text-xs text-gray-700">
              <div className="flex justify-between">
                <span>Socket status:</span>
                <span className="font-bold capitalize">{socketStatus}</span>
              </div>
              <div className="flex justify-between">
                <span>Events tracked:</span>
                <span className="font-bold">{eventCount}</span>
              </div>
            </div>
          </div>

          {/* Section: Design Guidelines & Rules */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">Engineering Disciplines</h3>
            <ul className="space-y-2 text-xs text-gray-600">
              <li className="flex items-center gap-2">
                <FiCheckCircle className="text-[#1F7A63]" /> Component-first layout migration
              </li>
              <li className="flex items-center gap-2">
                <FiCheckCircle className="text-[#1F7A63]" /> Clean separation of UI styles via tokens
              </li>
              <li className="flex items-center gap-2">
                <FiCheckCircle className="text-[#1F7A63]" /> Strict keyboard accessibility compliance
              </li>
            </ul>
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
