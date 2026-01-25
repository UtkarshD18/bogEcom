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
import { useRouter } from "next/navigation";
import { useContext, useEffect, useState } from "react";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import { FcGoogle } from "react-icons/fc";

const Register = () => {
  const [auth, setAuth] = useState(null);
  const [provider, setProvider] = useState(null);
  const [isShowPassword, setIsShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [formFields, setFormFields] = useState({
    name: "",
    email: "",
    password: "",
  });

  // Initialize Firebase auth
  useEffect(() => {
    if (firebaseApp) {
      try {
        setAuth(getAuth(firebaseApp));
        setProvider(new GoogleAuthProvider());
        console.log("✓ Firebase auth initialized in register page");
      } catch (error) {
        console.error("Firebase auth initialization error:", error);
      }
    }
  }, []);

  const signUpWithGoogle = async () => {
    if (!auth || !provider) {
      context?.alertBox(
        "error",
        "Google Sign-In is not available. Please try again later.",
      );
      return;
    }

    console.log("🔵 Starting Google Sign-Up...");
    setGoogleLoading(true);

    signInWithPopup(auth, provider)
      .then(async (result) => {
        console.log("✅ Google Sign-Up Success");
        const credential = GoogleAuthProvider.credentialFromResult(result);
        const token = credential.accessToken;
        const user = result.user;

        // Prepare user data for backend registration
        const googleUserData = {
          name: user.displayName || "Google User",
          email: user.email,
          avatar: user.photoURL || "",
          mobile: "",
          role: "User",
          googleId: user.uid,
        };

        try {
          // Register Google user with backend
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
              backendResponse?.message || "Google registration successful!",
            );

            setTimeout(() => {
              router.push("/");
            }, 2000);
          } else {
            // Backend failed - use Firebase tokens as fallback
            console.warn(
              "Backend registration failed, using Firebase auth:",
              backendResponse,
            );
            cookies.set("accessToken", token, { expires: 7 });
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

            context?.alertBox(
              "success",
              "Google registration successful (local mode)!",
            );

            setTimeout(() => {
              router.push("/");
            }, 2000);
          }
        } catch (backendError) {
          console.error("Backend registration error:", backendError);
          // Continue with Firebase-only authentication
          cookies.set("accessToken", token, { expires: 7 });
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

          context?.alertBox("success", "Google registration successful!");

          setTimeout(() => {
            router.push("/");
          }, 2000);
        }
      })
      .catch((error) => {
        console.error("Google Sign-Up Error:", error);
        setGoogleLoading(false);

        if (error.code === "auth/popup-blocked") {
          context?.alertBox(
            "error",
            "Popup was blocked. Please allow popups and try again.",
          );
        } else if (error.code === "auth/popup-closed-by-user") {
          context?.alertBox("info", "Sign-up was cancelled.");
        } else {
          context?.alertBox(
            "error",
            error.message || "Google registration failed. Please try again.",
          );
        }
      })
      .finally(() => {
        setGoogleLoading(false);
      });
  };

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

    if (formFields.name === "") {
      context.alertBox("error", "Full Name is required");
      setIsLoading(false);
      return false;
    }
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

    postData("/api/user/register", formFields)
      .then((res) => {
        if (res?.error !== true) {
          setIsLoading(false);
          context?.alertBox("success", res?.message);
          cookies.set("userEmail", formFields.email);
          cookies.set("actionType", "verifyEmail");

          setFormFields({
            name: "",
            email: "",
            password: "",
          });
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
    <section className="min-h-screen w-full bg-gray-100 flex items-center justify-center relative overflow-hidden py-10">
      <div className="bg-white p-10 rounded-2xl shadow-xl w-full max-w-[500px] border border-gray-100 mx-4">
        <h1 className="text-center text-2xl font-bold text-gray-800 mb-6">
          Register with a new account
        </h1>
        <form onSubmit={handleSubmit}>
          <div className="my-4 w-full">
            <TextField
              id="fullName"
              label="Full Name"
              variant="outlined"
              className="w-full"
              name="name"
              onChange={onChangeInput}
              disabled={isLoading === true ? true : false}
              value={formFields.name}
            />
          </div>
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
              className="!absolute top-[5px] right-[5px] z-50"
            >
              {isShowPassword === true ? (
                <FaEyeSlash size={20} />
              ) : (
                <FaEye size={20} />
              )}
            </IconButton>
          </div>
          <div className="my-4 w-full relative">
            <Button
              type="submit"
              className="w-full btn-g !py-4 !text-[16px]"
              disabled={!validateValue}
            >
              {isLoading === true ? <CircularProgress /> : "Register"}
            </Button>
          </div>

          <div className="text-center text-[15px] text-gray-600 mb-3">
            <span>
              Already have an account?{" "}
              <Link
                href={"/login"}
                className="text-primary hover:text-secondary font-[600]"
              >
                Login
              </Link>
            </span>
          </div>
          <div className="text-center text-[15px] text-gray-600 mb-3">
            or continue with social account
          </div>

          <Button
            onClick={signUpWithGoogle}
            disabled={googleLoading}
            startIcon={
              googleLoading ? <CircularProgress size={20} /> : <FcGoogle />
            }
            variant="outlined"
            size="large"
            className="w-full !bg-gray-200 !text-gray-800 !font-[600] !py-3 !border !border-[rgba(0,0,0,0.1)] hover:!bg-gray-300"
          >
            {googleLoading
              ? "Signing up with Google..."
              : "Sign up with Google"}
          </Button>
        </form>
      </div>
    </section>
  );
};

export default Register;
