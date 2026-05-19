"use client";

import { useAdmin } from "@/context/AdminContext";
import { getData, putData } from "@/utils/api";
import { Button, Switch } from "@mui/material";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "react-hot-toast";

const DEFAULT_PANEL_SETTINGS = {
  enabled: true,
  minimizeEnabled: true,
  minimizedLabel: "Show details",
  restoreAfterSeconds: 60,
};

export default function HomeSlidePanelSettingsPage() {
  const { token, isAuthenticated, loading } = useAdmin();
  const router = useRouter();
  const [settings, setSettings] = useState(DEFAULT_PANEL_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const loadSettings = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const response = await getData("/api/settings/admin/all", token);
      if (response?.success && Array.isArray(response.data)) {
        const found = response.data.find(
          (item) => item.key === "homeSlidePanelSettings",
        );
        setSettings({
          ...DEFAULT_PANEL_SETTINGS,
          ...(found?.value && typeof found.value === "object" ? found.value : {}),
        });
      }
    } catch (error) {
      toast.error(error?.message || "Failed to load panel settings");
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, loading, router]);

  useEffect(() => {
    if (isAuthenticated && token) {
      loadSettings();
    }
  }, [isAuthenticated, loadSettings, token]);

  const saveSettings = async (event) => {
    event.preventDefault();
    setIsSaving(true);
    try {
      const payload = {
        ...settings,
        minimizedLabel:
          String(settings.minimizedLabel || "").trim() ||
          DEFAULT_PANEL_SETTINGS.minimizedLabel,
        restoreAfterSeconds: Math.max(
          Number(settings.restoreAfterSeconds || 60),
          5,
        ),
      };
      const response = await putData(
        "/api/settings/admin/homeSlidePanelSettings",
        { value: payload, isActive: true },
        token,
      );
      if (!response?.success) {
        throw new Error(response?.message || "Failed to save panel settings");
      }
      setSettings(payload);
      toast.success("Home slide panel settings saved");
      router.push("/home-slides");
    } catch (error) {
      toast.error(error?.message || "Failed to save panel settings");
    } finally {
      setIsSaving(false);
    }
  };

  if (loading || !isAuthenticated || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <section className="w-full py-3 px-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-[18px] text-gray-700 font-[600]">
            Home Slide Detail Panel
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Controls the glass detail box shown over homepage slides.
          </p>
        </div>
        <Link href="/home-slides">
          <Button className="!border !border-gray-300 !text-gray-700">
            Back
          </Button>
        </Link>
      </div>

      <form
        onSubmit={saveSettings}
        className="rounded-md bg-white p-5 shadow-md"
      >
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <label className="flex items-center justify-between rounded-xl border border-gray-200 p-4">
            <span>
              <span className="block text-sm font-semibold text-gray-900">
                Show detail panel
              </span>
              <span className="text-xs text-gray-500">
                Hide this only when slides should be full image first.
              </span>
            </span>
            <Switch
              checked={settings.enabled}
              onChange={(event) =>
                setSettings((prev) => ({
                  ...prev,
                  enabled: event.target.checked,
                }))
              }
            />
          </label>

          <label className="flex items-center justify-between rounded-xl border border-gray-200 p-4">
            <span>
              <span className="block text-sm font-semibold text-gray-900">
                Allow minimize button
              </span>
              <span className="text-xs text-gray-500">
                Lets customers clear the slide view temporarily.
              </span>
            </span>
            <Switch
              checked={settings.minimizeEnabled}
              onChange={(event) =>
                setSettings((prev) => ({
                  ...prev,
                  minimizeEnabled: event.target.checked,
                }))
              }
            />
          </label>

          <div className="form-group flex flex-col gap-1">
            <span className="text-[15px] text-gray-800 font-medium">
              Minimized Button Label
            </span>
            <input
              type="text"
              value={settings.minimizedLabel}
              onChange={(event) =>
                setSettings((prev) => ({
                  ...prev,
                  minimizedLabel: event.target.value,
                }))
              }
              className="h-[40px] rounded-md border border-[rgba(0,0,0,0.2)] px-3 text-[14px] outline-none focus:border-blue-500"
            />
          </div>

          <div className="form-group flex flex-col gap-1">
            <span className="text-[15px] text-gray-800 font-medium">
              Auto Restore After (seconds)
            </span>
            <input
              type="number"
              min="5"
              max="600"
              value={settings.restoreAfterSeconds}
              onChange={(event) =>
                setSettings((prev) => ({
                  ...prev,
                  restoreAfterSeconds: event.target.value,
                }))
              }
              className="h-[40px] rounded-md border border-[rgba(0,0,0,0.2)] px-3 text-[14px] outline-none focus:border-blue-500"
            />
          </div>
        </div>

        <div className="mt-8 flex gap-3">
          <Button
            type="submit"
            disabled={isSaving}
            className="!bg-blue-600 !text-white !px-8 !py-2.5 hover:!bg-blue-700 disabled:!opacity-50"
          >
            {isSaving ? "Saving..." : "Save Settings"}
          </Button>
          <Button
            type="button"
            onClick={() => router.push("/home-slides")}
            className="!border !border-gray-300 !text-gray-700 !px-8 !py-2.5"
          >
            Cancel
          </Button>
        </div>
      </form>
    </section>
  );
}
