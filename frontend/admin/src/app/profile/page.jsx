"use client";

import { useAdmin } from "@/context/AdminContext";
import { API_BASE_URL, getData, postData, putData } from "@/utils/api";
import {
  Alert,
  Avatar,
  Button,
  CircularProgress,
  Divider,
  FormControlLabel,
  Snackbar,
  Switch,
  TextField,
} from "@mui/material";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  MdDelete,
  MdLogout,
  MdRefresh,
  MdSave,
  MdUpload,
  MdVpnKey,
} from "react-icons/md";

const API_URL = API_BASE_URL;

const DEFAULT_NOTIFICATION_SETTINGS = {
  emailNotifications: true,
  pushNotifications: true,
  orderUpdates: true,
  promotionalEmails: true,
};

const DEFAULT_PREFERENCES = {
  darkMode: false,
  language: "en",
};

const isApiSuccess = (response) =>
  Boolean(response) && (response.success === true || response.error === false);

const resolveAvatarUrl = (avatar) => {
  const value = String(avatar || "").trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  return `${API_URL}${value.startsWith("/") ? "" : "/"}${value}`;
};

export default function AdminProfilePage() {
  const { token, admin, logout, syncAdminSession } = useAdmin();

  const fileInputRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [removingPhoto, setRemovingPhoto] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const [profileForm, setProfileForm] = useState({
    name: "",
    email: "",
    avatar: "",
    role: "Admin",
    status: "active",
    provider: "local",
    hasBackupPassword: false,
    createdAt: "",
    last_login_date: "",
  });

  const [settingsForm, setSettingsForm] = useState({
    notificationSettings: { ...DEFAULT_NOTIFICATION_SETTINGS },
    preferences: { ...DEFAULT_PREFERENCES },
  });

  const [passwordForm, setPasswordForm] = useState({
    password: "",
    confirmPassword: "",
  });

  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success",
  });

  const avatarPreview = useMemo(
    () => resolveAvatarUrl(profileForm.avatar),
    [profileForm.avatar],
  );

  const canSetBackupPassword =
    profileForm.provider === "google" && !profileForm.hasBackupPassword;

  const showToast = useCallback((message, severity = "success") => {
    setSnackbar({ open: true, message, severity });
  }, []);

  const loadData = useCallback(async () => {
    if (!token) return;

    setLoading(true);
    try {
      const [profileResponse, settingsResponse] = await Promise.all([
        getData("/api/user/user-details", token),
        getData("/api/user/settings", token),
      ]);

      if (isApiSuccess(profileResponse) && profileResponse.data) {
        const data = profileResponse.data;
        setProfileForm((prev) => ({
          ...prev,
          name: data.name || "",
          email: data.email || "",
          avatar: data.avatar || "",
          role: data.role || "Admin",
          status: data.status || "active",
          provider: data.provider || "local",
          hasBackupPassword: Boolean(data.hasBackupPassword),
          createdAt: data.createdAt || "",
          last_login_date: data.last_login_date || "",
        }));
        syncAdminSession(data);
      }

      if (isApiSuccess(settingsResponse) && settingsResponse.data) {
        setSettingsForm({
          notificationSettings: {
            ...DEFAULT_NOTIFICATION_SETTINGS,
            ...(settingsResponse.data.notificationSettings || {}),
          },
          preferences: {
            ...DEFAULT_PREFERENCES,
            ...(settingsResponse.data.preferences || {}),
          },
        });
      }
    } catch (error) {
      showToast("Failed to load profile data", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast, syncAdminSession, token]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSaveProfile = async () => {
    const payload = {
      name: String(profileForm.name || "").trim(),
      email: String(profileForm.email || "").trim().toLowerCase(),
    };

    if (!payload.name || !payload.email) {
      showToast("Name and email are required", "error");
      return;
    }

    setSavingProfile(true);
    try {
      const response = await putData("/api/user/profile", payload, token);
      if (!isApiSuccess(response)) {
        showToast(response?.message || "Failed to save profile", "error");
        return;
      }

      const updatedUser = response.data || {};
      setProfileForm((prev) => ({
        ...prev,
        name: updatedUser.name || prev.name,
        email: updatedUser.email || prev.email,
        avatar: updatedUser.avatar || prev.avatar,
        provider: updatedUser.provider || prev.provider,
        hasBackupPassword:
          typeof updatedUser.hasBackupPassword === "boolean"
            ? updatedUser.hasBackupPassword
            : prev.hasBackupPassword,
      }));
      syncAdminSession(updatedUser);
      showToast("Profile updated successfully");
    } catch (error) {
      showToast("Failed to save profile", "error");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleUploadPhoto = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setUploadingPhoto(true);
    try {
      const authToken = token || localStorage.getItem("adminToken");
      const formData = new FormData();
      formData.append("image", file);

      const response = await fetch(`${API_URL}/api/user/upload-photo`, {
        method: "POST",
        headers: authToken
          ? {
              Authorization: `Bearer ${authToken}`,
            }
          : undefined,
        credentials: "include",
        body: formData,
      });

      const data = await response.json();
      if (!response.ok || !isApiSuccess(data)) {
        showToast(data?.message || "Failed to upload photo", "error");
        return;
      }

      const nextAvatar = data?.data?.photo || data?.data?.user?.avatar || "";
      setProfileForm((prev) => ({ ...prev, avatar: nextAvatar }));
      syncAdminSession(data?.data?.user || { avatar: nextAvatar });
      showToast("Profile photo updated");
    } catch (error) {
      showToast("Failed to upload photo", "error");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleRemovePhoto = async () => {
    setRemovingPhoto(true);
    try {
      const response = await postData("/api/user/remove-photo", {}, token);
      if (!isApiSuccess(response)) {
        showToast(response?.message || "Failed to remove photo", "error");
        return;
      }

      setProfileForm((prev) => ({ ...prev, avatar: "" }));
      syncAdminSession({ avatar: "" });
      showToast("Profile photo removed");
    } catch (error) {
      showToast("Failed to remove photo", "error");
    } finally {
      setRemovingPhoto(false);
    }
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      const response = await putData(
        "/api/user/settings",
        {
          notificationSettings: settingsForm.notificationSettings,
          preferences: settingsForm.preferences,
        },
        token,
      );

      if (!isApiSuccess(response)) {
        showToast(response?.message || "Failed to save preferences", "error");
        return;
      }

      showToast("Preferences updated");
    } catch (error) {
      showToast("Failed to save preferences", "error");
    } finally {
      setSavingSettings(false);
    }
  };

  const handleSetBackupPassword = async () => {
    const password = String(passwordForm.password || "");
    const confirmPassword = String(passwordForm.confirmPassword || "");

    if (!password || !confirmPassword) {
      showToast("Enter password and confirm password", "error");
      return;
    }

    if (password !== confirmPassword) {
      showToast("Passwords do not match", "error");
      return;
    }

    setSavingPassword(true);
    try {
      const response = await postData(
        "/api/user/set-backup-password",
        { password },
        token,
      );

      if (!isApiSuccess(response)) {
        showToast(response?.message || "Failed to set backup password", "error");
        return;
      }

      setProfileForm((prev) => ({
        ...prev,
        hasBackupPassword: true,
        provider: "mixed",
      }));
      syncAdminSession({ hasBackupPassword: true, provider: "mixed" });
      setPasswordForm({ password: "", confirmPassword: "" });
      showToast("Backup password set successfully");
    } catch (error) {
      showToast("Failed to set backup password", "error");
    } finally {
      setSavingPassword(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <CircularProgress />
      </div>
    );
  }

  return (
    <section className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Admin Profile</h1>
          <p className="text-sm text-gray-500">
            Manage your account details and preferences.
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outlined"
            startIcon={<MdRefresh />}
            onClick={loadData}
          >
            Refresh
          </Button>
          <Button
            variant="outlined"
            color="error"
            startIcon={<MdLogout />}
            onClick={logout}
          >
            Logout
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center gap-5">
          <Avatar
            src={avatarPreview || "/profile.png"}
            sx={{ width: 84, height: 84 }}
          />

          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-gray-600">
            <div>
              <p className="text-xs uppercase text-gray-400">Role</p>
              <p className="font-semibold text-gray-800">{profileForm.role}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-gray-400">Status</p>
              <p className="font-semibold text-gray-800 capitalize">
                {profileForm.status}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase text-gray-400">Provider</p>
              <p className="font-semibold text-gray-800 capitalize">
                {profileForm.provider}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase text-gray-400">Email Verified</p>
              <p className="font-semibold text-gray-800">
                {admin?.verifyEmail ? "Yes" : "No"}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleUploadPhoto}
            />
            <Button
              variant="outlined"
              startIcon={uploadingPhoto ? <CircularProgress size={16} /> : <MdUpload />}
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingPhoto}
            >
              {uploadingPhoto ? "Uploading..." : "Upload Photo"}
            </Button>
            <Button
              variant="outlined"
              color="error"
              startIcon={removingPhoto ? <CircularProgress size={16} /> : <MdDelete />}
              onClick={handleRemovePhoto}
              disabled={removingPhoto || !profileForm.avatar}
            >
              {removingPhoto ? "Removing..." : "Remove Photo"}
            </Button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm space-y-4">
        <h2 className="text-lg font-semibold text-gray-800">Profile Details</h2>
        <Divider />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <TextField
            label="Full Name"
            size="small"
            value={profileForm.name}
            onChange={(event) =>
              setProfileForm((prev) => ({ ...prev, name: event.target.value }))
            }
            fullWidth
          />
          <TextField
            label="Email"
            size="small"
            type="email"
            value={profileForm.email}
            onChange={(event) =>
              setProfileForm((prev) => ({ ...prev, email: event.target.value }))
            }
            fullWidth
          />
          <TextField
            label="Created At"
            size="small"
            value={
              profileForm.createdAt
                ? new Date(profileForm.createdAt).toLocaleString()
                : "-"
            }
            fullWidth
            disabled
          />
          <TextField
            label="Last Login"
            size="small"
            value={
              profileForm.last_login_date
                ? new Date(profileForm.last_login_date).toLocaleString()
                : "-"
            }
            fullWidth
            disabled
          />
        </div>

        <div className="flex justify-end">
          <Button
            variant="contained"
            startIcon={savingProfile ? <CircularProgress size={16} color="inherit" /> : <MdSave />}
            onClick={handleSaveProfile}
            disabled={savingProfile}
          >
            {savingProfile ? "Saving..." : "Save Profile"}
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm space-y-4">
        <h2 className="text-lg font-semibold text-gray-800">Preferences</h2>
        <Divider />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormControlLabel
            control={
              <Switch
                checked={settingsForm.notificationSettings.emailNotifications}
                onChange={(event) =>
                  setSettingsForm((prev) => ({
                    ...prev,
                    notificationSettings: {
                      ...prev.notificationSettings,
                      emailNotifications: event.target.checked,
                    },
                  }))
                }
                color="warning"
              />
            }
            label="Email Notifications"
          />

          <FormControlLabel
            control={
              <Switch
                checked={settingsForm.notificationSettings.pushNotifications}
                onChange={(event) =>
                  setSettingsForm((prev) => ({
                    ...prev,
                    notificationSettings: {
                      ...prev.notificationSettings,
                      pushNotifications: event.target.checked,
                    },
                  }))
                }
                color="warning"
              />
            }
            label="Push Notifications"
          />

          <FormControlLabel
            control={
              <Switch
                checked={settingsForm.notificationSettings.orderUpdates}
                onChange={(event) =>
                  setSettingsForm((prev) => ({
                    ...prev,
                    notificationSettings: {
                      ...prev.notificationSettings,
                      orderUpdates: event.target.checked,
                    },
                  }))
                }
                color="warning"
              />
            }
            label="Order Updates"
          />

          <FormControlLabel
            control={
              <Switch
                checked={settingsForm.notificationSettings.promotionalEmails}
                onChange={(event) =>
                  setSettingsForm((prev) => ({
                    ...prev,
                    notificationSettings: {
                      ...prev.notificationSettings,
                      promotionalEmails: event.target.checked,
                    },
                  }))
                }
                color="warning"
              />
            }
            label="Promotional Emails"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <TextField
            label="Language"
            size="small"
            value={settingsForm.preferences.language}
            onChange={(event) =>
              setSettingsForm((prev) => ({
                ...prev,
                preferences: {
                  ...prev.preferences,
                  language: event.target.value,
                },
              }))
            }
            fullWidth
          />
          <FormControlLabel
            control={
              <Switch
                checked={settingsForm.preferences.darkMode}
                onChange={(event) =>
                  setSettingsForm((prev) => ({
                    ...prev,
                    preferences: {
                      ...prev.preferences,
                      darkMode: event.target.checked,
                    },
                  }))
                }
                color="warning"
              />
            }
            label="Dark Mode Preference"
          />
        </div>

        <div className="flex justify-end">
          <Button
            variant="contained"
            startIcon={savingSettings ? <CircularProgress size={16} color="inherit" /> : <MdSave />}
            onClick={handleSaveSettings}
            disabled={savingSettings}
          >
            {savingSettings ? "Saving..." : "Save Preferences"}
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm space-y-4">
        <h2 className="text-lg font-semibold text-gray-800">Security</h2>
        <Divider />

        <p className="text-sm text-gray-500">
          Backup password is only required for Google-only accounts.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <TextField
            label="Backup Password"
            size="small"
            type="password"
            value={passwordForm.password}
            onChange={(event) =>
              setPasswordForm((prev) => ({
                ...prev,
                password: event.target.value,
              }))
            }
            fullWidth
            disabled={!canSetBackupPassword}
          />
          <TextField
            label="Confirm Password"
            size="small"
            type="password"
            value={passwordForm.confirmPassword}
            onChange={(event) =>
              setPasswordForm((prev) => ({
                ...prev,
                confirmPassword: event.target.value,
              }))
            }
            fullWidth
            disabled={!canSetBackupPassword}
          />
        </div>

        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            {profileForm.hasBackupPassword
              ? "Backup password already configured."
              : profileForm.provider === "google"
                ? "Set a backup password to allow email/password login too."
                : "Current account does not require backup password."}
          </p>
          <Button
            variant="contained"
            startIcon={savingPassword ? <CircularProgress size={16} color="inherit" /> : <MdVpnKey />}
            onClick={handleSetBackupPassword}
            disabled={!canSetBackupPassword || savingPassword}
          >
            {savingPassword ? "Saving..." : "Set Backup Password"}
          </Button>
        </div>
      </div>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3500}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert
          onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
          severity={snackbar.severity}
          variant="filled"
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </section>
  );
}

