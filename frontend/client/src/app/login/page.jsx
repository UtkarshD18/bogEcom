"use client";
import { MyContext } from "@/context/ThemeProvider";
import { firebaseApp } from "@/firebase";
import { postData } from "@/utils/api";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import TextField from "@mui/material/TextField";
import { GoogleAuthProvider, getAuth, signInWithPopup } from "firebase/auth";
import cookies from "js-cookie";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useContext, useEffect, useState } from "react";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import { FcGoogle } from "react-icons/fc";

// Inner component that uses useSearchParams - must be wrapped in Suspense
const LoginForm = () => {
  const [auth, setAuth] = useState(null);
  const [provider, setProvider] = useState(null);
  const [isShowPassword, setIsShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [formFields, setFormFields] = useState({
    email: "",
    password: "",
  });
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get("redirect") || "/";

  // Initialize Firebase auth
  useEffect(() => {
    if (firebaseApp) {
      try {
        setAuth(getAuth(firebaseApp));
        setProvider(new GoogleAuthProvider());
        console.log("✓ Firebase auth initialized in login page");
      } catch (error) {
        console.error("Firebase auth initialization error:", error);
      }
    }
  }, []);

  useEffect(() => {
    const token = cookies.get("accessToken");
    if (token !== undefined && token !== null && token !== "") {
      context?.alertBox("info", "You are already logged in.");
      router.push("/");
    }
    cookies.remove("actionType");
  }, []);
  const context = useContext(MyContext);
  const router = useRouter();

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

    if (formFields.email === "") {
      context.alertBox("error", "Email is required");
      setIsLoading(false);
      return false;
    }
    if (formFields.password === "") {
      context.alertBox("error", "Password is required");
      setIsLoading(false);
      return false;
    }

    postData("/api/user/login", formFields)
      .then((res) => {
        console.log("Login response:", res);
        if (res?.error !== true) {
          // Set cookies - data is returned directly, not nested under user
          console.log("Setting cookies with:", {
            accessToken: res?.data?.accessToken ? "present" : "missing",
            userName: res?.data?.userName,
            userEmail: res?.data?.userEmail,
          });
          cookies.set("accessToken", res?.data?.accessToken, { expires: 7 });
          cookies.set("refreshToken", res?.data?.refreshToken, { expires: 7 });
          cookies.set("userName", res?.data?.userName || "User", {
            expires: 7,
          });
          cookies.set("userEmail", res?.data?.userEmail || formFields.email, {
            expires: 7,
          });

          // Update context immediately
          context?.setIsLogin(true);
          context?.setUser({
            name: res?.data?.userName || "User",
            email: res?.data?.userEmail || formFields.email,
          });

          context?.alertBox("success", res?.message);

          setFormFields({
            email: "",
            password: "",
          });
          setIsLoading(false);

          // Use small delay to ensure cookies are persisted before navigation
          setTimeout(() => {
            // Dispatch event to notify Header about login AFTER cookies are set
            window.dispatchEvent(new Event("loginSuccess"));
            router.push(redirectUrl);
          }, 100);
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

  const signInWithGoogle = () => {
    if (!auth || !provider) {
      console.warn("Auth or provider not initialized:", { auth, provider });
      context?.alertBox(
        "error",
        "Firebase is not initialized. Please add Firebase credentials to .env.local",
      );
      return;
    }

    console.log("🔵 Starting Google Sign-In...");
    setGoogleLoading(true);

    signInWithPopup(auth, provider)
      .then(async (result) => {
        console.log("✅ Google Sign-In Success");
        const credential = GoogleAuthProvider.credentialFromResult(result);
        const token = credential.accessToken;
        const user = result.user;

        // Prepare user data for backend
        const googleUserData = {
          name: user.displayName || "Google User",
          email: user.email,
          avatar: user.photoURL || "",
          mobile: "",
          role: "User", // Valid enum value
          googleId: user.uid, // Google user ID
        };

        try {
          // Send Google user data to backend
          const backendResponse = await postData(
            "/api/user/authWithGoogle",
            googleUserData,
          );

          if (backendResponse?.error !== true) {
            // Backend success - use backend tokens
            cookies.set(
              "accessToken",
              backendResponse?.data?.accessToken || token,
              { expires: 7 },
            );
            cookies.set(
              "refreshToken",
              backendResponse?.data?.refreshToken || "",
              { expires: 7 },
            );
            cookies.set("userName", user.displayName || "Google User", {
              expires: 7,
            });
            cookies.set("userEmail", user.email, { expires: 7 });
            cookies.set("userPhoto", user.photoURL || "", { expires: 7 });

            // Update context
            context?.setIsLogin?.(true);
            context?.setUser?.({
              name: user.displayName,
              email: user.email,
            });

            context?.alertBox(
              "success",
              backendResponse?.message || "Google Sign-In successful!",
            );

            // Dispatch event first, then navigate
            window.dispatchEvent(new Event("loginSuccess"));
            setTimeout(() => {
              router.push("/");
            }, 100);
          } else {
            throw new Error(
              backendResponse?.message || "Backend registration failed",
            );
          }
        } catch (backendError) {
          console.error("Backend registration failed:", backendError.message);

          // SECURITY: Do not create fake tokens - require backend authentication
          context?.alertBox(
            "error",
            "Authentication service unavailable. Please try again later.",
          );
          setGoogleLoading(false);
          return;

          // Removed insecure fallback that used fake token
          /* REMOVED FOR SECURITY:
          cookies.set("accessToken", token || "google-token", { expires: 7 });
          cookies.set("userName", user.displayName || "Google User", {
            expires: 7,
          });
          cookies.set("userEmail", user.email, { expires: 7 });
          cookies.set("userPhoto", user.photoURL || "", { expires: 7 });

          context?.setIsLogin?.(true);
          context?.setUser?.({
            name: user.displayName,
            email: user.email,
          });

          */
        }
      })
      .catch((error) => {
        const errorCode = error.code;
        const errorMessage = error.message;
        console.error("❌ Google Sign-In Error:", errorCode, errorMessage);

        // Handle specific error types
        if (
          errorCode === "auth/cancelled-popup-request" ||
          errorCode === "auth/popup-closed-by-user"
        ) {
          context?.alertBox("info", "Google Sign-In was cancelled");
        } else if (errorCode === "auth/popup-blocked") {
          context?.alertBox(
            "error",
            "Popup was blocked. Please allow popups for this site.",
          );
        } else {
          context?.alertBox("error", `Google sign-in failed: ${errorMessage}`);
        }
      })
      .finally(() => {
        setGoogleLoading(false);
      });
  };

  return (
    <section className="min-h-screen w-full bg-gray-100 flex items-center justify-center relative overflow-hidden py-10">
      <div className="bg-white p-10 rounded-2xl shadow-xl w-full max-w-md border border-gray-100 mx-4">
        <h1 className="text-center text-2xl font-bold text-gray-800 mb-6">
          Login to your account
        </h1>
        <form onSubmit={handleSubmit}>
          <div className="my-4 w-full">
            <TextField
              id="emailField"
              label="Email"
              variant="outlined"
              className="w-full"
              type="email"
              name="email"
              onChange={onChangeInput}
              disabled={isLoading === true ? true : false}
              value={formFields.email}
            />
          </div>

          <div className="my-4 w-full relative">
            <TextField
              id="passwordField"
              label="Password"
              variant="outlined"
              className="w-full"
              type={`${isShowPassword ? "text" : "password"}`}
              name="password"
              onChange={onChangeInput}
              disabled={isLoading === true ? true : false}
              value={formFields.password}
            />
            <IconButton
              aria-label="password"
              size="large"
              onClick={() => setIsShowPassword(!isShowPassword)}
              className="absolute! top-1.25 right-1.25 z-50"
            >
              {isShowPassword === true ? (
                <FaEyeSlash size={20} />
              ) : (
                <FaEye size={20} />
              )}
            </IconButton>
          </div>

          <div className="py-1">
            <Link
              href="/forgot-password"
              className="text-base font-medium text-gray-700 hover:text-primary"
            >
              Forgot Password?
            </Link>
          </div>

          <div className="my-4 w-full relative">
            <Button
              type="submit"
              className="w-full btn-g py-4! text-base!"
              disabled={!validateValue}
            >
              {isLoading === true ? <CircularProgress /> : "SIGN IN"}
            </Button>
          </div>
        </form>
        <div className="text-center text-[15px] text-gray-600 mb-3">
          <span>
            Not registered?{" "}
            <Link
              href="/register"
              className="text-primary hover:text-secondary font-semibold"
            >
              Sign Up
            </Link>
          </span>
        </div>
        <div className="text-center text-[15px] text-gray-600 mb-3">
          or continue with social account
        </div>

        <Button
          loading={googleLoading}
          loadingPosition="start"
          startIcon={googleLoading ? null : <FcGoogle />}
          variant="outlined"
          size="large"
          disabled={googleLoading || !auth}
          title={
            !auth
              ? "Google Sign-In not configured. Add Firebase credentials to .env.local"
              : "Sign in with Google"
          }
          className="w-full bg-gray-200! text-gray-800! font-semibold! py-3! border! border-[rgba(0,0,0,0.1)]! hover:bg-gray-300! disabled:opacity-50 disabled:cursor-not-allowed!"
          onClick={signInWithGoogle}
        >
          {googleLoading ? "Signing in with Google..." : "Sign in with Google"}
        </Button>
      </div>
    </section>
  );
};

// Loading fallback for Suspense
const LoginLoading = () => (
  <section className="min-h-screen w-full bg-gray-100 flex items-center justify-center">
    <div className="bg-white p-10 rounded-2xl shadow-xl w-full max-w-md border border-gray-100 mx-4 flex items-center justify-center">
      <CircularProgress />
    </div>
  </section>
);

// Main export with Suspense boundary for useSearchParams
const Login = () => {
  return (
    <Suspense fallback={<LoginLoading />}>
      <LoginForm />
    </Suspense>
  );
};

export default Login;
