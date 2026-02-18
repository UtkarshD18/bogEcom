"use client";
import { useAdmin } from "@/context/AdminContext";
import { firebaseApp } from "@/firebase";
import { postData } from "@/utils/api";
import { Button } from "@mui/material";
import Checkbox from "@mui/material/Checkbox";
import {
  GoogleAuthProvider,
  getAuth,
  getRedirectResult,
  signInWithPopup,
  signInWithRedirect,
} from "firebase/auth";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { FcGoogle } from "react-icons/fc";
import { MdEmail, MdLock, MdVisibility, MdVisibilityOff } from "react-icons/md";

const label = { slotProps: { input: { "aria-label": "Checkbox demo" } } };
const GOOGLE_REDIRECT_ATTEMPT_KEY = "googleAuthRedirectAttemptedAdmin";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [auth, setAuth] = useState(null);
  const [provider, setProvider] = useState(null);

  const { login, loginWithGoogle, isAuthenticated, loading } = useAdmin();
  const router = useRouter();

  const completeAdminGoogleSignIn = async (result) => {
    const user = result?.user;
    if (!user?.email) {
      throw new Error("Google account email is missing");
    }

    const googleUserData = {
      name: user.displayName || "Google User",
      email: user.email,
      avatar: user.photoURL || "",
      mobile: "",
      role: "Admin",
      googleId: user.uid,
    };

    const backendResponse = await postData(
      "/api/user/authWithGoogle",
      googleUserData,
    );

    if (backendResponse?.error === true) {
      throw new Error(backendResponse?.message || "Google Sign-In failed");
    }

    if (backendResponse?.data?.role !== "Admin") {
      throw new Error("Access denied. Admin privileges required.");
    }

    localStorage.setItem("adminToken", backendResponse?.data?.accessToken);
    localStorage.setItem("adminUser", JSON.stringify(backendResponse?.data));
    router.push("/");
  };

  // Initialize Firebase auth
  useEffect(() => {
    if (firebaseApp) {
      try {
        const authInstance = getAuth(firebaseApp);
        const providerInstance = new GoogleAuthProvider();
        providerInstance.setCustomParameters({ prompt: "select_account" });
        setAuth(authInstance);
        setProvider(providerInstance);
        getRedirectResult(authInstance)
          .then(async (result) => {
            if (result?.user) {
              await completeAdminGoogleSignIn(result);
            }
          })
          .catch((error) => {
            console.error("Google redirect result error:", error);
            if (error?.code === "auth/unauthorized-domain") {
              const origin =
                typeof window !== "undefined"
                  ? window.location.origin
                  : "unknown-origin";
              setError(`Google sign-in blocked for ${origin}.`);
            } else if (error?.message) {
              setError(error.message);
            }
          })
          .finally(() => {
            if (typeof window !== "undefined") {
              sessionStorage.removeItem(GOOGLE_REDIRECT_ATTEMPT_KEY);
            }
          });
        console.log("✓ Firebase auth initialized in admin login");
      } catch (error) {
        console.error("Firebase auth initialization error:", error);
      }
    }
  }, []);

  useEffect(() => {
    if (!loading && isAuthenticated) {
      router.push("/");
    }
  }, [isAuthenticated, loading, router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    if (!email || !password) {
      setError("Please fill in all fields");
      setIsLoading(false);
      return;
    }

    const result = await login(email, password);

    if (result.error) {
      setError(result.message);
    } else {
      router.push("/");
    }

    setIsLoading(false);
  };

  const signInWithGoogle = async () => {
    if (!auth || !provider) {
      setError("Firebase is not initialized. Please check your configuration.");
      return;
    }

    setGoogleLoading(true);
    setError("");

    try {
      const result = await signInWithPopup(auth, provider);
      await completeAdminGoogleSignIn(result);
    } catch (error) {
      console.error("Google Sign-In Error:", error);
      if (error?.code === "auth/unauthorized-domain") {
        const canRetryWithRedirect =
          typeof window !== "undefined" &&
          sessionStorage.getItem(GOOGLE_REDIRECT_ATTEMPT_KEY) !== "1";

        if (canRetryWithRedirect) {
          sessionStorage.setItem(GOOGLE_REDIRECT_ATTEMPT_KEY, "1");
          setError("Retrying Google sign-in with redirect...");
          await signInWithRedirect(auth, provider);
          return;
        }
        const origin =
          typeof window !== "undefined"
            ? window.location.origin
            : "unknown-origin";
        setError(`Google sign-in blocked for ${origin}.`);
      } else if (error.code === "auth/popup-closed-by-user") {
        setError("Sign-in cancelled");
      } else {
        setError(error?.message || "Google Sign-In failed. Please try again.");
      }
    }

    setGoogleLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 to-orange-100">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-amber-600"></div>
      </div>
    );
  }

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
              <Button className="!bg-gray-100 !px-5 !py-2 !rounded-full !border !text-gray-800">
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
      <div className="relative z-20 flex flex-col items-center justify-center min-h-screen pt-32 px-4">
        {/* Heading */}
        <h1 className="text-center text-[40px] font-extrabold text-gray-900 mb-8">
          Admin Panel - Sign In
        </h1>

        {/* Error Message */}
        {error && (
          <div className="w-full max-w-[420px] mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* Google Sign In */}
        <Button
          onClick={signInWithGoogle}
          disabled={googleLoading}
          className="!bg-white !px-6 !py-3 !rounded-full !border !border-gray-300 !text-gray-900 !font-semibold !flex !items-center !gap-2 shadow-sm hover:!bg-gray-50 disabled:!opacity-50"
        >
          {googleLoading ? (
            <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-gray-600"></div>
          ) : (
            <FcGoogle size={20} />
          )}
          {googleLoading ? "Signing in..." : "Sign In With Google"}
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

        {/* Login Form */}
        <form
          onSubmit={handleSubmit}
          className="w-full max-w-[420px] mx-auto flex flex-col gap-5"
        >
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
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@buyonegram.com"
                className="w-full h-[45px] pl-10 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all duration-200"
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
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-0 -ml-[10px]">
              <Checkbox
                {...label}
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                size="small"
                sx={{ color: "#3b82f6", "&.Mui-checked": { color: "#2563eb" } }}
              />
              <span className="text-[14px] text-gray-600 select-none cursor-pointer">
                Remember me
              </span>
            </div>
            <Link
              href={"/forgot-password"}
              className="text-blue-600 font-semibold text-[14px] hover:text-blue-700 hover:underline transition-all"
            >
              Forgot Password?
            </Link>
          </div>

          <div className="flex items-center justify-between my-3">
            <span className="text-[15px] text-gray-800">
              Don&apos;t have an account?
            </span>
            <Link
              href={"/register"}
              className="text-blue-600 font-bold text-[15px] hover:text-gray-600"
            >
              Sign Up
            </Link>
          </div>

          <Button
            type="submit"
            disabled={isLoading}
            className="!bg-gradient-to-r !from-blue-600 !to-indigo-600 !text-white !font-bold !py-3 !rounded-xl !shadow-lg hover:!shadow-xl hover:!scale-[1.02] !transition-all !duration-300 !w-full !mt-2 !text-[16px] !normal-case disabled:!opacity-50"
          >
            {isLoading ? "SIGNING IN..." : "SIGN IN"}
          </Button>
        </form>
      </div>
    </section>
  );
};

export default Login;
