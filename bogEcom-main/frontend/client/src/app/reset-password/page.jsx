"use client";
import { MyContext } from "@/context/ThemeProvider";
import { postData } from "@/utils/api";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import TextField from "@mui/material/TextField";
import cookies from "js-cookie";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useContext, useEffect, useState } from "react";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import { GoArrowLeft } from "react-icons/go";

const ResetPassword = () => {
  const [isShowPassword, setIsShowPassword] = useState(false);
  const [isShowConfirmPassword, setIsShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formFields, setFormFields] = useState({
    password: "",
    confirmPassword: "",
  });
  const context = useContext(MyContext);
  const router = useRouter();

  useEffect(() => {
    const email = cookies.get("userEmail");
    if (!email) {
      context?.alertBox("error", "Email not found. Please try again.");
      router.push("/forgot-password");
      return;
    }
  }, []);

  const onChangeInput = (e) => {
    const { name, value } = e.target;
    setFormFields(() => {
      return { ...formFields, [name]: value };
    });
  };

  const validateValue = Object.values(formFields).every((el) => el);

  const handleSubmit = (e) => {
    e.preventDefault();
    setIsLoading(true);

    if (!formFields.password || !formFields.confirmPassword) {
      context?.alertBox("error", "Please fill all fields");
      setIsLoading(false);
      return false;
    }
    if (formFields.password.length < 6) {
      context?.alertBox("error", "Password must be at least 6 characters");
      setIsLoading(false);
      return false;
    }
    if (formFields.password !== formFields.confirmPassword) {
      context?.alertBox("error", "Passwords do not match");
      setIsLoading(false);
      return false;
    }

    const email = cookies.get("userEmail");
    if (!email) {
      context?.alertBox("error", "Email not found. Please try again.");
      setIsLoading(false);
      return false;
    }

    postData("/api/user/forgot-Password/change-Password", {
      email,
      newPassword: formFields.password,
      confirmPassword: formFields.confirmPassword,
    })
      .then((res) => {
        if (res?.error !== true) {
          setIsLoading(false);
          context?.alertBox("success", res?.message);
          cookies.remove("userEmail");
          cookies.remove("actionType");
          setFormFields({
            password: "",
            confirmPassword: "",
          });
          router.push("/login");
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
            alt="reset-password"
            className="w-28 h-28 object-contain mb-4"
          />
          <h1 className="text-center text-2xl font-bold text-gray-800 mb-2">
            Reset Password
          </h1>
          <p className="text-center text-gray-500 text-sm mb-6">
            Enter your new password below
          </p>

          <div className="w-full mb-4 relative">
            <TextField
              id="passwordField"
              label="New Password"
              variant="outlined"
              className="w-full"
              type={isShowPassword ? "text" : "password"}
              name="password"
              onChange={onChangeInput}
              disabled={isLoading}
              value={formFields.password}
            />
            <IconButton
              aria-label="password"
              size="large"
              onClick={() => setIsShowPassword(!isShowPassword)}
              className="absolute! top-1.25 right-1.25 z-50"
            >
              {isShowPassword ? <FaEyeSlash size={20} /> : <FaEye size={20} />}
            </IconButton>
          </div>

          <div className="w-full mb-4 relative">
            <TextField
              id="confirmPasswordField"
              label="Confirm Password"
              variant="outlined"
              className="w-full"
              type={isShowConfirmPassword ? "text" : "password"}
              name="confirmPassword"
              onChange={onChangeInput}
              disabled={isLoading}
              value={formFields.confirmPassword}
            />
            <IconButton
              aria-label="confirm-password"
              size="large"
              onClick={() => setIsShowConfirmPassword(!isShowConfirmPassword)}
              className="absolute! top-1.25 right-1.25 z-50"
            >
              {isShowConfirmPassword ? (
                <FaEyeSlash size={20} />
              ) : (
                <FaEye size={20} />
              )}
            </IconButton>
          </div>

          <div className="w-full mt-4">
            <Button
              type="submit"
              className="w-full btn-g py-3! text-base! rounded-xl! font-semibold!"
              disabled={
                isLoading || !formFields.password || !formFields.confirmPassword
              }
            >
              {isLoading ? <CircularProgress size={24} /> : "Reset Password"}
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
export default ResetPassword;
