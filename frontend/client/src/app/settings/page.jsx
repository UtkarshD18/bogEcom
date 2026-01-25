"use client";
import AccountSidebar from "@/components/AccountSiderbar";
import { Button, Switch } from "@mui/material";
import { useEffect, useState } from "react";
import {
  FiBell,
  FiGlobe,
  FiMail,
  FiMoon,
  FiShield,
  FiSmartphone,
} from "react-icons/fi";

const Settings = () => {
  const [settings, setSettings] = useState({
    emailNotifications: true,
    pushNotifications: false,
    orderUpdates: true,
    promotionalEmails: false,
    darkMode: false,
    twoFactorAuth: false,
    language: "en",
  });

  const [saved, setSaved] = useState(false);

  const handleToggle = (key) => {
    setSettings((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
    setSaved(false);
  };

  const handleSave = () => {
    // Save to localStorage for now
    localStorage.setItem("userSettings", JSON.stringify(settings));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  useEffect(() => {
    // Load settings from localStorage
    const savedSettings = localStorage.getItem("userSettings");
    if (savedSettings) {
      setSettings(JSON.parse(savedSettings));
    }
  }, []);

  return (
    <section className="bg-gray-100 py-8 min-h-screen">
      <div className="container flex gap-5">
        <div className="w-[20%]">
          <AccountSidebar />
        </div>

        <div className="wrapper w-[75%]">
          {/* Page Header */}
          <div className="bg-gradient-to-r from-[#c1591c] to-[#d06a2d] text-white rounded-lg p-6 mb-6 shadow-lg">
            <h1 className="text-2xl font-bold mb-1">Settings</h1>
            <p className="text-white/80">
              Manage your account preferences and notifications
            </p>
          </div>

          {/* Notifications Section */}
          <div className="bg-white shadow-md rounded-lg mb-5 overflow-hidden">
            <div className="p-4 border-b border-gray-100 bg-gray-50">
              <div className="flex items-center gap-3">
                <FiBell className="text-[#c1591c]" size={22} />
                <h4 className="text-lg font-semibold text-gray-800">
                  Notifications
                </h4>
              </div>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex items-center justify-between py-2 border-b border-gray-50">
                <div className="flex items-center gap-3">
                  <FiMail className="text-gray-400" size={18} />
                  <div>
                    <p className="font-medium text-gray-700">
                      Email Notifications
                    </p>
                    <p className="text-sm text-gray-500">
                      Receive updates via email
                    </p>
                  </div>
                </div>
                <Switch
                  checked={settings.emailNotifications}
                  onChange={() => handleToggle("emailNotifications")}
                  sx={{
                    "& .MuiSwitch-switchBase.Mui-checked": {
                      color: "#c1591c",
                    },
                    "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": {
                      backgroundColor: "#c1591c",
                    },
                  }}
                />
              </div>

              <div className="flex items-center justify-between py-2 border-b border-gray-50">
                <div className="flex items-center gap-3">
                  <FiSmartphone className="text-gray-400" size={18} />
                  <div>
                    <p className="font-medium text-gray-700">
                      Push Notifications
                    </p>
                    <p className="text-sm text-gray-500">
                      Browser push notifications
                    </p>
                  </div>
                </div>
                <Switch
                  checked={settings.pushNotifications}
                  onChange={() => handleToggle("pushNotifications")}
                  sx={{
                    "& .MuiSwitch-switchBase.Mui-checked": {
                      color: "#c1591c",
                    },
                    "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": {
                      backgroundColor: "#c1591c",
                    },
                  }}
                />
              </div>

              <div className="flex items-center justify-between py-2 border-b border-gray-50">
                <div className="flex items-center gap-3">
                  <FiBell className="text-gray-400" size={18} />
                  <div>
                    <p className="font-medium text-gray-700">Order Updates</p>
                    <p className="text-sm text-gray-500">
                      Get notified about order status
                    </p>
                  </div>
                </div>
                <Switch
                  checked={settings.orderUpdates}
                  onChange={() => handleToggle("orderUpdates")}
                  sx={{
                    "& .MuiSwitch-switchBase.Mui-checked": {
                      color: "#c1591c",
                    },
                    "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": {
                      backgroundColor: "#c1591c",
                    },
                  }}
                />
              </div>

              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-3">
                  <FiMail className="text-gray-400" size={18} />
                  <div>
                    <p className="font-medium text-gray-700">
                      Promotional Emails
                    </p>
                    <p className="text-sm text-gray-500">
                      Receive offers and deals
                    </p>
                  </div>
                </div>
                <Switch
                  checked={settings.promotionalEmails}
                  onChange={() => handleToggle("promotionalEmails")}
                  sx={{
                    "& .MuiSwitch-switchBase.Mui-checked": {
                      color: "#c1591c",
                    },
                    "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": {
                      backgroundColor: "#c1591c",
                    },
                  }}
                />
              </div>
            </div>
          </div>

          {/* Preferences Section */}
          <div className="bg-white shadow-md rounded-lg mb-5 overflow-hidden">
            <div className="p-4 border-b border-gray-100 bg-gray-50">
              <div className="flex items-center gap-3">
                <FiGlobe className="text-[#c1591c]" size={22} />
                <h4 className="text-lg font-semibold text-gray-800">
                  Preferences
                </h4>
              </div>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex items-center justify-between py-2 border-b border-gray-50">
                <div className="flex items-center gap-3">
                  <FiMoon className="text-gray-400" size={18} />
                  <div>
                    <p className="font-medium text-gray-700">Dark Mode</p>
                    <p className="text-sm text-gray-500">Use dark theme</p>
                  </div>
                </div>
                <Switch
                  checked={settings.darkMode}
                  onChange={() => handleToggle("darkMode")}
                  sx={{
                    "& .MuiSwitch-switchBase.Mui-checked": {
                      color: "#c1591c",
                    },
                    "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": {
                      backgroundColor: "#c1591c",
                    },
                  }}
                />
              </div>

              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-3">
                  <FiGlobe className="text-gray-400" size={18} />
                  <div>
                    <p className="font-medium text-gray-700">Language</p>
                    <p className="text-sm text-gray-500">
                      Select preferred language
                    </p>
                  </div>
                </div>
                <select
                  value={settings.language}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      language: e.target.value,
                    }))
                  }
                  className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#c1591c]/50 text-gray-700"
                >
                  <option value="en">English</option>
                  <option value="hi">हिंदी</option>
                  <option value="es">Español</option>
                </select>
              </div>
            </div>
          </div>

          {/* Security Section */}
          <div className="bg-white shadow-md rounded-lg mb-5 overflow-hidden">
            <div className="p-4 border-b border-gray-100 bg-gray-50">
              <div className="flex items-center gap-3">
                <FiShield className="text-[#c1591c]" size={22} />
                <h4 className="text-lg font-semibold text-gray-800">
                  Security
                </h4>
              </div>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-3">
                  <FiShield className="text-gray-400" size={18} />
                  <div>
                    <p className="font-medium text-gray-700">
                      Two-Factor Authentication
                    </p>
                    <p className="text-sm text-gray-500">
                      Add extra security to your account
                    </p>
                  </div>
                </div>
                <Switch
                  checked={settings.twoFactorAuth}
                  onChange={() => handleToggle("twoFactorAuth")}
                  sx={{
                    "& .MuiSwitch-switchBase.Mui-checked": {
                      color: "#c1591c",
                    },
                    "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": {
                      backgroundColor: "#c1591c",
                    },
                  }}
                />
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end gap-4">
            {saved && (
              <span className="text-green-600 font-medium py-2">
                ✓ Settings saved!
              </span>
            )}
            <Button
              variant="contained"
              onClick={handleSave}
              sx={{
                backgroundColor: "#c1591c",
                "&:hover": { backgroundColor: "#a84d18" },
                textTransform: "none",
                fontWeight: 600,
                px: 4,
                py: 1.5,
                borderRadius: 2,
              }}
            >
              Save Settings
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Settings;
