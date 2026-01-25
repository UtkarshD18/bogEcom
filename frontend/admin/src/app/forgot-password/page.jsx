"use client";
import { postData } from "@/utils/api";
import { Button } from "@mui/material";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { IoArrowBack } from "react-icons/io5";
import { MdEmail } from "react-icons/md";
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const ForgotPassword = () => {
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleSendResetLink = async (e) => {
        e.preventDefault();
        if (!email) {
            toast.error("Please enter your email");
            return;
        }

        setLoading(true);
        try {
            const res = await postData("forgot-Password", { email });
            
            if (res.success !== false && !res.error) {
                toast.success(res.message);
                setTimeout(() => {
                    router.push(`/verify?email=${email}`);
                }, 1500);
            } else {
                toast.error(res.message || "Something went wrong");
            }
        } catch (error) {
            console.error(error);
            toast.error("An error occurred");
        } finally {
            setLoading(false);
        }
    }

  return (
    <section className="relative min-h-screen w-full overflow-hidden">
      <ToastContainer position="top-center"/>
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
            <Button className="!px-5 !py-2 !rounded-full !border !text-gray-800">
              SIGN UP
            </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="relative z-20 flex flex-col items-center justify-center min-h-screen pt-20 px-4">
        <div className="w-full max-w-[450px] bg-white/50 backdrop-blur-sm p-8 rounded-2xl border border-white shadow-xl">
            {/* Heading */}
            <div className="text-center mb-8">
                <h1 className="text-[32px] font-extrabold text-gray-900 mb-2">
                Forgot Password?
                </h1>
                <p className="text-gray-600">
                    Enter your email address and we'll send you a link to reset your password.
                </p>
            </div>

            {/* Email Input */}
            <form className="flex flex-col gap-6" onSubmit={handleSendResetLink}>
            <div className="w-full">
                <span className="text-[15px] font-medium text-gray-700 mb-2 block">Email Address</span>
                <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <MdEmail className="text-gray-400 text-lg" />
                </div>
                <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your registered email"
                    className="w-full h-[45px] pl-10 border border-gray-300 rounded-lg text-sm bg-gray-50/50 outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all duration-200"
                />
                </div>
            </div>

            <Button 
                type="submit"
                disabled={loading}
                className="!bg-gradient-to-r !from-blue-600 !to-indigo-600 !text-white !font-bold !py-3 !rounded-xl !shadow-lg hover:!shadow-xl hover:!scale-[1.02] !transition-all !duration-300 !w-full !text-[16px] !normal-case">
                {loading ? "Sending..." : "Send Reset Link"}
            </Button>

            <div className="text-center mt-2">
                <Link 
                    href="/login" 
                    className="inline-flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-blue-600 transition-colors"
                >
                    <IoArrowBack size={16} />
                    Back to Sign In
                </Link>
            </div>
            </form>
        </div>
      </div>
    </section>
  );
};

export default ForgotPassword;
