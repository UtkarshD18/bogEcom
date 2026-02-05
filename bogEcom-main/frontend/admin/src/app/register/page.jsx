"use client";
import { Button } from "@mui/material";
import Link from "next/link";
import { useState } from "react";
import { FcGoogle } from "react-icons/fc";
import {
  MdEmail,
  MdLock,
  MdPerson,
  MdVisibility,
  MdVisibilityOff,
} from "react-icons/md";
const label = { slotProps: { input: { "aria-label": "Checkbox demo" } } };
const Register = () => {
  const [showPassword, setShowPassword] = useState(false);

  return (
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
            <Link href={"/register"}>
              <Button className="!bg-gray-200 !px-5 !py-2 !rounded-full !border !text-gray-800">
                SIGN UP
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="relative z-20 flex flex-col items-center justify-center min-h-screen pt-32 px-4">
        {/* Heading */}
        <h1 className="text-center text-[40px] font-extrabold text-gray-900 mb-8 w-[50%]">
          Join us today! Get special benefits and stay up-to-date
        </h1>

        {/* Google Sign In */}
        <Button className="!bg-white !px-6 !py-3 !rounded-full !border !border-gray-300 !text-gray-900 !font-semibold !flex !items-center !gap-2 shadow-sm">
          <FcGoogle size={20} />
          Sign In With Google
        </Button>

        {/* Divider */}
        <div className="flex items-center gap-3 mt-8 mb-4">
          <span className="w-[120px] h-[1px] bg-gray-300"></span>
          <span className="text-sm text-gray-600">
            Or, sign in with your email
          </span>
          <span className="w-[120px] h-[1px] bg-gray-300"></span>
        </div>
        <br />
        {/* Email Input */}
        <form className="w-full max-w-[420px] mx-auto flex flex-col gap-5">
          <div className="w-full">
            <span className="text-[15px] font-medium text-gray-700 mb-2 block">
              Full Name
            </span>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <MdPerson className="text-gray-400 text-lg" />
              </div>
              <input
                type="text"
                placeholder="Enter your name"
                className="w-full h-[45px] pl-10 border border-gray-300 rounded-lg text-sm bg-gray-50 outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all duration-200"
              />
            </div>
          </div>

          <div className="w-full">
            <span className="text-[15px] font-medium text-gray-700 mb-2 block">
              Email
            </span>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <MdEmail className="text-gray-400 text-lg" />
              </div>
              <input
                type="email"
                placeholder="Enter your email"
                className="w-full h-[45px] pl-10 border border-gray-300 rounded-lg text-sm bg-gray-50 outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all duration-200"
              />
            </div>
          </div>

          <div className="w-full">
            <span className="text-[15px] font-medium text-gray-700 mb-2 block">
              Password
            </span>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <MdLock className="text-gray-400 text-lg" />
              </div>
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                className="w-full h-[45px] pl-10 pr-10 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all duration-200"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
              >
                {showPassword ? (
                  <MdVisibilityOff className="text-lg" />
                ) : (
                  <MdVisibility className="text-lg" />
                )}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between my-3">
            <span className="text-[15px] text-gray-800">
              Already have an account?
            </span>
            <Link
              href={"/login"}
              className="text-blue-600 font-bold text-[15px] hover:text-gray-600"
            >
              Sign In
            </Link>
          </div>
          <Button className="!bg-gradient-to-r !from-blue-600 !to-indigo-600 !text-white !font-bold !py-3 !rounded-xl !shadow-lg hover:!shadow-xl hover:!scale-[1.02] !transition-all !duration-300 !w-full !mt-2 !text-[16px] !normal-case">
            {" "}
            SIGN UP
          </Button>
        </form>
      </div>
    </section>
  );
};

export default Register;
