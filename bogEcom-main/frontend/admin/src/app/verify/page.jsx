"use client";
import OtpBox from "@/components/OtpBox";
import { postData } from "@/utils/api";
import { Button, CircularProgress } from "@mui/material";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { GoArrowLeft } from "react-icons/go";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

// Inner component using useSearchParams
const VerifyContent = () => {
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const searchParams = useSearchParams();
  const router = useRouter();
  const email = searchParams.get("email");

  useEffect(() => {
    if (!email) {
      // Optional: Redirect back if no email
      // router.push('/forgot-password');
    }
  }, [email, router]);

  const handleChangeOTP = (value) => {
    setOtp(value);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (otp.length !== 6) {
      toast.error("Please enter a valid 6-digit OTP");
      return;
    }

    setLoading(true);
    try {
      const res = await postData("verify-Forgot-Password-OTP", {
        email: email,
        otp: otp,
        newPassword: "temp", // Backend requires this field but doesn't seem to use it for verification step
      });

      if (res.success !== false && !res.error) {
        toast.success(res.message);
        setTimeout(() => {
          router.push(`/reset-password?email=${email}`);
        }, 1500);
      } else {
        toast.error(res.message || "Verification failed");
      }
    } catch (error) {
      toast.error("An error occurred. Please try again.");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="relative min-h-screen w-full overflow-hidden">
      <ToastContainer position="top-center" />
      {/* Background */}
      <div
        className="absolute inset-0 bg-repeat bg-center"
        style={{ backgroundImage: "url('/pattern.png')" }}
      />

      {/* Soft overlay */}
      <div className="absolute inset-0 bg-white/85" />

      <div className="relative z-20 flex flex-col items-center justify-center min-h-screen pt-20 px-4">
        <div className="w-full max-w-[450px] bg-white/50 backdrop-blur-sm p-8 rounded-2xl border border-white shadow-xl">
          <h1 className="text-center text-[28px] font-extrabold text-gray-900 mb-2">
            Verify OTP
          </h1>
          <p className="text-center text-gray-600 mb-6 text-[15px]">
            Enter the 6-digit code sent to <br />
            <span className="text-blue-600 font-semibold">
              {email || "your email"}
            </span>
          </p>

          <div className="flex items-center justify-center my-8">
            <OtpBox length={6} onChange={handleChangeOTP} />
          </div>

          <div className="my-4 w-full relative">
            <Button
              onClick={handleSubmit}
              disabled={loading}
              className="!bg-gradient-to-r !from-blue-600 !to-indigo-600 !text-white !font-bold !py-3 !rounded-xl !shadow-lg hover:!shadow-xl hover:!scale-[1.02] !transition-all !duration-300 !w-full !text-[16px] !normal-case"
            >
              {loading ? "Verifying..." : "Verify OTP"}
            </Button>
          </div>

          <div className="text-center flex justify-center mt-4">
            <Link
              href={"/login"}
              className="text-[14px] text-gray-600 hover:text-blue-600 font-semibold flex items-center gap-2 transition-colors"
            >
              <GoArrowLeft size={18} /> Back to Sign In
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
};

// Loading fallback
const VerifyLoading = () => (
  <section className="min-h-screen flex items-center justify-center">
    <CircularProgress />
  </section>
);

// Export with Suspense wrapper
const Verify = () => (
  <Suspense fallback={<VerifyLoading />}>
    <VerifyContent />
  </Suspense>
);

export default Verify;
