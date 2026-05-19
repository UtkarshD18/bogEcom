"use client";

import { useAdmin } from "@/context/AdminContext";
import { API_BASE_URL, deleteData, getData, patchData, postData } from "@/utils/api";
import {
  Alert,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  MenuItem,
  Select,
  TextField,
  Tooltip as MuiTooltip,
} from "@mui/material";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  FiActivity,
  FiCopy,
  FiInfo,
  FiKey,
  FiPauseCircle,
  FiPlayCircle,
  FiRefreshCw,
  FiRotateCcw,
  FiTrash,
  FiUserPlus,
} from "react-icons/fi";

const SECTION_TABS = [
  { id: "overview", title: "Overview Dashboard" },
  { id: "analytics", title: "Usage Analytics" },
  { id: "partners", title: "Partners List" },
  { id: "create", title: "Create Partner" },
  { id: "docs", title: "API Docs" },
  { id: "logs", title: "Logs & Monitoring" },
];

const SCOPE_OPTIONS = [
  { value: "catalog.read", label: "Catalog" },
  { value: "inventory.read", label: "Inventory" },
  { value: "pricing.read", label: "Pricing" },
  { value: "gst.read", label: "GST" },
  { value: "combos.read", label: "Combos" },
];

const VISIBLE_FIELD_OPTIONS = [
  "description",
  "shortDescription",
  "images",
  "category",
  "tags",
  "discount",
  "stock",
  "shipping",
  "hsnCode",
  "gstBreakup",
];

const normalizeDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("en-IN", { hour12: true });
};

const toIsoOrEmpty = (value) => {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
};

const statusColor = (status) => {
  if (status === "active") return "success";
  if (status === "paused") return "warning";
  if (status === "revoked") return "error";
  return "default";
};

const labelFromScope = (scope) =>
  SCOPE_OPTIONS.find((item) => item.value === scope)?.label || scope;

const InfoIcon = ({ title }) => (
  <MuiTooltip title={title} placement="top">
    <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 text-[10px] text-slate-500">
      <FiInfo />
    </span>
  </MuiTooltip>
);

const InfoButton = ({ tooltip, children, ...props }) => (
  <Button {...props}>
    <span className="inline-flex items-center gap-1.5">
      {children}
      <InfoIcon title={tooltip} />
    </span>
  </Button>
);

const CompactBarGraph = ({ title, rows }) => {
  const safeRows = Array.isArray(rows) ? rows : [];
  const max = safeRows.reduce((m, item) => Math.max(m, Number(item.requests || 0)), 0) || 1;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-sm font-semibold text-slate-800 mb-3">{title}</p>
      {safeRows.length === 0 ? (
        <p className="text-xs text-slate-500">No usage data yet.</p>
      ) : (
        <div className="space-y-2">
          {safeRows.map((row) => {
            const width = Math.max(6, Math.round((Number(row.requests || 0) / max) * 100));
            return (
              <div key={`${title}-${row.label}`}>
                <div className="flex items-center justify-between text-[11px] text-slate-600 mb-1">
                  <span>{row.label}</span>
                  <span>
                    {row.requests} req / {row.errors || 0} errors
                  </span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full rounded-full bg-amber-500" style={{ width: `${width}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const PartnerApiPage = () => {
  const { token, isAuthenticated, loading } = useAdmin();
  const router = useRouter();

  const [section, setSection] = useState("overview");

  const [isBusy, setIsBusy] = useState(false);
  const [partners, setPartners] = useState([]);
  const [overview, setOverview] = useState(null);
  const [live, setLive] = useState({ activeApiKeys: [], lastHits: [], recentErrors: [] });
  const [logs, setLogs] = useState([]);
  const [logPagination, setLogPagination] = useState(null);
  const [logFilters, setLogFilters] = useState({ partnerId: "", endpoint: "", statusCode: "", page: 1 });
  const [analytics, setAnalytics] = useState({
    summary: null,
    partnerStats: [],
    charts: { requestsOverTime: [], topEndpoints: [] },
    alerts: [],
    filters: { partners: [], applied: { range: "24h", partnerId: "" } },
  });
  const [analyticsFilters, setAnalyticsFilters] = useState({
    partnerId: "",
    range: "24h",
    startDate: "",
    endDate: "",
  });
  const [analyticsSettings, setAnalyticsSettings] = useState({
    errorRateThreshold: 5,
    trafficSpikeMultiplier: 2.5,
    trafficSpikeMinRequests: 50,
  });

  const [issuedKeyInfo, setIssuedKeyInfo] = useState({
    partnerId: "",
    key: "",
    partnerName: "",
    companyName: "",
    contactEmail: "",
  });
  const [detailPartnerId, setDetailPartnerId] = useState("");
  const [partnerDetail, setPartnerDetail] = useState(null);
  const [selectedPartnerIds, setSelectedPartnerIds] = useState([]);

  const [permissionEditor, setPermissionEditor] = useState({ open: false, partnerId: "", scopes: [] });
  const [dynamicEditor, setDynamicEditor] = useState({
    open: false,
    partnerId: "",
    baseRPM: "",
    burstRPM: "",
    dailyLimit: "",
    dailyTokenLimit: "",
    lockScaling: false,
    scalingEnabled: true,
    safeModeForced: false,
    manualOverrideRPM: "",
    manualOverrideDailyLimit: "",
    qualityScore: 1,
  });

  const [form, setForm] = useState({
    partnerName: "",
    companyName: "",
    email: "",
    scopes: ["catalog.read", "inventory.read", "pricing.read", "gst.read"],
    rateLimitPerMinute: 120,
    dailyRequestLimit: 20000,
    dailyTokenLimit: 0,
    visibleProductFields: ["description", "shortDescription", "images", "category", "tags", "discount", "stock", "shipping", "hsnCode", "gstBreakup"],
    notes: "",
  });

  const partnerApiBase = useMemo(() => {
    const base = String(API_BASE_URL || "").replace(/\/+$/, "");
    return /\/api$/i.test(base) ? `${base}/v1/partner` : `${base}/api/v1/partner`;
  }, []);

  const docsSamples = useMemo(
    () => ({
      curl: `curl -X GET "${partnerApiBase}/products?limit=20" -H "x-api-key: YOUR_API_KEY"`,
      js: `const res = await fetch("${partnerApiBase}/inventory", {\n  headers: { "x-api-key": process.env.PARTNER_API_KEY }\n});\nconst data = await res.json();`,
      python: `import requests\nres = requests.get("${partnerApiBase}/pricing", headers={"x-api-key": "YOUR_API_KEY"})\nprint(res.json())`,
    }),
    [partnerApiBase],
  );

  const selectedPartners = useMemo(() => {
    const selectedSet = new Set((selectedPartnerIds || []).map((id) => String(id)));
    return (partners || []).filter((partner) => selectedSet.has(String(partner.id)));
  }, [partners, selectedPartnerIds]);

  const partnerSimulatorUrl = `${partnerApiBase}/dashboard`;

  const copyValue = async (value, label) => {
    try {
      await navigator.clipboard.writeText(String(value || ""));
      toast.success(`${label} copied`);
    } catch {
      toast.error(`Unable to copy ${label}`);
    }
  };

  const downloadCredentialPdf = async ({ partnerId, apiKey }) => {
    if (!token || !partnerId || !apiKey) {
      toast.error("Partner ID and API key are required to generate credential PDF");
      return;
    }

    try {
      const response = await fetch(`${partnerApiBase}/admin/partners/${partnerId}/credential-pdf`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ apiKey }),
      });

      if (!response.ok) {
        let message = "Failed to generate credential PDF";
        try {
          const payload = await response.json();
          message = payload?.error?.message || payload?.message || message;
        } catch {
        }
        toast.error(message);
        return;
      }

      const blob = await response.blob();
      const contentDisposition = response.headers.get("content-disposition") || "";
      const match = contentDisposition.match(/filename=\"?([^\";]+)\"?/i);
      const fileName = match?.[1] || `healthyonegram-partner-credentials-${Date.now()}.pdf`;
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      link.rel = "noopener";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success("Credential PDF downloaded");
    } catch {
      toast.error("Failed to download credential PDF");
    }
  };

  const downloadAnalyticsCsv = async () => {
    if (!token) return;

    const params = new URLSearchParams();
    if (analyticsFilters.partnerId) params.append("partnerId", analyticsFilters.partnerId);
    params.append("range", analyticsFilters.range || "24h");
    params.append("format", "csv");
    params.append("errorRateThreshold", String(analyticsSettings.errorRateThreshold));
    params.append("trafficSpikeMultiplier", String(analyticsSettings.trafficSpikeMultiplier));
    params.append("trafficSpikeMinRequests", String(analyticsSettings.trafficSpikeMinRequests));

    if (analyticsFilters.range === "custom") {
      const startIso = toIsoOrEmpty(analyticsFilters.startDate);
      const endIso = toIsoOrEmpty(analyticsFilters.endDate);
      if (startIso) params.append("startDate", startIso);
      if (endIso) params.append("endDate", endIso);
    }

    const response = await getData(`/api/v1/partner/admin/analytics?${params.toString()}`, token);
    if (typeof response !== "string") {
      toast.error(response?.message || "Failed to export analytics CSV");
      return;
    }

    const blob = new Blob([response], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `partner-analytics-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
    toast.success("Analytics CSV exported");
  };

  const loadPartners = useCallback(async () => {
    if (!token) return;
    const response = await getData("/api/v1/partner/admin/partners", token);
    if (response?.success) {
      setPartners(Array.isArray(response.data) ? response.data : []);
    }
  }, [token]);

  const loadOverview = useCallback(async () => {
    if (!token) return;
    const response = await getData("/api/v1/partner/admin/overview", token);
    if (response?.success) {
      setOverview(response.data || null);
    }
  }, [token]);

  const loadLive = useCallback(async () => {
    if (!token) return;
    const response = await getData("/api/v1/partner/admin/monitoring/live?limit=40", token);
    if (response?.success) {
      setLive(response.data || { activeApiKeys: [], lastHits: [], recentErrors: [] });
    }
  }, [token]);

  const loadLogs = useCallback(async () => {
    if (!token) return;
    const params = new URLSearchParams();
    if (logFilters.partnerId) params.append("partnerId", logFilters.partnerId);
    if (logFilters.endpoint) params.append("endpoint", logFilters.endpoint);
    if (logFilters.statusCode) params.append("statusCode", logFilters.statusCode);
    params.append("page", String(logFilters.page || 1));
    params.append("limit", "50");

    const response = await getData(`/api/v1/partner/admin/logs?${params.toString()}`, token);
    if (response?.success) {
      setLogs(Array.isArray(response.data) ? response.data : []);
      setLogPagination(response.pagination || null);
    }
  }, [token, logFilters]);

  const loadAnalytics = useCallback(async () => {
    if (!token) return;

    const params = new URLSearchParams();
    if (analyticsFilters.partnerId) params.append("partnerId", analyticsFilters.partnerId);
    params.append("range", analyticsFilters.range || "24h");
    params.append("errorRateThreshold", String(analyticsSettings.errorRateThreshold));
    params.append("trafficSpikeMultiplier", String(analyticsSettings.trafficSpikeMultiplier));
    params.append("trafficSpikeMinRequests", String(analyticsSettings.trafficSpikeMinRequests));

    if (analyticsFilters.range === "custom") {
      if (analyticsFilters.startDate) {
        const startIso = toIsoOrEmpty(analyticsFilters.startDate);
        if (startIso) params.append("startDate", startIso);
      }
      if (analyticsFilters.endDate) {
        const endIso = toIsoOrEmpty(analyticsFilters.endDate);
        if (endIso) params.append("endDate", endIso);
      }
    }

    const response = await getData(`/api/v1/partner/admin/analytics?${params.toString()}`, token);
    if (response?.success) {
      const payload = response.data || {};
      setAnalytics({
        summary: payload.summary || null,
        partnerStats: Array.isArray(payload.partnerStats) ? payload.partnerStats : [],
        charts: payload.charts || { requestsOverTime: [], topEndpoints: [] },
        alerts: Array.isArray(payload.alerts) ? payload.alerts : [],
        filters: payload.filters || { partners: [], applied: { range: "24h", partnerId: "" } },
      });
    }
  }, [token, analyticsFilters, analyticsSettings]);

  const loadPartnerDetail = useCallback(
    async (partnerId) => {
      if (!token || !partnerId) return;
      const response = await getData(`/api/v1/partner/admin/partners/${partnerId}`, token);
      if (response?.success) {
        setPartnerDetail(response.data || null);
        setDetailPartnerId(partnerId);
      } else {
        toast.error(response?.message || "Unable to load partner details");
      }
    },
    [token],
  );

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, loading, router]);

  useEffect(() => {
    if (!token || !isAuthenticated) return;
    setIsBusy(true);
    Promise.all([loadPartners(), loadOverview(), loadLive(), loadLogs(), loadAnalytics()]).finally(() => setIsBusy(false));
  }, [token, isAuthenticated, loadPartners, loadOverview, loadLive, loadLogs, loadAnalytics]);

  // Manual refresh only: no automatic polling.

  useEffect(() => {
    const validIds = new Set((partners || []).map((partner) => String(partner.id)));
    setSelectedPartnerIds((prev) => prev.filter((id) => validIds.has(String(id))));
  }, [partners]);

  const submitCreatePartner = async () => {
    if (!form.partnerName.trim() || !form.email.trim()) {
      toast.error("Partner name and email are required");
      return;
    }

    if (!form.scopes.length) {
      toast.error("Select at least one scope");
      return;
    }

    setIsBusy(true);
    const response = await postData(
      "/api/v1/partner/admin/partners",
      {
        name: form.partnerName.trim(),
        companyName: form.companyName.trim(),
        contactEmail: form.email.trim(),
        scopes: form.scopes,
        rateLimitPerMinute: Number(form.rateLimitPerMinute || 120),
        dailyRequestLimit: Number(form.dailyRequestLimit || 20000),
        dailyTokenLimit: Number(form.dailyTokenLimit || 0),
        visibleProductFields: form.visibleProductFields,
        notes: form.notes.trim(),
      },
      token,
    );

    if (response?.success) {
      toast.success("Partner created successfully");
      const createdPartnerId = String(response?.data?.partner?.id || "");
      const createdApiKey = String(response?.data?.apiKey || "");
      setIssuedKeyInfo({
        partnerId: createdPartnerId,
        key: createdApiKey,
        partnerName: String(response?.data?.partner?.name || ""),
        companyName: String(response?.data?.partner?.companyName || ""),
        contactEmail: String(response?.data?.partner?.contactEmail || ""),
      });

      if (createdPartnerId && createdApiKey) {
        await downloadCredentialPdf({
          partnerId: createdPartnerId,
          apiKey: createdApiKey,
        });
      }

      setForm({
        partnerName: "",
        companyName: "",
        email: "",
        scopes: ["catalog.read", "inventory.read", "pricing.read", "gst.read"],
        rateLimitPerMinute: 120,
        dailyRequestLimit: 20000,
        dailyTokenLimit: 0,
        visibleProductFields: ["description", "shortDescription", "images", "category", "tags", "discount", "stock", "shipping", "hsnCode", "gstBreakup"],
        notes: "",
      });
      await Promise.all([loadPartners(), loadOverview()]);
      setSection("partners");
    } else {
      toast.error(response?.message || "Failed to create partner");
    }
    setIsBusy(false);
  };

  const rotatePartnerKey = async (partnerId) => {
    setIsBusy(true);
    const response = await postData(`/api/v1/partner/admin/partners/${partnerId}/rotate-key`, {}, token);
    if (response?.success) {
      const matchedPartner = (partners || []).find((item) => String(item.id) === String(partnerId));
      setIssuedKeyInfo({
        partnerId,
        key: String(response?.data?.apiKey || ""),
        partnerName: String(matchedPartner?.name || ""),
        companyName: String(matchedPartner?.companyName || ""),
        contactEmail: String(matchedPartner?.contactEmail || ""),
      });
      toast.success("API key rotated");
      await Promise.all([loadPartners(), loadOverview(), detailPartnerId === partnerId ? loadPartnerDetail(partnerId) : Promise.resolve()]);
    } else {
      toast.error(response?.message || "Failed to rotate key");
    }
    setIsBusy(false);
  };

  const pauseResumePartner = async (partner) => {
    const nextStatus = partner.status === "active" ? "paused" : "active";
    setIsBusy(true);
    const response = await patchData(`/api/v1/partner/admin/partners/${partner.id}`, { status: nextStatus }, token);
    if (response?.success) {
      toast.success(nextStatus === "paused" ? "Partner paused" : "Partner resumed");
      await Promise.all([loadPartners(), loadOverview(), detailPartnerId === partner.id ? loadPartnerDetail(partner.id) : Promise.resolve()]);
    } else {
      toast.error(response?.message || "Failed to update partner status");
    }
    setIsBusy(false);
  };

  const revokePartner = async (partnerId) => {
    const confirmed = window.confirm("Revoke this partner and disable all active keys permanently?");
    if (!confirmed) return;
    setIsBusy(true);
    const response = await postData(`/api/v1/partner/admin/partners/${partnerId}/revoke`, {}, token);
    if (response?.success) {
      toast.success("Partner revoked");
      await Promise.all([loadPartners(), loadOverview(), detailPartnerId === partnerId ? loadPartnerDetail(partnerId) : Promise.resolve()]);
    } else {
      toast.error(response?.message || "Failed to revoke partner");
    }
    setIsBusy(false);
  };

  const deletePartner = async (partner) => {
    const confirmed = window.confirm(`Delete partner ${partner.name}? This action cannot be undone.`);
    if (!confirmed) return;
    setIsBusy(true);
    const response = await deleteData(`/api/v1/partner/admin/partners/${partner.id}`, token);
    if (response?.success) {
      toast.success("Partner deleted");
      if (detailPartnerId === partner.id) {
        setPartnerDetail(null);
        setDetailPartnerId("");
      }
      await Promise.all([loadPartners(), loadOverview()]);
    } else {
      toast.error(response?.message || "Failed to delete partner");
    }
    setIsBusy(false);
  };

  const togglePartnerSelection = (partnerId) => {
    const id = String(partnerId || "");
    if (!id) return;
    setSelectedPartnerIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const selectAllPartners = () => {
    setSelectedPartnerIds((partners || []).map((partner) => String(partner.id)));
  };

  const deselectAllPartners = () => {
    setSelectedPartnerIds([]);
  };

  const deleteSelectedPartners = async () => {
    if (!selectedPartnerIds.length) {
      toast.error("Select at least one partner to delete");
      return;
    }

    const confirmed = window.confirm(
      `Delete ${selectedPartners.length} selected partner(s)? This action cannot be undone.`,
    );
    if (!confirmed) return;

    setIsBusy(true);
    const results = await Promise.all(
      selectedPartners.map((partner) =>
        deleteData(`/api/v1/partner/admin/partners/${partner.id}`, token).then((response) => ({ partner, response })),
      ),
    );

    const failed = results.filter((item) => !item.response?.success);
    const deletedCount = results.length - failed.length;

    if (detailPartnerId && selectedPartnerIds.includes(String(detailPartnerId))) {
      setPartnerDetail(null);
      setDetailPartnerId("");
    }

    if (deletedCount > 0) {
      toast.success(`Deleted ${deletedCount} partner(s)`);
    }

    if (failed.length > 0) {
      toast.error(`${failed.length} partner(s) failed to delete`);
    }

    setSelectedPartnerIds([]);
    await Promise.all([loadPartners(), loadOverview()]);
    setIsBusy(false);
  };

  const openPermissionEditor = (partner) => {
    setPermissionEditor({
      open: true,
      partnerId: partner.id,
      scopes: Array.isArray(partner.scopes) ? partner.scopes : [],
    });
  };

  const savePermissions = async () => {
    if (!permissionEditor.partnerId || permissionEditor.scopes.length === 0) {
      toast.error("Select at least one scope");
      return;
    }

    setIsBusy(true);
    const response = await patchData(
      `/api/v1/partner/admin/partners/${permissionEditor.partnerId}`,
      { scopes: permissionEditor.scopes },
      token,
    );

    if (response?.success) {
      toast.success("Permissions updated");
      setPermissionEditor({ open: false, partnerId: "", scopes: [] });
      await Promise.all([
        loadPartners(),
        detailPartnerId === permissionEditor.partnerId ? loadPartnerDetail(permissionEditor.partnerId) : Promise.resolve(),
      ]);
    } else {
      toast.error(response?.message || "Failed to update permissions");
    }

    setIsBusy(false);
  };

  const openDynamicEditor = (partner) => {
    const dynamic = partner?.dynamic || {};
    setDynamicEditor({
      open: true,
      partnerId: partner.id,
      baseRPM: dynamic?.plan?.baseRPM ? String(dynamic.plan.baseRPM) : String(partner?.rateLimitPerMinute || ""),
      burstRPM: dynamic?.plan?.burstRPM ? String(dynamic.plan.burstRPM) : "",
      dailyLimit: dynamic?.plan?.dailyLimit
        ? String(dynamic.plan.dailyLimit)
        : String(partner?.dailyRequestLimit || ""),
      dailyTokenLimit:
        partner?.dailyTokenLimit !== undefined && partner?.dailyTokenLimit !== null
          ? String(partner.dailyTokenLimit)
          : "0",
      lockScaling: Boolean(dynamic?.controls?.lockScaling),
      scalingEnabled: dynamic?.plan?.scalingEnabled !== false,
      safeModeForced: Boolean(dynamic?.controls?.safeModeForced),
      manualOverrideRPM: dynamic?.controls?.manualOverrideRPM ? String(dynamic.controls.manualOverrideRPM) : "",
      manualOverrideDailyLimit: dynamic?.controls?.manualOverrideDailyLimit
        ? String(dynamic.controls.manualOverrideDailyLimit)
        : "",
      qualityScore: Number(dynamic?.plan?.qualityScore || 1),
    });
  };

  const saveDynamicSettings = async () => {
    if (!dynamicEditor.partnerId) {
      toast.error("Partner selection missing");
      return;
    }

    setIsBusy(true);
    const dynamicResponse = await patchData(
      `/api/v1/partner/admin/partners/${dynamicEditor.partnerId}/dynamic`,
      {
        baseRPM: Number(dynamicEditor.baseRPM || 0),
        burstRPM: Number(dynamicEditor.burstRPM || 0),
        dailyLimit: Number(dynamicEditor.dailyLimit || 0),
        lockScaling: dynamicEditor.lockScaling,
        scalingEnabled: dynamicEditor.scalingEnabled,
        safeModeForced: dynamicEditor.safeModeForced,
        manualOverrideRPM: Number(dynamicEditor.manualOverrideRPM || 0),
        manualOverrideDailyLimit: Number(dynamicEditor.manualOverrideDailyLimit || 0),
        qualityScore: Number(dynamicEditor.qualityScore || 1),
      },
      token,
    );

    const limitsResponse = await patchData(
      `/api/v1/partner/admin/partners/${dynamicEditor.partnerId}`,
      {
        rateLimitPerMinute: Number(dynamicEditor.baseRPM || 0),
        dailyRequestLimit: Number(dynamicEditor.dailyLimit || 0),
        dailyTokenLimit: Number(dynamicEditor.dailyTokenLimit || 0),
      },
      token,
    );

    if (dynamicResponse?.success && limitsResponse?.success) {
      toast.success("Dynamic limiter settings updated");
      setDynamicEditor({
        open: false,
        partnerId: "",
        baseRPM: "",
        burstRPM: "",
        dailyLimit: "",
        dailyTokenLimit: "",
        lockScaling: false,
        scalingEnabled: true,
        safeModeForced: false,
        manualOverrideRPM: "",
        manualOverrideDailyLimit: "",
        qualityScore: 1,
      });
      await Promise.all([
        loadPartners(),
        loadOverview(),
        detailPartnerId === dynamicEditor.partnerId
          ? loadPartnerDetail(dynamicEditor.partnerId)
          : Promise.resolve(),
      ]);
    } else {
      toast.error(
        dynamicResponse?.message || limitsResponse?.message || "Failed to update dynamic limiter settings",
      );
    }

    setIsBusy(false);
  };

  if (loading || !isAuthenticated) {
    return (
      <div className="min-h-screen grid place-items-center">
        <CircularProgress />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(1200px_500px_at_10%_-10%,#f8d5b8,transparent),radial-gradient(900px_300px_at_95%_5%,#d8e8ff,transparent),#f8fafc] p-5 md:p-7">
      <div className="mx-auto max-w-7xl space-y-5">
        <header className="rounded-2xl border border-slate-200 bg-white/95 shadow-sm p-5 md:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-semibold text-slate-900">Partner API Management</h1>
              <p className="text-sm text-slate-600 mt-1">
                Create and control partner API access with live monitoring, permission scopes, and instant key actions.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <InfoButton
                variant="outlined"
                tooltip="Refresh dashboard, partner list, usage counters, and live activity"
                onClick={() => {
                  setIsBusy(true);
                  Promise.all([loadPartners(), loadOverview(), loadLive(), loadLogs(), loadAnalytics()]).finally(() => setIsBusy(false));
                }}
                startIcon={<FiRefreshCw />}
              >
                Refresh Data
              </InfoButton>
              <InfoButton
                variant="outlined"
                tooltip="Download all partner records and limits as CSV"
                onClick={async () => {
                  const response = await getData("/api/v1/partner/admin/partners/export.csv", token);
                  if (typeof response !== "string") {
                    toast.error(response?.message || "Failed to export CSV");
                    return;
                  }
                  const blob = new Blob([response], { type: "text/csv;charset=utf-8;" });
                  const link = document.createElement("a");
                  link.href = URL.createObjectURL(blob);
                  link.download = `partner-api-${new Date().toISOString().slice(0, 10)}.csv`;
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                  URL.revokeObjectURL(link.href);
                }}
              >
                Export CSV
              </InfoButton>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {SECTION_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSection(tab.id)}
                className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                  section === tab.id
                    ? "border-amber-500 bg-amber-500 text-white"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                }`}
                title={`Open ${tab.title}`}
              >
                <span className="inline-flex items-center gap-2">
                  {tab.title}
                  <InfoIcon title={`Go to ${tab.title}`} />
                </span>
              </button>
            ))}
          </div>
          {isBusy ? <LinearProgress sx={{ mt: 2 }} /> : null}
        </header>

        {issuedKeyInfo.key ? (
          <Alert severity="warning" className="rounded-xl" sx={{ borderRadius: "12px" }}>
            <div className="space-y-2">
              <p className="font-semibold">Save this key securely. It will not be shown again.</p>
              <p className="text-xs text-slate-700">
                Partner: {issuedKeyInfo.partnerName || "-"} | Email: {issuedKeyInfo.contactEmail || "-"}
              </p>
              <p className="text-xs break-all bg-amber-100/70 px-2 py-1 rounded">{issuedKeyInfo.key}</p>
              <div className="flex gap-2 flex-wrap">
                <InfoButton
                  size="small"
                  variant="contained"
                  tooltip="Copy full API key now and store in a secure vault"
                  onClick={() => copyValue(issuedKeyInfo.key, "API key")}
                  startIcon={<FiCopy />}
                >
                  Copy API Key
                </InfoButton>
                <InfoButton
                  size="small"
                  variant="contained"
                  color="success"
                  tooltip="Generate a shareable credential PDF with partner details and this API key"
                  onClick={() =>
                    downloadCredentialPdf({
                      partnerId: issuedKeyInfo.partnerId,
                      apiKey: issuedKeyInfo.key,
                    })
                  }
                >
                  Download Credential PDF
                </InfoButton>
                <InfoButton
                  size="small"
                  variant="outlined"
                  tooltip="Open partner guide in a new tab for sharing with partner developer"
                  onClick={() => window.open(`${partnerApiBase}/guide`, "_blank")}
                >
                  Open Guide
                </InfoButton>
                <InfoButton
                  size="small"
                  variant="outlined"
                  tooltip="Open the live API simulator dashboard in a new tab"
                  onClick={() => window.open(partnerSimulatorUrl, "_blank")}
                >
                  Open API Simulator
                </InfoButton>
              </div>
            </div>
          </Alert>
        ) : null}

        {section === "overview" ? (
          <section className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-sm text-slate-500">Total Partners</p>
                <p className="text-3xl font-semibold text-slate-900">{overview?.totals?.partners || 0}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-sm text-slate-500">Active API Keys</p>
                <p className="text-3xl font-semibold text-slate-900">{overview?.totals?.activeKeys || 0}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-sm text-slate-500">Requests (24h)</p>
                <p className="text-3xl font-semibold text-slate-900">{overview?.totals?.requestsLast24h || 0}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-sm text-slate-500">Error Rate (24h)</p>
                <p className="text-3xl font-semibold text-slate-900">{overview?.totals?.errorRateLast24h || 0}%</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-sm text-slate-500">Dynamic Lock / Override</p>
                <p className="text-3xl font-semibold text-slate-900">
                  {(overview?.totals?.lockedScalingPartners || 0) + (overview?.totals?.manualOverridePartners || 0)}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Locked: {overview?.totals?.lockedScalingPartners || 0}  Override: {overview?.totals?.manualOverridePartners || 0}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-semibold text-slate-900 mb-3">Active API Keys</h2>
                {live.activeApiKeys?.length ? (
                  <div className="space-y-2">
                    {live.activeApiKeys.slice(0, 10).map((item) => (
                      <div key={`${item.partnerId}-${item.keyPrefix}`} className="rounded-lg border border-slate-200 px-3 py-2 text-sm flex items-center justify-between">
                        <span className="text-slate-700">{item.keyPrefix || "Unknown key"}</span>
                        <span className="font-medium text-emerald-700">{item.activeRequests} active</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">No active API calls at this moment.</p>
                )}
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-semibold text-slate-900 mb-3">Latest API Hits</h2>
                {live.lastHits?.length ? (
                  <div className="space-y-2 max-h-90 overflow-auto pr-1">
                    {live.lastHits.slice(0, 16).map((hit, index) => (
                      <div key={`${hit.endpoint}-${index}-${hit.createdAt}`} className="rounded-lg border border-slate-200 px-3 py-2">
                        <p className="text-sm font-medium text-slate-800">{hit.method} {hit.endpoint}</p>
                        <p className="text-xs text-slate-500">{normalizeDate(hit.createdAt)}  {hit.statusCode}  {hit.location || "Unknown"}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">No request activity captured yet.</p>
                )}
              </div>
            </div>
          </section>
        ) : null}

        {section === "analytics" ? (
          <section className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="grid grid-cols-1 md:grid-cols-4 xl:grid-cols-7 gap-3">
                <Select
                  size="small"
                  value={analyticsFilters.partnerId}
                  onChange={(event) =>
                    setAnalyticsFilters((prev) => ({ ...prev, partnerId: event.target.value }))
                  }
                  displayEmpty
                >
                  <MenuItem value="">All partners</MenuItem>
                  {(analytics.filters?.partners || []).map((partner) => (
                    <MenuItem key={partner.id} value={partner.id}>{partner.name}</MenuItem>
                  ))}
                </Select>
                <Select
                  size="small"
                  value={analyticsFilters.range}
                  onChange={(event) =>
                    setAnalyticsFilters((prev) => ({ ...prev, range: event.target.value }))
                  }
                >
                  <MenuItem value="24h">Last 24 hours</MenuItem>
                  <MenuItem value="7d">Last 7 days</MenuItem>
                  <MenuItem value="custom">Custom</MenuItem>
                </Select>
                <TextField
                  size="small"
                  type="datetime-local"
                  disabled={analyticsFilters.range !== "custom"}
                  value={analyticsFilters.startDate}
                  onChange={(event) =>
                    setAnalyticsFilters((prev) => ({ ...prev, startDate: event.target.value }))
                  }
                />
                <TextField
                  size="small"
                  type="datetime-local"
                  disabled={analyticsFilters.range !== "custom"}
                  value={analyticsFilters.endDate}
                  onChange={(event) =>
                    setAnalyticsFilters((prev) => ({ ...prev, endDate: event.target.value }))
                  }
                />
                <TextField
                  size="small"
                  type="number"
                  label="Error % Alert"
                  value={analyticsSettings.errorRateThreshold}
                  onChange={(event) =>
                    setAnalyticsSettings((prev) => ({
                      ...prev,
                      errorRateThreshold: Number(event.target.value || 5),
                    }))
                  }
                />
                <TextField
                  size="small"
                  type="number"
                  label="Spike Multiplier"
                  value={analyticsSettings.trafficSpikeMultiplier}
                  onChange={(event) =>
                    setAnalyticsSettings((prev) => ({
                      ...prev,
                      trafficSpikeMultiplier: Number(event.target.value || 2.5),
                    }))
                  }
                />
                <TextField
                  size="small"
                  type="number"
                  label="Spike Min Requests"
                  value={analyticsSettings.trafficSpikeMinRequests}
                  onChange={(event) =>
                    setAnalyticsSettings((prev) => ({
                      ...prev,
                      trafficSpikeMinRequests: Number(event.target.value || 50),
                    }))
                  }
                />
              </div>
              <div className="mt-3 flex gap-2">
                <InfoButton
                  variant="contained"
                  tooltip="Apply analytics filters and refresh dashboard charts"
                  onClick={loadAnalytics}
                  startIcon={<FiActivity />}
                >
                  Apply Analytics Filters
                </InfoButton>
                <InfoButton
                  variant="outlined"
                  tooltip="Download partner analytics table as CSV"
                  onClick={downloadAnalyticsCsv}
                >
                  Export Analytics CSV
                </InfoButton>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-sm text-slate-500">Requests Today</p>
                <p className="text-3xl font-semibold text-slate-900">{analytics.summary?.totalRequestsToday || 0}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-sm text-slate-500">Live RPM (All Keys)</p>
                <p className="text-3xl font-semibold text-slate-900">{analytics.summary?.liveRequestsPerMinute || 0}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-sm text-slate-500">Error Rate</p>
                <p className={`text-3xl font-semibold ${(analytics.summary?.averageErrorRate || 0) >= Number(analyticsSettings.errorRateThreshold || 5) ? "text-red-600" : "text-slate-900"}`}>
                  {analytics.summary?.averageErrorRate || 0}%
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-sm text-slate-500">Last Activity</p>
                <p className="text-lg font-semibold text-slate-900">{normalizeDate(analytics.summary?.lastActivityAt)}</p>
              </div>
            </div>

            {analytics.alerts?.length ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {analytics.alerts.map((alert, index) => (
                  <Alert
                    key={`${alert.type}-${index}`}
                    severity={alert.severity === "critical" ? "error" : "warning"}
                    className="rounded-xl"
                  >
                    {alert.message}
                  </Alert>
                ))}
              </div>
            ) : null}

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-lg font-semibold text-slate-900 mb-3">Requests and Errors Over Time</h3>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={analytics.charts?.requestsOverTime || []}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                      <RechartsTooltip />
                      <Legend />
                      <Line type="monotone" dataKey="requests" name="Requests" stroke="#0ea5e9" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="errors" name="Errors" stroke="#ef4444" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-lg font-semibold text-slate-900 mb-3">Top Endpoints</h3>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analytics.charts?.topEndpoints || []} layout="vertical" margin={{ left: 10, right: 10, top: 10, bottom: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                      <YAxis type="category" width={160} dataKey="endpoint" tick={{ fontSize: 10 }} />
                      <RechartsTooltip />
                      <Legend />
                      <Bar dataKey="requests" name="Requests" fill="#0ea5e9" radius={[6, 6, 6, 6]} />
                      <Bar dataKey="errors" name="Errors" fill="#f97316" radius={[6, 6, 6, 6]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm overflow-auto">
              <h3 className="text-lg font-semibold text-slate-900 mb-3">Per Partner Usage Health</h3>
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-3 py-2 text-left">Partner</th>
                    <th className="px-3 py-2 text-left">Requests Today</th>
                    <th className="px-3 py-2 text-left">Live RPM</th>
                    <th className="px-3 py-2 text-left">Error Rate</th>
                    <th className="px-3 py-2 text-left">Last Active</th>
                    <th className="px-3 py-2 text-left">Alerts</th>
                  </tr>
                </thead>
                <tbody>
                  {(analytics.partnerStats || []).map((row) => {
                    const hasErrorAlert = Boolean(row.alerts?.highErrorRate);
                    const hasSpikeAlert = Boolean(row.alerts?.trafficSpike);
                    return (
                      <tr key={row.partnerId} className="border-t border-slate-100">
                        <td className="px-3 py-2">
                          <p className="font-medium text-slate-900">{row.partnerName}</p>
                          <p className="text-xs text-slate-500">{row.status}</p>
                        </td>
                        <td className="px-3 py-2">{row.totalRequestsToday || 0}</td>
                        <td className="px-3 py-2">{row.requestsPerMinuteLive || 0}</td>
                        <td className={`px-3 py-2 font-medium ${hasErrorAlert ? "text-red-600" : "text-slate-800"}`}>
                          {row.errorRate || 0}%
                        </td>
                        <td className="px-3 py-2">{normalizeDate(row.lastActiveAt)}</td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap gap-1">
                            {hasErrorAlert ? <Chip label="High error rate" size="small" color="error" /> : null}
                            {hasSpikeAlert ? <Chip label="Traffic spike" size="small" color="warning" /> : null}
                            {!hasErrorAlert && !hasSpikeAlert ? (
                              <span className="text-xs text-slate-500">Normal</span>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {!(analytics.partnerStats || []).length ? (
                    <tr>
                      <td colSpan={6} className="px-3 py-6 text-center text-slate-500">No analytics data for selected filters.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {section === "create" ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 md:p-6 shadow-sm space-y-5">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Create Partner</h2>
              <p className="text-sm text-slate-600 mt-1">Create partner record, assign permissions, and generate API key instantly.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <TextField
                label="Partner Name"
                value={form.partnerName}
                onChange={(event) => setForm((prev) => ({ ...prev, partnerName: event.target.value }))}
                fullWidth
                size="small"
              />
              <TextField
                label="Company Name (optional)"
                value={form.companyName}
                onChange={(event) => setForm((prev) => ({ ...prev, companyName: event.target.value }))}
                fullWidth
                size="small"
              />
              <TextField
                label="Contact Email"
                value={form.email}
                onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                fullWidth
                size="small"
              />
              <TextField
                label="Daily Limit"
                type="number"
                value={form.dailyRequestLimit}
                onChange={(event) => setForm((prev) => ({ ...prev, dailyRequestLimit: Number(event.target.value || 0) }))}
                fullWidth
                size="small"
              />
            </div>

            <div className="rounded-xl border border-slate-200 p-4 bg-slate-50">
              <p className="text-sm font-semibold text-slate-800 mb-2 inline-flex items-center gap-2">
                Scopes
                <InfoIcon title="Controls what data this partner can access" />
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {SCOPE_OPTIONS.map((scope) => {
                  const checked = form.scopes.includes(scope.value);
                  return (
                    <label key={scope.value} className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          setForm((prev) => ({
                            ...prev,
                            scopes: checked
                              ? prev.scopes.filter((item) => item !== scope.value)
                              : [...prev.scopes, scope.value],
                          }));
                        }}
                      />
                      <span>{scope.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-sm font-semibold text-slate-800 mb-2 inline-flex items-center gap-2">
                RPM Limit
                <InfoIcon title="Max requests allowed per minute" />
              </p>
              <TextField
                label="Requests Per Minute"
                type="number"
                value={form.rateLimitPerMinute}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, rateLimitPerMinute: Number(event.target.value || 0) }))
                }
                size="small"
                fullWidth
                helperText="Manual value. Set 0 for unbounded behavior."
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-semibold text-slate-800 mb-2 inline-flex items-center gap-2">
                  Visible Fields
                  <InfoIcon title="Choose product fields this partner is allowed to receive" />
                </p>
                <Select
                  multiple
                  value={form.visibleProductFields}
                  onChange={(event) => setForm((prev) => ({ ...prev, visibleProductFields: event.target.value }))}
                  size="small"
                  fullWidth
                  renderValue={(selected) => selected.join(", ")}
                >
                  {VISIBLE_FIELD_OPTIONS.map((field) => (
                    <MenuItem key={field} value={field}>{field}</MenuItem>
                  ))}
                </Select>
              </div>
              <TextField
                label="Token Usage Limit (optional)"
                type="number"
                value={form.dailyTokenLimit}
                onChange={(event) => setForm((prev) => ({ ...prev, dailyTokenLimit: Number(event.target.value || 0) }))}
                size="small"
                fullWidth
                helperText="Set 0 to disable token quota"
              />
            </div>

            <TextField
              label="Notes (optional)"
              value={form.notes}
              onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
              multiline
              minRows={3}
              fullWidth
            />

            <div className="flex flex-wrap gap-2">
              <InfoButton
                variant="contained"
                tooltip="Create partner and immediately generate a secure API key"
                onClick={submitCreatePartner}
                startIcon={<FiUserPlus />}
                sx={{ bgcolor: "#c1591c", "&:hover": { bgcolor: "#9e4814" } }}
              >
                Create Partner & Generate API Key
              </InfoButton>
            </div>
          </section>
        ) : null}

        {section === "partners" ? (
          <section className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="border-b border-slate-200 bg-linear-to-r from-slate-50 to-white px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">Partner Records</p>
                    <p className="text-xs text-slate-500">
                      {selectedPartnerIds.length} selected of {partners.length}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <InfoButton
                      size="small"
                      variant="outlined"
                      tooltip="Select all partners in current table"
                      onClick={selectAllPartners}
                    >
                      Select All
                    </InfoButton>
                    <InfoButton
                      size="small"
                      variant="outlined"
                      tooltip="Clear all selected partners"
                      onClick={deselectAllPartners}
                    >
                      Deselect All
                    </InfoButton>
                    <InfoButton
                      size="small"
                      variant="outlined"
                      color="error"
                      tooltip="Delete all selected partners"
                      onClick={deleteSelectedPartners}
                      startIcon={<FiTrash />}
                      disabled={!selectedPartnerIds.length || isBusy}
                    >
                      Delete Selected
                    </InfoButton>
                  </div>
                </div>

                {selectedPartners.length ? (
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    {selectedPartners.slice(0, 12).map((partner) => (
                      <Chip
                        key={`selected-chip-${partner.id}`}
                        size="small"
                        label={partner.name || partner.contactEmail || String(partner.id)}
                        onDelete={() => togglePartnerSelection(partner.id)}
                        color="warning"
                        variant="outlined"
                      />
                    ))}
                    {selectedPartners.length > 12 ? (
                      <span className="text-xs text-slate-500">+{selectedPartners.length - 12} more selected</span>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div className="max-h-[68vh] overflow-auto scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-100">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-slate-600 sticky top-0 z-10">
                    <tr>
                      <th className="px-4 py-3 text-left w-10">Select</th>
                      <th className="px-4 py-3 text-left">Name</th>
                      <th className="px-4 py-3 text-left">Status</th>
                      <th className="px-4 py-3 text-left">Scopes</th>
                      <th className="px-4 py-3 text-left">Rate Limit</th>
                      <th className="px-4 py-3 text-left">Usage (Live)</th>
                      <th className="px-4 py-3 text-left">Last Used</th>
                      <th className="px-4 py-3 text-left">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {partners.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-10 text-center text-slate-500">No partners found.</td>
                      </tr>
                    ) : (
                      partners.map((partner) => (
                        <tr
                          key={partner.id}
                          className={`border-t border-slate-100 align-top ${selectedPartnerIds.includes(String(partner.id)) ? "bg-amber-50/40" : ""}`}
                        >
                          <td className="px-4 py-4">
                            <input
                              type="checkbox"
                              aria-label={`Select ${partner.name}`}
                              checked={selectedPartnerIds.includes(String(partner.id))}
                              onChange={() => togglePartnerSelection(partner.id)}
                            />
                          </td>
                          <td className="px-4 py-4">
                            <p className="font-semibold text-slate-900">{partner.name}</p>
                            <p className="text-xs text-slate-500">{partner.contactEmail}</p>
                            {partner.companyName ? <p className="text-xs text-slate-500">{partner.companyName}</p> : null}
                          </td>
                          <td className="px-4 py-4">
                            <Chip label={partner.status} size="small" color={statusColor(partner.status)} />
                          </td>
                          <td className="px-4 py-4 max-w-55">
                            <div className="flex flex-wrap gap-1">
                              {(partner.scopes || []).map((scope) => (
                                <span key={`${partner.id}-${scope}`} className="text-[11px] rounded-full bg-slate-100 px-2 py-1 text-slate-700">
                                  {labelFromScope(scope)}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="px-4 py-4 text-xs text-slate-700">
                            <div>{partner.rateLimitPerMinute} RPM</div>
                            <div>{partner.dailyRequestLimit || 0} / day</div>
                            <div className="text-[11px] text-slate-500 mt-1">
                              Dynamic: {partner.dynamic?.effectiveRPM || partner.rateLimitPerMinute} RPM ({partner.dynamic?.state?.policy || "auto"})
                            </div>
                          </td>
                          <td className="px-4 py-4 text-xs text-slate-700">
                            <div>
                              Minute: {partner.rateLimit?.used || 0}/{partner.rateLimit?.limit || partner.rateLimitPerMinute}
                            </div>
                            <div>
                              Daily: {partner.dailyUsage?.used || 0}/{partner.dailyUsage?.limit || partner.dailyRequestLimit || 0}
                            </div>
                          </td>
                          <td className="px-4 py-4 text-xs text-slate-600">{normalizeDate(partner.lastUsedAt || partner.keyLastUsedAt)}</td>
                          <td className="px-4 py-4">
                            <div className="flex flex-wrap gap-1.5">
                              <InfoButton
                                size="small"
                                variant="outlined"
                                tooltip="View usage graph, quota, and recent logs for this partner"
                                onClick={async () => {
                                  await loadPartnerDetail(partner.id);
                                  setTimeout(() => {
                                    const node = document.getElementById("partner-detail-panel");
                                    if (node) {
                                      node.scrollIntoView({ behavior: "smooth", block: "start" });
                                    }
                                  }, 80);
                                }}
                              >
                                View
                              </InfoButton>
                              <InfoButton
                                size="small"
                                variant="outlined"
                                tooltip="Generate a new API key and disable the old one"
                                onClick={() => rotatePartnerKey(partner.id)}
                                startIcon={<FiRotateCcw />}
                              >
                                Rotate Key
                              </InfoButton>
                              <InfoButton
                                size="small"
                                variant="outlined"
                                tooltip={partner.status === "active" ? "Temporarily block API access" : "Resume API access"}
                                onClick={() => pauseResumePartner(partner)}
                                startIcon={partner.status === "active" ? <FiPauseCircle /> : <FiPlayCircle />}
                              >
                                {partner.status === "active" ? "Pause" : "Resume"}
                              </InfoButton>
                              <InfoButton
                                size="small"
                                variant="outlined"
                                tooltip="Edit permission scopes for this partner"
                                onClick={() => openPermissionEditor(partner)}
                              >
                                Edit Permissions
                              </InfoButton>
                              <InfoButton
                                size="small"
                                variant="outlined"
                                tooltip="Adjust dynamic lock, override RPM, and safety controls"
                                onClick={() => openDynamicEditor(partner)}
                              >
                                Dynamic Limits
                              </InfoButton>
                              <InfoButton
                                size="small"
                                variant="outlined"
                                color="warning"
                                tooltip="Permanently disable all keys for this partner"
                                onClick={() => revokePartner(partner.id)}
                              >
                                Revoke
                              </InfoButton>
                              <InfoButton
                                size="small"
                                variant="outlined"
                                color="error"
                                tooltip="Delete partner profile and all related API keys"
                                onClick={() => deletePartner(partner)}
                                startIcon={<FiTrash />}
                              >
                                Delete
                              </InfoButton>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {partnerDetail ? (
              <div id="partner-detail-panel" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-lg font-semibold text-slate-900">{partnerDetail.partner?.name} Usage Detail</h3>
                  <InfoButton
                    size="small"
                    variant="outlined"
                    tooltip="Refresh this partner usage panel"
                    onClick={() => loadPartnerDetail(detailPartnerId)}
                    startIcon={<FiRefreshCw />}
                  >
                    Refresh Detail
                  </InfoButton>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="rounded-xl border border-slate-200 p-4 bg-slate-50">
                    <p className="text-sm text-slate-500">API Key Prefix</p>
                    <p className="text-xl font-semibold text-slate-800">{partnerDetail.activeKey?.keyPrefix || "-"}</p>
                    <p className="text-xs text-slate-500 mt-1">Full key is intentionally hidden after creation.</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 p-4 bg-slate-50">
                    <p className="text-sm text-slate-500">Last Activity</p>
                    <p className="text-xl font-semibold text-slate-800">{normalizeDate(partnerDetail.partner?.lastUsedAt || partnerDetail.activeKey?.lastUsedAt)}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 p-4 bg-slate-50 md:col-span-2">
                    <p className="text-sm text-slate-500 mb-2">Scopes</p>
                    <div className="flex flex-wrap gap-1.5">
                      {(partnerDetail.partner?.scopes || []).map((scope) => (
                        <span key={`detail-scope-${scope}`} className="text-[11px] rounded-full bg-white border border-slate-200 px-2 py-1 text-slate-700">
                          {labelFromScope(scope)}
                        </span>
                      ))}
                      {!(partnerDetail.partner?.scopes || []).length ? (
                        <span className="text-xs text-slate-500">No scopes assigned</span>
                      ) : null}
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-200 p-4 bg-slate-50">
                    <p className="text-sm text-slate-500">Current Minute Usage</p>
                    <p className="text-xl font-semibold text-slate-800">
                      {partnerDetail.usage?.rateLimit?.used || 0}/{partnerDetail.usage?.rateLimit?.limit || 0}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 p-4 bg-slate-50">
                    <p className="text-sm text-slate-500">Current Daily Usage</p>
                    <p className="text-xl font-semibold text-slate-800">
                      {partnerDetail.usage?.dailyUsage?.used || 0}/{partnerDetail.usage?.dailyUsage?.limit || 0}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 p-4 bg-slate-50">
                    <p className="text-sm text-slate-500">Dynamic Effective RPM</p>
                    <p className="text-xl font-semibold text-slate-800">
                      {partnerDetail.partner?.dynamic?.effectiveRPM || partnerDetail.partner?.rateLimitPerMinute || 0}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      Policy: {partnerDetail.partner?.dynamic?.state?.policy || "auto"}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 p-4 bg-slate-50">
                    <p className="text-sm text-slate-500">Dynamic Controls</p>
                    <p className="text-sm font-medium text-slate-800">
                      {partnerDetail.partner?.dynamic?.controls?.lockScaling ? "Lock Enabled" : "Lock Disabled"}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      Override RPM: {partnerDetail.partner?.dynamic?.controls?.manualOverrideRPM || "none"}
                    </p>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 p-4 bg-white">
                  <p className="text-sm font-semibold text-slate-800 mb-2">Recent Scaling Actions</p>
                  <div className="space-y-2 max-h-52 overflow-auto">
                    {(partnerDetail.dynamicEvents || []).map((event, idx) => (
                      <div key={`scale-event-${idx}-${event.at || idx}`} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                        <p className="text-xs font-medium text-slate-800">
                          {event.action || "steady"}  {event.previousRPM || "-"} to {event.newRPM || "-"} RPM
                        </p>
                        <p className="text-[11px] text-slate-600">
                          {normalizeDate(event.at)}  {event.reason || "No reason"}
                        </p>
                      </div>
                    ))}
                    {!(partnerDetail.dynamicEvents || []).length ? (
                      <p className="text-xs text-slate-500">No recent scaling actions captured.</p>
                    ) : null}
                  </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  <CompactBarGraph title="Last 24 Hours" rows={partnerDetail.usage?.series24h || []} />
                  <CompactBarGraph title="Last 7 Days" rows={partnerDetail.usage?.series7d || []} />
                </div>
              </div>
            ) : null}
          </section>
        ) : null}

        {section === "docs" ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 md:p-6 shadow-sm space-y-4">
            <h2 className="text-xl font-semibold text-slate-900">Partner API Docs</h2>
            <p className="text-sm text-slate-600">
              Use the API key in x-api-key header. Partners can only access endpoints for scopes assigned by admin.
            </p>

            <div className="rounded-xl border border-slate-200 p-4 bg-slate-50 text-sm text-slate-700">
              <p className="font-semibold mb-2">Endpoints</p>
              <ul className="space-y-1">
                <li>/api/v1/partner/products</li>
                <li>/api/v1/partner/inventory</li>
                <li>/api/v1/partner/pricing</li>
                <li>/api/v1/partner/gst</li>
                <li>/api/v1/partner/combos</li>
                <li>/api/v1/partner/categories</li>
                <li>/api/v1/partner/tags</li>
              </ul>
            </div>

            <div className="rounded-xl border border-slate-200 p-4 bg-slate-50 text-sm text-slate-700">
              <p className="font-semibold mb-2">How to Use API</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Get API key from Partner API panel and store securely.</li>
                <li>Use header x-api-key: YOUR_KEY for each request.</li>
                <li>Call required scoped endpoints (products, inventory, pricing, gst).</li>
                <li>Handle errors: 401 unauthorized and 429 rate limit with retry/backoff.</li>
              </ol>
            </div>

            <div className="rounded-xl border border-slate-200 p-4 bg-slate-50 text-sm text-slate-700">
              <p className="font-semibold mb-2">Standard Response Format</p>
              <pre className="text-xs bg-slate-900 text-slate-100 p-3 rounded-lg overflow-auto">{`{\n  "success": true,\n  "data": { ... }\n}`}</pre>
              <pre className="text-xs bg-slate-900 text-slate-100 p-3 rounded-lg overflow-auto mt-2">{`{\n  "success": false,\n  "error": {\n    "code": "RATE_LIMIT_EXCEEDED",\n    "message": "Rate limit exceeded"\n  }\n}`}</pre>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
              <div className="rounded-xl border border-slate-200 p-4">
                <p className="text-sm font-semibold text-slate-800 mb-2">cURL</p>
                <pre className="text-xs bg-slate-900 text-slate-100 p-3 rounded-lg overflow-auto">{docsSamples.curl}</pre>
                <InfoButton
                  size="small"
                  variant="outlined"
                  tooltip="Copy cURL example"
                  onClick={() => copyValue(docsSamples.curl, "cURL example")}
                  sx={{ mt: 1 }}
                  startIcon={<FiCopy />}
                >
                  Copy Example
                </InfoButton>
              </div>

              <div className="rounded-xl border border-slate-200 p-4">
                <p className="text-sm font-semibold text-slate-800 mb-2">JavaScript</p>
                <pre className="text-xs bg-slate-900 text-slate-100 p-3 rounded-lg overflow-auto">{docsSamples.js}</pre>
                <InfoButton
                  size="small"
                  variant="outlined"
                  tooltip="Copy JavaScript example"
                  onClick={() => copyValue(docsSamples.js, "JS example")}
                  sx={{ mt: 1 }}
                  startIcon={<FiCopy />}
                >
                  Copy Example
                </InfoButton>
              </div>

              <div className="rounded-xl border border-slate-200 p-4">
                <p className="text-sm font-semibold text-slate-800 mb-2">Python</p>
                <pre className="text-xs bg-slate-900 text-slate-100 p-3 rounded-lg overflow-auto">{docsSamples.python}</pre>
                <InfoButton
                  size="small"
                  variant="outlined"
                  tooltip="Copy Python example"
                  onClick={() => copyValue(docsSamples.python, "Python example")}
                  sx={{ mt: 1 }}
                  startIcon={<FiCopy />}
                >
                  Copy Example
                </InfoButton>
              </div>
            </div>

            <div className="flex gap-2 flex-wrap">
              <InfoButton
                variant="outlined"
                tooltip="Open user-friendly docs page in a new tab"
                onClick={() => window.open(`${partnerApiBase}/guide`, "_blank")}
              >
                Open Full Guide
              </InfoButton>
              <InfoButton
                variant="outlined"
                tooltip="Download PDF version of partner docs"
                onClick={() => window.open(`${partnerApiBase}/guide.pdf`, "_blank")}
              >
                Download PDF
              </InfoButton>
              <InfoButton
                variant="outlined"
                tooltip="Open full partner API simulator dashboard in a new tab"
                onClick={() => window.open(partnerSimulatorUrl, "_blank")}
              >
                Open API Simulator
              </InfoButton>
            </div>
          </section>
        ) : null}

        {section === "logs" ? (
          <section className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <Select
                  size="small"
                  value={logFilters.partnerId}
                  onChange={(event) => setLogFilters((prev) => ({ ...prev, partnerId: event.target.value, page: 1 }))}
                  displayEmpty
                >
                  <MenuItem value="">All partners</MenuItem>
                  {partners.map((partner) => (
                    <MenuItem key={partner.id} value={partner.id}>{partner.name}</MenuItem>
                  ))}
                </Select>
                <TextField
                  size="small"
                  placeholder="Filter by endpoint"
                  value={logFilters.endpoint}
                  onChange={(event) => setLogFilters((prev) => ({ ...prev, endpoint: event.target.value, page: 1 }))}
                />
                <TextField
                  size="small"
                  placeholder="Status code"
                  value={logFilters.statusCode}
                  onChange={(event) => setLogFilters((prev) => ({ ...prev, statusCode: event.target.value, page: 1 }))}
                />
                <InfoButton
                  variant="contained"
                  tooltip="Apply log filters and reload request logs"
                  onClick={loadLogs}
                  startIcon={<FiActivity />}
                >
                  Apply Filters
                </InfoButton>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-lg font-semibold text-slate-900 mb-2">Recent Request Logs</h3>
                <div className="max-h-105 overflow-auto rounded-lg border border-slate-200">
                  <table className="min-w-full text-xs">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-3 py-2 text-left">Time</th>
                        <th className="px-3 py-2 text-left">Method</th>
                        <th className="px-3 py-2 text-left">Endpoint</th>
                        <th className="px-3 py-2 text-left">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logs.map((row, idx) => (
                        <tr key={`${row.endpoint}-${idx}-${row.createdAt}`} className="border-t border-slate-100">
                          <td className="px-3 py-2">{normalizeDate(row.createdAt)}</td>
                          <td className="px-3 py-2">{row.method}</td>
                          <td className="px-3 py-2">{row.endpoint}</td>
                          <td className="px-3 py-2">{row.statusCode}</td>
                        </tr>
                      ))}
                      {!logs.length ? (
                        <tr>
                          <td className="px-3 py-4 text-slate-500" colSpan={4}>No logs available.</td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  Page {logPagination?.page || 1} / {logPagination?.totalPages || 1}  {logPagination?.total || 0} records
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-lg font-semibold text-slate-900 mb-2">Errors (Last 1 Hour)</h3>
                <div className="space-y-2 max-h-105 overflow-auto">
                  {(live.recentErrors || []).map((item, idx) => (
                    <div key={`${item.endpoint}-${idx}-${item.createdAt}`} className="rounded-lg border border-red-200 bg-red-50 p-3">
                      <p className="text-sm font-medium text-red-800">{item.method} {item.endpoint}</p>
                      <p className="text-xs text-red-700">{normalizeDate(item.createdAt)}  {item.statusCode}  {item.errorCode || "ERROR"}</p>
                    </div>
                  ))}
                  {!(live.recentErrors || []).length ? <p className="text-sm text-slate-500">No recent errors.</p> : null}
                </div>
              </div>
            </div>
          </section>
        ) : null}
      </div>

      <Dialog open={permissionEditor.open} onClose={() => setPermissionEditor({ open: false, partnerId: "", scopes: [] })} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Permissions</DialogTitle>
        <DialogContent>
          <p className="text-sm text-slate-600 mb-3">Choose what this partner can access.</p>
          <div className="grid grid-cols-2 gap-2">
            {SCOPE_OPTIONS.map((scope) => {
              const checked = permissionEditor.scopes.includes(scope.value);
              return (
                <label key={`permission-${scope.value}`} className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => {
                      setPermissionEditor((prev) => ({
                        ...prev,
                        scopes: checked
                          ? prev.scopes.filter((item) => item !== scope.value)
                          : [...prev.scopes, scope.value],
                      }));
                    }}
                  />
                  <span>{scope.label}</span>
                </label>
              );
            })}
          </div>
        </DialogContent>
        <DialogActions>
          <InfoButton
            variant="text"
            tooltip="Close without saving"
            onClick={() => setPermissionEditor({ open: false, partnerId: "", scopes: [] })}
          >
            Cancel
          </InfoButton>
          <InfoButton
            variant="contained"
            tooltip="Save selected scopes for this partner"
            onClick={savePermissions}
            startIcon={<FiKey />}
          >
            Save Permissions
          </InfoButton>
        </DialogActions>
      </Dialog>

      <Dialog
        open={dynamicEditor.open}
        onClose={() =>
          setDynamicEditor({
            open: false,
            partnerId: "",
            baseRPM: "",
            burstRPM: "",
            dailyLimit: "",
            dailyTokenLimit: "",
            lockScaling: false,
            scalingEnabled: true,
            safeModeForced: false,
            manualOverrideRPM: "",
            manualOverrideDailyLimit: "",
            qualityScore: 1,
          })
        }
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Dynamic Limiter Controls</DialogTitle>
        <DialogContent className="space-y-3">
          <p className="text-sm text-slate-600">Tune lock, override, and adaptive quality for this partner.</p>
          <TextField
            label="Base RPM"
            size="small"
            type="number"
            value={dynamicEditor.baseRPM}
            onChange={(event) =>
              setDynamicEditor((prev) => ({ ...prev, baseRPM: event.target.value }))
            }
            helperText="Primary per-minute rate limit"
            fullWidth
          />
          <TextField
            label="Burst RPM"
            size="small"
            type="number"
            value={dynamicEditor.burstRPM}
            onChange={(event) =>
              setDynamicEditor((prev) => ({ ...prev, burstRPM: event.target.value }))
            }
            helperText="Temporary burst allowance"
            fullWidth
          />
          <TextField
            label="Daily Request Limit"
            size="small"
            type="number"
            value={dynamicEditor.dailyLimit}
            onChange={(event) =>
              setDynamicEditor((prev) => ({ ...prev, dailyLimit: event.target.value }))
            }
            helperText="Daily request cap"
            fullWidth
          />
          <TextField
            label="Daily Token Limit"
            size="small"
            type="number"
            value={dynamicEditor.dailyTokenLimit}
            onChange={(event) =>
              setDynamicEditor((prev) => ({ ...prev, dailyTokenLimit: event.target.value }))
            }
            helperText="Manual value. Set 0 for unbounded behavior"
            fullWidth
          />
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={dynamicEditor.scalingEnabled}
              onChange={(event) =>
                setDynamicEditor((prev) => ({ ...prev, scalingEnabled: Boolean(event.target.checked) }))
              }
            />
            Enable dynamic scaling
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={dynamicEditor.lockScaling}
              onChange={(event) =>
                setDynamicEditor((prev) => ({ ...prev, lockScaling: Boolean(event.target.checked) }))
              }
            />
            Lock current dynamic RPM
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={dynamicEditor.safeModeForced}
              onChange={(event) =>
                setDynamicEditor((prev) => ({ ...prev, safeModeForced: Boolean(event.target.checked) }))
              }
            />
            Force safe mode
          </label>

          <TextField
            label="Manual Override RPM"
            size="small"
            type="number"
            value={dynamicEditor.manualOverrideRPM}
            onChange={(event) =>
              setDynamicEditor((prev) => ({ ...prev, manualOverrideRPM: event.target.value }))
            }
            helperText="Set 0 or empty to clear override"
            fullWidth
          />
          <TextField
            label="Manual Override Daily Limit"
            size="small"
            type="number"
            value={dynamicEditor.manualOverrideDailyLimit}
            onChange={(event) =>
              setDynamicEditor((prev) => ({ ...prev, manualOverrideDailyLimit: event.target.value }))
            }
            helperText="Set 0 or empty to clear override"
            fullWidth
          />
          <TextField
            label="Partner Quality Score"
            size="small"
            type="number"
            value={dynamicEditor.qualityScore}
            onChange={(event) =>
              setDynamicEditor((prev) => ({ ...prev, qualityScore: Number(event.target.value || 1) }))
            }
            inputProps={{ min: 0.5, max: 1.5, step: 0.01 }}
            helperText="Higher values allow more aggressive scaling"
            fullWidth
          />
        </DialogContent>
        <DialogActions>
          <InfoButton
            variant="text"
            tooltip="Close without saving"
            onClick={() =>
              setDynamicEditor({
                open: false,
                partnerId: "",
                baseRPM: "",
                burstRPM: "",
                dailyLimit: "",
                dailyTokenLimit: "",
                lockScaling: false,
                scalingEnabled: true,
                safeModeForced: false,
                manualOverrideRPM: "",
                manualOverrideDailyLimit: "",
                qualityScore: 1,
              })
            }
          >
            Cancel
          </InfoButton>
          <InfoButton
            variant="contained"
            tooltip="Save dynamic limiter changes"
            onClick={saveDynamicSettings}
          >
            Save Dynamic Settings
          </InfoButton>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default PartnerApiPage;