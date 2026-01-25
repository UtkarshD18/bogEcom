"use client";
import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import { usePathname } from "next/navigation";

const publicPages = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/verify",
];

export default function AdminLayout({ children }) {
  const pathname = usePathname();
  const isPublicPage = publicPages.some((p) => pathname.startsWith(p));

  if (isPublicPage) {
    return <>{children}</>;
  }

  return (
    <div className="flex">
      <Sidebar />
      <div className="flex-1 min-h-screen ml-[250px] bg-gray-50">
        <Header />
        {children}
      </div>
    </div>
  );
}
