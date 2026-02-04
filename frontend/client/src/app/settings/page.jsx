"use client";
import AccountSidebar from "@/components/AccountSiderbar";
import { Button, CircularProgress, Switch } from "@mui/material";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";

const Settings = () => {
  const [settings, setSettings] = useState({
    emailNotifications: true,
    pushNotifications: false,
    orderUpdates: true,
    promotionalEmails: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Fetch settings from backend on mount
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/user/settings`,
          {
            method: "GET",
            credentials: "include",
            headers: {
              "Content-Type": "application/json",
            },
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
              data.data.notificationSettings?.pushNotifications ?? false,
            orderUpdates: data.data.notificationSettings?.orderUpdates ?? true,
            promotionalEmails:
              data.data.notificationSettings?.promotionalEmails ?? false,
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

  const handleToggle = (key) => {
    setSettings((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/user/settings`,
        {
          method: "PUT",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            notificationSettings: {
              emailNotifications: settings.emailNotifications,
              pushNotifications: settings.pushNotifications,
              orderUpdates: settings.orderUpdates,
              promotionalEmails: settings.promotionalEmails,
            },
          }),
        },
      );

      const data = await response.json();

      if (data.success) {
        toast.success("Settings saved successfully!");
      } else {
        throw new Error(data.message || "Failed to save settings");
      }
    } catch (error) {
      console.error("Error saving settings:", error);
      toast.error(error.message || "Failed to save settings");
    } finally {
      setSaving(false);
    }
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
