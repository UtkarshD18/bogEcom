"use client";
import OtpBox from "@/components/OtpBox";
import { MyContext } from "@/context/ThemeProvider";
import { postData } from "@/utils/api";
import { Button } from "@mui/material";
import CircularProgress from "@mui/material/CircularProgress";
import cookies from "js-cookie";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useContext, useEffect, useState } from "react";
import { GoArrowLeft } from "react-icons/go";
const Verify = () => {
  const [otp, setOtp] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const context = useContext(MyContext);

  const [timeLeft, setTimeLeft] = useState(120);
  const [expired, setExpired] = useState(false);

  const router = useRouter();

  useEffect(() => {
    const email = cookies.get("userEmail");
    if (!email) {
      context?.alertBox("error", "Email not found. Please register again.");
      router.push("/register");
      return;
    }
    setUserEmail(email);
  }, []);

  const handleChangeOTP = (value) => {
    setOtp(value);
  };

  useEffect(() => {
    if (timeLeft === 0) {
      setExpired(true);
      return;
    }
    const timer = setTimeout(() => {
      setTimeLeft(timeLeft - 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [timeLeft]);

  const handleSubmit = (e) => {
    e.preventDefault();
    setIsLoading(true);

    const actionType = cookies.get("actionType");
    if (actionType === "verifyEmail") {
      postData("/api/user/verifyEmail", { email: userEmail, otp: otp })
        .then((res) => {
          if (res?.error === false) {
            setIsLoading(false);
            context?.alertBox("success", res?.message);
            cookies.remove("userEmail");
            cookies.remove("actionType");
            router.push("/login");
          } else {
            setIsLoading(false);
            context?.alertBox("error", res?.message);
          }
        })
        .catch((error) => {
          context?.alertBox("error", "Network error. Please try again.");
          setIsLoading(false);
        });
    } else if (actionType === "forgotPassword") {
      postData("/api/user/verify-Forgot-Password-OTP", {
        email: userEmail,
        otp: otp,
      })
        .then((res) => {
          if (res?.error === false) {
            setIsLoading(false);
            context?.alertBox("success", res?.message);
            router.push("/reset-password");
          } else {
            setIsLoading(false);
            context?.alertBox("error", res?.message);
          }
        })
        .catch((error) => {
          context?.alertBox("error", "Network error. Please try again.");
          setIsLoading(false);
        });
    }
  };

  const resendOTP = () => {
    setIsLoading(true);
    postData("/api/user/resend-otp", { email: userEmail })
      .then((res) => {
        if (res?.error === false) {
          setIsLoading(false);
          context?.alertBox("success", res?.message);
          setTimeLeft(120);
          setExpired(false);
          setOtp("");
        } else {
          setIsLoading(false);
          context?.alertBox("error", res?.message);
        }
      })
      .catch((error) => {
        context?.alertBox("error", "Network error. Please try again.");
        setIsLoading(false);
      });
  };

  return (
    <section className="min-h-screen w-full bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center relative overflow-hidden py-10">
      <div className="container flex justify-center">
        <form
          onSubmit={handleSubmit}
          className="bg-white p-10 rounded-2xl shadow-xl w-full max-w-[480px] border border-gray-100 flex flex-col items-center"
        >
          <img
            src="/forgot-password.png"
            alt="image"
            className="w-28 h-28 object-contain mb-4"
          />
          <h1 className="text-center text-2xl font-bold text-gray-800 mb-2">
            Verify OTP
          </h1>
          <p className="text-center text-gray-600 text-sm mb-2">OTP sent to:</p>
          <p className="text-center text-lg font-semibold text-primary mb-6">
            {userEmail || "Loading..."}
          </p>

          <div className="flex items-center justify-center my-4 w-full">
            <OtpBox length={6} onChange={handleChangeOTP} />
          </div>

          <div className="flex justify-center w-full my-4">
            {expired ? (
              <span
                className="text-sm font-semibold text-primary cursor-pointer hover:underline"
                onClick={resendOTP}
              >
                Resend OTP
              </span>
            ) : (
              <span className="text-sm text-gray-500">
                Resend OTP in{" "}
                <span className="font-bold text-gray-700">{timeLeft}</span>{" "}
                seconds
              </span>
            )}
          </div>

          <div className="w-full mt-4">
            <Button
              type="submit"
              className="w-full btn-g !py-3 !text-[15px] !rounded-xl !font-semibold"
            >
              {isLoading === true ? <CircularProgress size={24} /> : "Verify"}
            </Button>
          </div>

          <div className="text-center mt-6">
            <Link
              href={"/login"}
              className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-primary font-medium transition-colors"
            >
              <GoArrowLeft size={18} /> Back to login
            </Link>
          </div>
        </form>
      </div>
      <div className="circle1 bg-primary opacity-10 w-[400px] h-[400px] rounded-full absolute -bottom-[150px] -left-[100px] blur-3xl"></div>
      <div className="circle2 bg-primary opacity-10 w-[400px] h-[400px] rounded-full absolute -top-[150px] -right-[100px] blur-3xl"></div>
    </section>
  );
};
export default Verify;
