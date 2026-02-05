"use client";
import { MyContext } from "@/context/ThemeProvider";
import { postData } from "@/utils/api";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import TextField from "@mui/material/TextField";
import { useContext, useState } from "react";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import { MdSecurity } from "react-icons/md";

const SetBackupPassword = ({ onSuccess, userProvider }) => {
  const [isShowPassword, setIsShowPassword] = useState(false);
  const [isShowConfirmPassword, setIsShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formFields, setFormFields] = useState({
    password: "",
    confirmPassword: "",
  });

  const context = useContext(MyContext);

  // Only show for Google users without backup passwords
  if (userProvider !== "google") {
    return null;
  }

  const onChangeInput = (e) => {
    const { name, value } = e.target;
    setFormFields((prev) => ({ ...prev, [name]: value }));
  };

  const validateForm = () => {
    if (!formFields.password) {
      context?.alertBox("error", "Password is required");
      return false;
    }
    if (formFields.password.length < 6) {
      context?.alertBox("error", "Password must be at least 6 characters");
      return false;
    }
    if (formFields.password !== formFields.confirmPassword) {
      context?.alertBox("error", "Passwords do not match");
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsLoading(true);

    try {
      const response = await postData("/api/user/set-backup-password", {
        password: formFields.password,
      });

      if (response?.success) {
        context?.alertBox(
          "success",
          response?.message || "Backup password set successfully!",
        );
        setFormFields({ password: "", confirmPassword: "" });
        onSuccess?.(); // Callback to parent component
      } else {
        context?.alertBox(
          "error",
          response?.message || "Failed to set backup password",
        );
      }
    } catch (error) {
      console.error("Set backup password error:", error);
      context?.alertBox("error", "An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="rounded-lg shadow-md p-6 mb-6"
      style={{ backgroundColor: "var(--flavor-card-bg, #fffbf5)" }}
    >
      <div className="flex items-center gap-3 mb-4">
        <MdSecurity className="text-blue-500 text-2xl" />
        <div>
          <h3 className="text-lg font-semibold text-gray-800">
            Set Backup Password
          </h3>
          <p className="text-sm text-gray-600">
            Add a password to enable email/password login as backup
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="relative">
          <TextField
            label="New Password"
            variant="outlined"
            fullWidth
            type={isShowPassword ? "text" : "password"}
            name="password"
            value={formFields.password}
            onChange={onChangeInput}
            disabled={isLoading}
            helperText="At least 6 characters"
          />
          <IconButton
            onClick={() => setIsShowPassword(!isShowPassword)}
            className="!absolute top-2 right-2"
          >
            {isShowPassword ? <FaEyeSlash /> : <FaEye />}
          </IconButton>
        </div>

        <div className="relative">
          <TextField
            label="Confirm Password"
            variant="outlined"
            fullWidth
            type={isShowConfirmPassword ? "text" : "password"}
            name="confirmPassword"
            value={formFields.confirmPassword}
            onChange={onChangeInput}
            disabled={isLoading}
          />
          <IconButton
            onClick={() => setIsShowConfirmPassword(!isShowConfirmPassword)}
            className="!absolute top-2 right-2"
          >
            {isShowConfirmPassword ? <FaEyeSlash /> : <FaEye />}
          </IconButton>
        </div>

        <Button
          type="submit"
          variant="contained"
          fullWidth
          disabled={
            isLoading || !formFields.password || !formFields.confirmPassword
          }
          className="!py-3"
        >
          {isLoading ? (
            <>
              <CircularProgress size={20} className="mr-2" />
              Setting Password...
            </>
          ) : (
            "Set Backup Password"
          )}
        </Button>
      </form>
    </div>
  );
};

export default SetBackupPassword;
