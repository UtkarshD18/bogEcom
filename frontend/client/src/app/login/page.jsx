"use client";
import { MyContext } from "@/context/ThemeProvider";
import { firebaseApp } from "@/firebase";
import { postData } from "@/utils/api";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import TextField from "@mui/material/TextField";
import {
  GoogleAuthProvider,
  getAuth,
  getRedirectResult,
  signInWithPopup,
  signInWithRedirect,
} from "firebase/auth";
import cookies from "js-cookie";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useContext, useEffect, useState } from "react";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import { FcGoogle } from "react-icons/fc";

const GOOGLE_REDIRECT_ATTEMPT_KEY = "googleAuthRedirectAttempted";
const GOOGLE_POPUP_CANCEL_CODES = new Set([
  "auth/popup-closed-by-user",
  "auth/cancelled-popup-request",
]);

const getStoredToken = () => {
  if (typeof window === "undefined") return cookies.get("accessToken") || null;
  return (
    cookies.get("accessToken") ||
    localStorage.getItem("accessToken") ||
    localStorage.getItem("token") ||
    null
  );
};

const clearStoredSession = () => {
  cookies.remove("accessToken");
  cookies.remove("refreshToken");
  cookies.remove("userName");
  cookies.remove("userEmail");
  cookies.remove("userPhoto");

  if (typeof window !== "undefined") {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("token");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("userName");
    localStorage.removeItem("userEmail");
    localStorage.removeItem("userPhoto");
  }
};

const persistSession = (payload, fallbackEmail = "") => {
  const accessToken = payload?.accessToken || "";
  const refreshToken = payload?.refreshToken || "";
  const userName = payload?.userName || "User";
  const userEmail = payload?.userEmail || fallbackEmail;
  const userPhoto = payload?.userPhoto || payload?.avatar || "";

  if (!accessToken || String(accessToken).split(".").length !== 3) {
    return false;
  }

  cookies.set("accessToken", accessToken, { expires: 7 });
  cookies.set("refreshToken", refreshToken, { expires: 7 });
  cookies.set("userName", userName, { expires: 7 });
  cookies.set("userEmail", userEmail, { expires: 7 });

  if (userPhoto) {
    cookies.set("userPhoto", userPhoto, { expires: 7 });
  } else {
    cookies.remove("userPhoto");
  }

  if (typeof window !== "undefined") {
    localStorage.setItem("accessToken", accessToken);
    localStorage.setItem("token", accessToken);
    localStorage.setItem("refreshToken", refreshToken);
    localStorage.setItem("userName", userName);
    localStorage.setItem("userEmail", userEmail);
    if (userPhoto) {
      localStorage.setItem("userPhoto", userPhoto);
    } else {
      localStorage.removeItem("userPhoto");
    }
  }

  return true;
};

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
  const context = useContext(MyContext);
  const router = useRouter();

  const completeGoogleSignIn = async (result) => {
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const token = credential?.accessToken || "";
    const user = result?.user;

    if (!user?.email) {
      throw new Error("Google account email is missing");
    }

    const googleUserData = {
      name: user.displayName || "Google User",
      email: user.email,
      avatar: user.photoURL || "",
      mobile: "",
      role: "User",
      googleId: user.uid,
    };

    const backendResponse = await postData(
      "/api/user/authWithGoogle",
      googleUserData,
    );
    if (backendResponse?.error === true) {
      throw new Error(backendResponse?.message || "Backend registration failed");
    }

    const persisted = persistSession(
      {
        ...backendResponse?.data,
        accessToken: backendResponse?.data?.accessToken || token,
        userName: user.displayName || "Google User",
        userEmail: user.email,
        userPhoto: user.photoURL || "",
      },
      user.email,
    );
    if (!persisted) {
      throw new Error("Google auth token missing");
    }

    context?.setIsLogin?.(true);
    context?.setUser?.({
      name: user.displayName,
      email: user.email,
    });
    context?.alertBox(
      "success",
      backendResponse?.message || "Google Sign-In successful!",
    );

    window.dispatchEvent(new Event("loginSuccess"));
    setTimeout(() => {
      router.push(redirectUrl);
    }, 100);
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
              await completeGoogleSignIn(result);
            }
          })
          .catch((error) => {
            console.error("Google redirect result error:", error);
            if (error?.code === "auth/unauthorized-domain") {
              const origin =
                typeof window !== "undefined"
                  ? window.location.origin
                  : "unknown-origin";
              context?.alertBox(
                "error",
                `Google sign-in blocked for ${origin}.`,
              );
            }
          })
          .finally(() => {
            if (typeof window !== "undefined") {
              sessionStorage.removeItem(GOOGLE_REDIRECT_ATTEMPT_KEY);
            }
          });
        console.log("âœ“ Firebase auth initialized in login page");
      } catch (error) {
        console.error("Firebase auth initialization error:", error);
      }
    }
  }, []);

  useEffect(() => {
    const token = getStoredToken();
    if (token) {
      // Check if the JWT is actually still valid (not expired)
      try {
        const tokenPart = token.split(".")[1];
        const normalizedPart = tokenPart
          .replace(/-/g, "+")
          .replace(/_/g, "/")
          .padEnd(Math.ceil(tokenPart.length / 4) * 4, "=");
        const payload = JSON.parse(atob(normalizedPart));
        if (payload.exp * 1000 > Date.now()) {
          context?.alertBox("info", "You are already logged in.");
          router.push("/");
          cookies.remove("actionType");
          return;
        }
      } catch {}
      // Token is expired or invalid â€” clear stale cookies so user can login fresh
      clearStoredSession();
    }
    cookies.remove("actionType");
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
          const persisted = persistSession(res?.data, formFields.email);
          if (!persisted) {
            context?.alertBox(
              "error",
              "Login response is missing token. Please try again.",
            );
            setIsLoading(false);
            return;
          }

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

  const signInWithGoogle = async () => {
    if (!auth || !provider) {
      console.warn("Auth or provider not initialized:", { auth, provider });
      context?.alertBox(
        "error",
        "Firebase is not initialized. Please add Firebase credentials to .env.local",
      );
      return;
    }

    setGoogleLoading(true);

    try {
      const result = await signInWithPopup(auth, provider);
      await completeGoogleSignIn(result);
    } catch (error) {
      const errorCode = error?.code;
      const errorMessage = error?.message;

      if (errorCode === "auth/unauthorized-domain") {
        const canRetryWithRedirect =
          typeof window !== "undefined" &&
          sessionStorage.getItem(GOOGLE_REDIRECT_ATTEMPT_KEY) !== "1";

        if (canRetryWithRedirect) {
          sessionStorage.setItem(GOOGLE_REDIRECT_ATTEMPT_KEY, "1");
          context?.alertBox("info", "Retrying Google sign-in with redirect...");
          await signInWithRedirect(auth, provider);
          return;
        }

        const origin =
          typeof window !== "undefined"
            ? window.location.origin
            : "unknown-origin";
        context?.alertBox("error", `Google sign-in blocked for ${origin}.`);
      } else if (GOOGLE_POPUP_CANCEL_CODES.has(errorCode)) {
        // User manually closed/cancelled popup; do not treat as an error.
        context?.alertBox("info", "Google Sign-In was cancelled");
      } else if (errorCode === "auth/popup-blocked") {
        console.warn("Google Sign-In popup blocked:", errorCode, errorMessage);
        context?.alertBox(
          "error",
          "Popup was blocked. Please allow popups for this site.",
        );
      } else {
        console.error("Google Sign-In Error:", errorCode, errorMessage);
        context?.alertBox("error", `Google sign-in failed: ${errorMessage}`);
      }
    } finally {
      setGoogleLoading(false);
    }
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

