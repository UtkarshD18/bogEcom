"use client";
import { postData } from "@/utils/api";
import { Button, CircularProgress } from "@mui/material";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { MdLock } from "react-icons/md";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

// Inner component using useSearchParams
const ResetPasswordContent = () => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email");

  useEffect(() => {
    if (!email) {
      router.push("/login");
    }
  }, [email, router]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!password || !confirmPassword) {
      toast.error("Please fill all fields");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    try {
      const res = await postData("forgot-Password/change-Password", {
        email: email,
        newPassword: password,
        confirmPassword: confirmPassword,
      });

      if (res.success !== false && !res.error) {
        toast.success(res.message);
        setTimeout(() => {
          router.push("/login");
        }, 1500);
      } else {
        toast.error(res.message || "Failed to reset password");
      }
    } catch (error) {
      console.error(error);
      toast.error("An error occurred");
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

      {/* Main Content */}
      <div className="relative z-20 flex flex-col items-center justify-center min-h-screen pt-20 px-4">
        <div className="w-full max-w-[450px] bg-white/50 backdrop-blur-sm p-8 rounded-2xl border border-white shadow-xl">
          {/* Heading */}
          <div className="text-center mb-8">
            <h1 className="text-[32px] font-extrabold text-gray-900 mb-2">
              Reset Password
            </h1>
            <p className="text-gray-600">
              Create a new strong password for your account.
            </p>
          </div>

          {/* Password Input */}
          <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
            <div className="w-full">
              <span className="text-[15px] font-medium text-gray-700 mb-2 block">
                New Password
              </span>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <MdLock className="text-gray-400 text-lg" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter new password"
                  className="w-full h-[45px] pl-10 border border-gray-300 rounded-lg text-sm bg-gray-50/50 outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all duration-200"
                />
              </div>
            </div>

            <div className="w-full">
              <span className="text-[15px] font-medium text-gray-700 mb-2 block">
                Confirm Password
              </span>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <MdLock className="text-gray-400 text-lg" />
                </div>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  className="w-full h-[45px] pl-10 border border-gray-300 rounded-lg text-sm bg-gray-50/50 outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all duration-200"
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="!bg-gradient-to-r !from-blue-600 !to-indigo-600 !text-white !font-bold !py-3 !rounded-xl !shadow-lg hover:!shadow-xl hover:!scale-[1.02] !transition-all !duration-300 !w-full !text-[16px] !normal-case"
            >
              {loading ? "Resetting..." : "Reset Password"}
            </Button>
          </form>
        </div>
      </div>
    </section>
  );
};

// Loading fallback
const ResetPasswordLoading = () => (
  <section className="min-h-screen flex items-center justify-center">
    <CircularProgress />
  </section>
);

// Export with Suspense wrapper
const ResetPassword = () => (
  <Suspense fallback={<ResetPasswordLoading />}>
    <ResetPasswordContent />
  </Suspense>
);

export default ResetPassword;
