"use client";
import { MyContext } from "@/context/ThemeProvider";
import { postData } from "@/utils/api";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import TextField from "@mui/material/TextField";
import cookies from "js-cookie";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useContext, useState } from "react";
import { GoArrowLeft } from "react-icons/go";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const context = useContext(MyContext);
  const router = useRouter();

  const handleSubmit = (e) => {
    e.preventDefault();
    setIsLoading(true);

    if (email === "") {
      context?.alertBox("error", "Email is required");
      setIsLoading(false);
      return false;
    }

    postData("/api/user/forgot-Password", { email })
      .then((res) => {
        if (res?.error !== true) {
          setIsLoading(false);
          context?.alertBox("success", res?.message);
          cookies.set("userEmail", email);
          cookies.set("actionType", "forgotPassword");
          setEmail("");
          router.push("/verify");
        } else {
          context?.alertBox("error", res?.message);
          setIsLoading(false);
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
            alt="forgot-password"
            className="w-28 h-28 object-contain mb-4"
          />
          <h1 className="text-center text-2xl font-bold text-gray-800 mb-2">
            Forgot Password?
          </h1>
          <p className="text-center text-gray-500 text-sm mb-6">
            Enter your email and we'll send you a reset link
          </p>

          <div className="w-full mb-4">
            <TextField
              id="emailField"
              label="Email"
              variant="outlined"
              className="w-full"
              type="email"
              name="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
            />
          </div>

          <div className="w-full mt-2">
            <Button
              type="submit"
              className="w-full btn-g py-3! text-base! rounded-xl! font-semibold!"
              disabled={!email || isLoading}
            >
              {isLoading ? <CircularProgress size={24} /> : "Submit"}
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
export default ForgotPassword;
