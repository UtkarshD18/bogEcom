"use client";
import AccountSidebar from "@/components/AccountSiderbar";
import { Button, Switch } from "@mui/material";
import { useState } from "react";

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

  const handleToggle = (key) => {
    setSettings((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

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

          {/* Appearance Section */}
          <div className="bg-white shadow-md rounded-md mb-5">
            <div className="p-4 border-b-[1px] border-[rgba(0,0,0,0.2)]">
              <h4 className="text-[20px] font-[500] text-gray-700">
                Appearance
              </h4>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h5 className="text-[16px] font-[500] text-gray-700">
                    Dark Mode
                  </h5>
                  <p className="text-[14px] text-gray-500">
                    Toggle dark mode for better viewing at night
                  </p>
                </div>
                <Switch
                  checked={settings.darkMode}
                  onChange={() => handleToggle("darkMode")}
                  color="warning"
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h5 className="text-[16px] font-[500] text-gray-700">
                    Language
                  </h5>
                  <p className="text-[14px] text-gray-500">
                    Select your preferred language
                  </p>
                </div>
                <select
                  className="border border-gray-300 rounded-md px-3 py-2"
                  value={settings.language}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      language: e.target.value,
                    }))
                  }
                >
                  <option value="en">English</option>
                  <option value="hi">Hindi</option>
                  <option value="te">Telugu</option>
                  <option value="ta">Tamil</option>
                </select>
              </div>
            </div>
          </div>

          {/* Security Section */}
          <div className="bg-white shadow-md rounded-md mb-5">
            <div className="p-4 border-b-[1px] border-[rgba(0,0,0,0.2)]">
              <h4 className="text-[20px] font-[500] text-gray-700">
                Security
              </h4>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h5 className="text-[16px] font-[500] text-gray-700">
                    Two-Factor Authentication
                  </h5>
                  <p className="text-[14px] text-gray-500">
                    Add an extra layer of security to your account
                  </p>
                </div>
                <Switch
                  checked={settings.twoFactorAuth}
                  onChange={() => handleToggle("twoFactorAuth")}
                  color="warning"
                />
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end">
            <Button className="btn-g px-8">Save Changes</Button>
          </div>
        </div>
      </div>
    </section>
  );
};
export default Settings;
