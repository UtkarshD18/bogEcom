"use client";
import AccountSidebar from "@/components/AccountSiderbar";
import { Button, CircularProgress, Switch } from "@mui/material";
import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";

const API_URL = (
  process.env.NEXT_PUBLIC_APP_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:8000"
).replace(/\/+$/, "");

const Settings = () => {
  const [settings, setSettings] = useState({
    emailNotifications: true,
    pushNotifications: true,
    orderUpdates: true,
    promotionalEmails: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const saveQueueRef = useRef(Promise.resolve());

  // Fetch settings from backend on mount
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await fetch(
          `${API_URL}/api/user/settings`,
          {
            method: "GET",
            credentials: "include",
          },
        );

        // If not authenticated or server error, just use defaults
        if (!response.ok) {
          console.log("Could not fetch settings, using defaults");
          setLoading(false);
          return;
        }

        const data = await response.json();
        if (data.success && data.data) {
          setSettings({
            emailNotifications:
              data.data.notificationSettings?.emailNotifications ?? true,
            pushNotifications:
              data.data.notificationSettings?.pushNotifications ?? true,
            orderUpdates: data.data.notificationSettings?.orderUpdates ?? true,
            promotionalEmails:
              data.data.notificationSettings?.promotionalEmails ?? true,
          });
        }
      } catch (error) {
        // Network error or server not running - use defaults silently
        console.log("Settings API unavailable, using defaults:", error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, []);

  const saveSettings = async (nextSettings, { showSuccessToast } = {}) => {
    const shouldShowSuccess = showSuccessToast !== false;

    try {
      const response = await fetch(
        `${API_URL}/api/user/settings`,
        {
          method: "PUT",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            notificationSettings: {
              emailNotifications: nextSettings.emailNotifications,
              pushNotifications: nextSettings.pushNotifications,
              orderUpdates: nextSettings.orderUpdates,
              promotionalEmails: nextSettings.promotionalEmails,
            },
          }),
        },
      );

      const data = await response.json();

      if (data.success) {
        if (shouldShowSuccess) toast.success("Settings saved successfully!");
        return true;
      } else {
        throw new Error(data.message || "Failed to save settings");
      }
    } catch (error) {
      console.error("Error saving settings:", error);
      toast.error(error.message || "Failed to save settings");
      return false;
    } finally {
    }
  };

  const queueSaveSettings = (nextSettings, options) => {
    saveQueueRef.current = saveQueueRef.current
      .catch(() => {
        // Keep the queue alive even if a previous request failed.
      })
      .then(async () => {
        setSaving(true);
        const ok = await saveSettings(nextSettings, options);
        setSaving(false);

        if (!ok) {
          // Re-sync from backend to prevent UI/backend mismatch.
          try {
            const response = await fetch(`${API_URL}/api/user/settings`, {
              method: "GET",
              credentials: "include",
            });
            const data = await response.json();
            if (data.success && data.data?.notificationSettings) {
              setSettings({
                emailNotifications:
                  data.data.notificationSettings.emailNotifications ?? true,
                pushNotifications:
                  data.data.notificationSettings.pushNotifications ?? true,
                orderUpdates: data.data.notificationSettings.orderUpdates ?? true,
                promotionalEmails:
                  data.data.notificationSettings.promotionalEmails ?? true,
              });
            }
          } catch (syncError) {
            // Best-effort only.
          }
        }
      });

    return saveQueueRef.current;
  };

  const handleToggle = (key) => {
    setSettings((prev) => {
      const nextSettings = { ...prev, [key]: !prev[key] };
      // Persist immediately to backend (no explicit save required).
      queueSaveSettings(nextSettings, { showSuccessToast: false });
      return nextSettings;
    });
  };

  const handleSave = async () => {
    await queueSaveSettings(settings, { showSuccessToast: true });
  };

  if (loading) {
    return (
      <section className="bg-gray-100 py-8">
        <div className="container flex gap-5">
          <div className="w-[20%]">
            <AccountSidebar />
          </div>
          <div className="wrapper w-[75%] flex items-center justify-center min-h-[400px]">
            <CircularProgress color="warning" />
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-gray-100 py-8">
      <div className="container flex gap-5">
        <div className="w-[20%]">
          <AccountSidebar />
        </div>

        <div className="wrapper w-[75%]">
          {/* Notifications Section */}
          <div className="bg-white shadow-md rounded-md mb-5">
            <div className="p-4 border-b-[1px] border-[rgba(0,0,0,0.2)]">
              <h4 className="text-[20px] font-[500] text-gray-700">
                Notifications
              </h4>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h5 className="text-[16px] font-[500] text-gray-700">
                    Email Notifications
                  </h5>
                  <p className="text-[14px] text-gray-500">
                    Receive email notifications for orders and updates
                  </p>
                </div>
                <Switch
                  checked={settings.emailNotifications}
                  onChange={() => handleToggle("emailNotifications")}
                  color="warning"
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h5 className="text-[16px] font-[500] text-gray-700">
                    Push Notifications
                  </h5>
                  <p className="text-[14px] text-gray-500">
                    Receive push notifications on your device
                  </p>
                </div>
                <Switch
                  checked={settings.pushNotifications}
                  onChange={() => handleToggle("pushNotifications")}
                  color="warning"
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h5 className="text-[16px] font-[500] text-gray-700">
                    Order Updates
                  </h5>
                  <p className="text-[14px] text-gray-500">
                    Get notified about your order status changes
                  </p>
                </div>
                <Switch
                  checked={settings.orderUpdates}
                  onChange={() => handleToggle("orderUpdates")}
                  color="warning"
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h5 className="text-[16px] font-[500] text-gray-700">
                    Promotional Emails
                  </h5>
                  <p className="text-[14px] text-gray-500">
                    Receive emails about deals and offers
                  </p>
                </div>
                <Switch
                  checked={settings.promotionalEmails}
                  onChange={() => handleToggle("promotionalEmails")}
                  color="warning"
                />
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end">
            <Button
              className="btn-g px-8"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? (
                <CircularProgress size={20} color="inherit" />
              ) : (
                "Save Changes"
              )}
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};
export default Settings;
