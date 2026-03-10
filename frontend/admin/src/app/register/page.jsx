"use client";
import { Button } from "@mui/material";
import Link from "next/link";

const Register = () => (
  <section className="relative min-h-screen w-full overflow-hidden">
    {/* Background */}
    <div
      className="absolute inset-0 bg-repeat bg-center"
      style={{ backgroundImage: "url('/pattern.png')" }}
    />

    {/* Soft overlay */}
    <div className="absolute inset-0 bg-white/85" />

    {/* Header */}
    <div className="fixed top-0 left-0 w-full py-4 z-50">
      <div className="w-[90%] mx-auto flex items-center justify-between">
        <img src="/logo.png" alt="logo" className="w-[150px]" />

        <div className="flex gap-3">
          <Link href={"/login"}>
            <Button className=" !px-5 !py-2 !rounded-full !border !text-gray-800">
              SIGN IN
            </Button>
          </Link>
        </div>
      </div>
    </div>

    <div className="relative z-20 flex flex-col items-center justify-center min-h-screen pt-32 px-4">
      <div className="w-full max-w-[520px] bg-white/70 backdrop-blur-sm p-10 rounded-3xl border border-white shadow-xl text-center">
        <h1 className="text-[32px] font-extrabold text-gray-900 mb-4">
          Admin Sign-Up Disabled
        </h1>
        <p className="text-gray-700 text-base mb-6">
          Admin accounts are managed by the primary administrator. Please sign
          in with your admin credentials.
        </p>
        <Link href={"/login"}>
          <Button className="!bg-gradient-to-r !from-blue-600 !to-indigo-600 !text-white !font-bold !py-3 !px-8 !rounded-xl !shadow-lg hover:!shadow-xl hover:!scale-[1.02] !transition-all !duration-300 !text-[16px] !normal-case">
            Go to Sign In
          </Button>
        </Link>
      </div>
    </div>
  </section>
);

export default Register;
