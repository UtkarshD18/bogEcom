"use client";

import { useAdmin } from "@/context/AdminContext";
import {
  fetchCrmWhatsappConfig,
  generateCrmWhatsappVerifyToken,
  saveCrmWhatsappConfig,
} from "@/services/crmApi";
import { Alert, Button, CircularProgress, TextField } from "@mui/material";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";

const EMPTY_FORM = {
  accessToken: "",
  displayPhoneNumber: "919828204443",
  phoneNumberId: "",
  businessAccountId: "",
  graphApiVersion: "v25.0",
  webhookVerifyToken: "",
  appSecret: "",
};

const WHATSAPP_BUSINESS_ACCOUNT_LABEL = "WhatsApp Business Account ID (WABA ID)";
const WHATSAPP_PHONE_LABEL = "WhatsApp Phone Number";
const WHATSAPP_PHONE_PATTERN = /^\+?[0-9][0-9\s-]{7,19}$/;

const isValidWhatsappPhoneNumber = (value) => {
  const trimmed = String(value || "").trim();
  if (!trimmed || !WHATSAPP_PHONE_PATTERN.test(trimmed)) {
    return false;
  }

  const digits = trimmed.replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 15;
};

const formatDateTime = (value) => {
  if (!value) return "Not saved yet";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Not saved yet";

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
};

const toneClassByState = (state = "unknown") => {
  if (state === "ready")
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (state === "sender_warning")
    return "border-amber-200 bg-amber-50 text-amber-800";
  if (state === "health_check_timeout")
    return "border-sky-200 bg-sky-50 text-sky-800";
  return "border-rose-200 bg-rose-50 text-rose-800";
};

const sourceBadgeClass = (value = "missing") => {
  if (value === "database") return "bg-emerald-100 text-emerald-700";
  if (value === "environment") return "bg-amber-100 text-amber-700";
  if (value === "loading") return "bg-sky-100 text-sky-700";
  if (value === "unavailable") return "bg-slate-200 text-slate-700";
  return "bg-slate-100 text-slate-600";
};

const prettifyKey = (value = "") =>
  String(value || "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

const formatMetaErrorCode = (providerCode, providerSubcode) => {
  const code = Number.isFinite(Number(providerCode))
    ? String(providerCode)
    : "";
  const subcode = Number.isFinite(Number(providerSubcode))
    ? String(providerSubcode)
    : "";

  if (code && subcode) return `${code} / ${subcode}`;
  if (code) return code;
  return "";
};

const buildStatusBadge = (label, value) => {
  const normalizedValue = String(value || "").trim();
  if (!normalizedValue) return null;

  return {
    label,
    value: prettifyKey(normalizedValue),
  };
};

const getStoredFormValues = (config = {}) => {
  const stored = config?.stored || {};

  return {
    accessToken: stored.accessToken || "",
    displayPhoneNumber:
      stored.displayPhoneNumber ||
      config?.effective?.displayPhoneNumber ||
      EMPTY_FORM.displayPhoneNumber,
    phoneNumberId: stored.phoneNumberId || "",
    businessAccountId: stored.businessAccountId || "",
    graphApiVersion: stored.graphApiVersion || "v25.0",
    webhookVerifyToken: stored.webhookVerifyToken || "",
    appSecret: stored.appSecret || "",
  };
};

export default function WhatsappConfigPage() {
  const { token, isAuthenticated, loading } = useAdmin();
  const router = useRouter();

  const [form, setForm] = useState(EMPTY_FORM);
  const [configMeta, setConfigMeta] = useState(null);
  const [summary, setSummary] = useState(null);
  const [health, setHealth] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isGeneratingToken, setIsGeneratingToken] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [loadTimeout, setLoadTimeout] = useState(false);
  const displayPhoneNumberInvalid =
    String(form.displayPhoneNumber || "").trim().length > 0 &&
    !isValidWhatsappPhoneNumber(form.displayPhoneNumber);

  const sourceEntries = useMemo(() => {
    if (isLoading && !configMeta) {
      return [
        { label: "Access Token", value: "loading" },
        { label: WHATSAPP_PHONE_LABEL, value: "loading" },
        { label: "Phone Number ID", value: "loading" },
        { label: WHATSAPP_BUSINESS_ACCOUNT_LABEL, value: "loading" },
        { label: "Webhook Verify Token", value: "loading" },
        { label: "App Secret", value: "loading" },
      ];
    }

    if (loadError && !configMeta) {
      return [
        { label: "Access Token", value: "unavailable" },
        { label: WHATSAPP_PHONE_LABEL, value: "unavailable" },
        { label: "Phone Number ID", value: "unavailable" },
        { label: WHATSAPP_BUSINESS_ACCOUNT_LABEL, value: "unavailable" },
        { label: "Webhook Verify Token", value: "unavailable" },
        { label: "App Secret", value: "unavailable" },
      ];
    }

    const sources = configMeta?.sources || {};

    return [
      { label: "Access Token", value: sources.accessToken || "missing" },
      {
        label: WHATSAPP_PHONE_LABEL,
        value: sources.displayPhoneNumber || "default",
      },
      { label: "Phone Number ID", value: sources.phoneNumberId || "missing" },
      {
        label: WHATSAPP_BUSINESS_ACCOUNT_LABEL,
        value: sources.businessAccountId || "missing",
      },
      {
        label: "Webhook Verify Token",
        value: sources.webhookVerifyToken || "missing",
      },
      { label: "App Secret", value: sources.appSecret || "missing" },
    ];
  }, [configMeta, isLoading, loadError]);

  const accessTokenSource = configMeta?.sources?.accessToken || "missing";
  const hasEnvironmentAccessToken = Boolean(
    configMeta?.environmentAvailable?.accessToken,
  );
  const healthAccessTokenSource = health?.accessTokenSource || accessTokenSource;
  const metaErrorCode = formatMetaErrorCode(
    health?.providerCode,
    health?.providerSubcode,
  );
  const senderHealthBadges = [
    buildStatusBadge("Verified Name", health?.verifiedName),
    buildStatusBadge("Name Status", health?.nameStatus),
    buildStatusBadge("Code Verification", health?.codeVerificationStatus),
    buildStatusBadge("Quality Rating", health?.qualityRating),
    buildStatusBadge("Sender Status", health?.senderStatus),
    buildStatusBadge("Throughput", health?.throughputLevel),
  ].filter(Boolean);
  const shouldOfferEnvFallback =
    hasEnvironmentAccessToken &&
    accessTokenSource === "database" &&
    health?.state === "token_expired";
  const tokenGuidance = useMemo(() => {
    if (accessTokenSource === "database" && health?.state === "token_expired") {
      return hasEnvironmentAccessToken
        ? "The saved admin token is the active token and Meta is rejecting it as expired. Replace it with a fresh permanent system-user token, or intentionally clear it only if you want to switch to the deployed environment token."
        : "The saved admin token is the active token and Meta is rejecting it as expired. Replace it with a fresh permanent system-user token.";
    }

    if (health?.state === "token_expired") {
      return "Meta is rejecting the active token as expired. If this token was entered from admin, replace it with a fresh permanent system-user token tied to the same app, business account, and phone number.";
    }

    if (health?.state === "invalid_token") {
      return "Meta is rejecting the active token as invalid. This usually means wrong app/business linkage, revoked token, or a token copied incompletely.";
    }

    if (health?.state === "permission_denied") {
      return "The token is present, but Meta denied access to this WhatsApp asset. Recheck system-user permissions, app assignment, and business asset access.";
    }

    return "";
  }, [accessTokenSource, hasEnvironmentAccessToken, health]);
  const accessTokenHelperText =
    accessTokenSource === "environment"
      ? "Stored override is blank. Backend is currently using the deployed environment token because no admin access token is saved."
      : hasEnvironmentAccessToken
        ? "Admin-saved token overrides env token. Use a permanent system-user token here, or clear and save only if you intentionally want to fall back to the deployed environment token."
        : "Admin-saved token overrides env token. Use a permanent system-user token here.";
  const businessAccountIdHelperText =
    "Use the WhatsApp Account ID / WABA ID from Meta. Do not paste the Meta App ID here. This field is used for template sync, not webhook verification.";
  const displayPhoneNumberHelperText =
    "Use the customer-facing WhatsApp number here, for example 919828204443 or +91 9828204443. Keep this separate from Phone Number ID.";

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, loading, router]);

  useEffect(() => {
    if (!isAuthenticated) return;

    if (!token) {
      setIsLoading(false);
      setLoadTimeout(false);
      setLoadError("Admin session missing. Please sign in again.");
      return;
    }

    const loadConfig = async () => {
      setIsLoading(true);
      setLoadError("");
      setLoadTimeout(false);

      // Set a 10 second timeout to prevent indefinite loading
      let timeoutId = setTimeout(() => {
        setLoadTimeout(true);
        setIsLoading(false);
      }, 10000);

      try {
        const response = await fetchCrmWhatsappConfig(token);
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }

        if (!response?.success) {
          throw new Error(
            response?.message || "Failed to load WhatsApp runtime config.",
          );
        }

        const nextConfig = response.data?.config || {};
        setForm(getStoredFormValues(nextConfig));
        setConfigMeta(nextConfig);
        setSummary(response.data?.summary || null);
        setHealth(response.data?.health || null);
      } catch (error) {
        const nextMessage =
          error?.message || "Failed to load WhatsApp runtime config.";
        setLoadError(nextMessage);
        toast.error(nextMessage);
      } finally {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        setIsLoading(false);
      }
    };

    loadConfig();
  }, [isAuthenticated, token]);

  const persistConfig = async (
    nextForm,
    successMessage = "WhatsApp runtime configuration updated.",
  ) => {
    if (!token) {
      toast.error("Admin session missing");
      return false;
    }

    setIsSaving(true);
    try {
      const response = await saveCrmWhatsappConfig(nextForm, token);
      if (!response?.success) {
        throw new Error(
          response?.message || "Failed to save WhatsApp runtime config.",
        );
      }

      const nextConfig = response.data?.config || {};
      setForm(getStoredFormValues(nextConfig));
      setConfigMeta(nextConfig);
      setSummary(response.data?.summary || null);
      setHealth(response.data?.health || null);
      toast.success(response?.message || successMessage);
      return true;
    } catch (error) {
      toast.error(error?.message || "Failed to save WhatsApp config.");
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopyToClipboard = async (value, successMessage) => {
    const normalizedValue = String(value || "").trim();
    if (!normalizedValue) {
      toast.error("Nothing to copy yet.");
      return;
    }

    try {
      await navigator.clipboard.writeText(normalizedValue);
      toast.success(successMessage);
    } catch {
      toast.error("Unable to copy right now.");
    }
  };

  const handleSave = async () => {
    if (displayPhoneNumberInvalid) {
      toast.error(
        "WhatsApp phone number must be a valid number with country code.",
      );
      return;
    }

    await persistConfig(form);
  };

  const handleGenerateVerifyToken = async () => {
    if (!token) {
      toast.error("Admin session missing");
      return;
    }

    setIsGeneratingToken(true);
    try {
      const response = await generateCrmWhatsappVerifyToken(token);
      if (!response?.success) {
        throw new Error(
          response?.message || "Failed to generate WhatsApp verify token.",
        );
      }

      const nextConfig = response.data?.config || {};
      const generatedToken =
        response.data?.generatedToken || nextConfig?.stored?.webhookVerifyToken;

      setForm(getStoredFormValues(nextConfig));
      setConfigMeta(nextConfig);
      setSummary(response.data?.summary || null);
      setHealth(response.data?.health || null);

      toast.success(
        response?.message ||
          "WhatsApp webhook verify token generated successfully.",
      );

      if (generatedToken) {
        await handleCopyToClipboard(
          generatedToken,
          "New verify token copied to clipboard.",
        );
      }
    } catch (error) {
      toast.error(error?.message || "Failed to generate verify token.");
    } finally {
      setIsGeneratingToken(false);
    }
  };

  const handleUseEnvironmentToken = async () => {
    const nextForm = {
      ...form,
      accessToken: "",
    };

    const saved = await persistConfig(
      nextForm,
      "Saved access token cleared. Backend will now use the deployed environment token when available.",
    );

    if (saved) {
      setForm(nextForm);
    }
  };

  if (loading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <CircularProgress />
      </div>
    );
  }

  return (
    <section className="p-4 md:p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="rounded-3xl bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-teal-700">
                CRM Child Page
              </p>
              <h1 className="mt-2 text-3xl font-semibold text-slate-900">
                WhatsApp Runtime Config
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                Update Cloud API credentials and webhook verification values
                from admin. Saved values override environment variables and are
                picked up live by the deployed backend within a few seconds.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              Last saved: {formatDateTime(configMeta?.updatedAt)}
            </div>
          </div>
        </div>

        {loadError ? (
          <Alert severity="error" className="rounded-3xl">
            {loadError}
          </Alert>
        ) : null}

        {health ? (
          <div
            className={`rounded-3xl border px-5 py-4 text-sm ${toneClassByState(
              health.state,
            )}`}
          >
            <p className="font-semibold">
              {prettifyKey(health.state || "needs_check")}
            </p>
            <p className="mt-1">
              {health.message || "Health check unavailable."}
            </p>
            {tokenGuidance ? (
              <p className="mt-3 text-xs font-medium leading-5">
                What to do: {tokenGuidance}
              </p>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-white/70 px-3 py-1 font-semibold">
                Active token source: {prettifyKey(healthAccessTokenSource)}
              </span>
              {metaErrorCode ? (
                <span className="rounded-full bg-white/70 px-3 py-1 font-semibold">
                  Meta error: {metaErrorCode}
                </span>
              ) : null}
            </div>
            {senderHealthBadges.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                {senderHealthBadges.map((badge) => (
                  <span
                    key={`${badge.label}-${badge.value}`}
                    className="rounded-full bg-white/70 px-3 py-1 font-semibold"
                  >
                    {badge.label}: {badge.value}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="rounded-3xl bg-white p-6 shadow-sm">
            {isLoading && !loadTimeout ? (
              <div className="flex justify-center py-16">
                <CircularProgress />
              </div>
            ) : loadTimeout ? (
              <Alert severity="warning" className="mb-4">
                The configuration is taking longer than expected to load. Please
                try refreshing the page.
              </Alert>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                <TextField
                  label={WHATSAPP_PHONE_LABEL}
                  value={form.displayPhoneNumber}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      displayPhoneNumber: event.target.value,
                    }))
                  }
                  size="small"
                  fullWidth
                  error={displayPhoneNumberInvalid}
                  helperText={
                    displayPhoneNumberInvalid
                      ? "Enter a valid WhatsApp number like 919828204443 or +91 9828204443."
                      : displayPhoneNumberHelperText
                  }
                />
                <TextField
                  label="Phone Number ID"
                  value={form.phoneNumberId}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      phoneNumberId: event.target.value,
                    }))
                  }
                  size="small"
                  fullWidth
                />
                <TextField
                  label={WHATSAPP_BUSINESS_ACCOUNT_LABEL}
                  value={form.businessAccountId}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      businessAccountId: event.target.value,
                    }))
                  }
                  size="small"
                  fullWidth
                  helperText={businessAccountIdHelperText}
                />
                <TextField
                  label="Graph API Version"
                  value={form.graphApiVersion}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      graphApiVersion: event.target.value,
                    }))
                  }
                  size="small"
                  fullWidth
                />
                <div className="hidden md:block" />
                <TextField
                  label="Access Token"
                  type="password"
                  value={form.accessToken}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      accessToken: event.target.value,
                    }))
                  }
                  size="small"
                  fullWidth
                  multiline
                  minRows={4}
                  className="md:col-span-2"
                  helperText={accessTokenHelperText}
                />
                <TextField
                  label="Webhook Verify Token"
                  type="password"
                  value={form.webhookVerifyToken}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      webhookVerifyToken: event.target.value,
                    }))
                  }
                  size="small"
                  fullWidth
                  helperText="Generate a fresh token here, then paste the exact same value into Meta before clicking Verify and save there."
                />
                <TextField
                  label="App Secret"
                  type="password"
                  value={form.appSecret}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      appSecret: event.target.value,
                    }))
                  }
                  size="small"
                  fullWidth
                />
                <div className="md:col-span-2 flex flex-wrap items-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3">
                  <Button
                    variant="outlined"
                    onClick={handleGenerateVerifyToken}
                    disabled={isLoading || isSaving || isGeneratingToken}
                    sx={{
                      textTransform: "none",
                      borderRadius: "14px",
                      px: 3,
                      py: 1,
                    }}
                  >
                    {isGeneratingToken
                      ? "Generating..."
                      : "Generate New Verify Token"}
                  </Button>
                  <Button
                    variant="text"
                    onClick={() =>
                      handleCopyToClipboard(
                        form.webhookVerifyToken,
                        "Verify token copied to clipboard.",
                      )
                    }
                    disabled={
                      isLoading ||
                      isSaving ||
                      isGeneratingToken ||
                      !String(form.webhookVerifyToken || "").trim()
                    }
                    sx={{
                      textTransform: "none",
                      borderRadius: "14px",
                      px: 2,
                      py: 1,
                    }}
                  >
                    Copy Verify Token
                  </Button>
                  <p className="text-xs leading-5 text-slate-500">
                    Generating will save the new webhook verify token to the
                    backend immediately and replace the previous admin-saved
                    value.
                  </p>
                </div>
              </div>
            )}

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-slate-500">
                Leave a field blank only if you want the backend to fall back to
                the deployed environment value for that field.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                {shouldOfferEnvFallback ? (
                  <Button
                    variant="outlined"
                    color="warning"
                    onClick={handleUseEnvironmentToken}
                    disabled={isLoading || isSaving}
                    sx={{
                      textTransform: "none",
                      borderRadius: "14px",
                      px: 3,
                      py: 1,
                    }}
                  >
                    Use Deployed Env Token
                  </Button>
                ) : null}
                <Button
                  variant="contained"
                  onClick={handleSave}
                  disabled={isLoading || isSaving || isGeneratingToken}
                  sx={{
                    textTransform: "none",
                    borderRadius: "14px",
                    px: 3,
                    py: 1,
                  }}
                >
                  {isSaving ? "Saving..." : "Save Runtime Config"}
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-3xl bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">
                Source Map
              </h2>
              <div className="mt-4 space-y-3">
                {sourceEntries.map((entry) => (
                  <div
                    key={entry.label}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3"
                  >
                    <span className="text-sm text-slate-700">
                      {entry.label}
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${sourceBadgeClass(
                        entry.value,
                      )}`}
                    >
                      {prettifyKey(entry.value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">
                Readiness
              </h2>
              {isLoading ? (
                <div className="mt-4">
                  <Alert severity="info">
                    Loading saved runtime config and live WhatsApp health…
                  </Alert>
                </div>
              ) : loadError && !summary ? (
                <div className="mt-4">
                  <Alert severity="error">{loadError}</Alert>
                </div>
              ) : (
                <div className="mt-4 space-y-3 text-sm text-slate-600">
                  <Alert severity="info">
                    Configured WhatsApp number:{" "}
                    {String(
                      health?.displayPhoneNumber ||
                        configMeta?.effective?.displayPhoneNumber ||
                        form.displayPhoneNumber ||
                        "-",
                    ).trim() || "-"}
                  </Alert>
                  <Alert
                    severity={summary?.messagingReady ? "success" : "warning"}
                  >
                    Messaging send:{" "}
                    {summary?.messagingReady ? "ready" : "needs config"}
                  </Alert>
                  <Alert
                    severity={
                      summary?.templateSyncReady ? "success" : "warning"
                    }
                  >
                    Template sync:{" "}
                    {summary?.templateSyncReady ? "ready" : "needs config"}
                  </Alert>
                  <Alert
                    severity={summary?.webhookReady ? "success" : "warning"}
                  >
                    Webhook verification:{" "}
                    {summary?.webhookReady ? "ready" : "needs config"}
                  </Alert>
                  <p>
                    Missing keys:{" "}
                    {(summary?.missing || []).length > 0
                      ? summary.missing.join(", ")
                      : "None"}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
