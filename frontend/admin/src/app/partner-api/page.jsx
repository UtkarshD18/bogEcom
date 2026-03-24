"use client";

import { useAdmin } from "@/context/AdminContext";
import { API_BASE_URL, deleteData, getData, patchData, postData } from "@/utils/api";
import { Button, CircularProgress, TextField } from "@mui/material";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";

const defaultScopes = ["catalog.read", "inventory.read", "price.read"];

const sanitizeUrl = (value) => String(value || "").trim().replace(/\/+$/, "");

const isHttpUrl = (value) => /^https?:\/\//i.test(String(value || ""));

const isLocalUrl = (value) => /https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(String(value || ""));

const ensureApiBasePath = (baseUrl) => {
  const clean = sanitizeUrl(baseUrl);
  if (!clean) return "";
  if (/\/api$/i.test(clean)) return clean;
  return `${clean}/api`;
};

const resolveShareApiBase = () => {
  const envShareBase = sanitizeUrl(process.env.NEXT_PUBLIC_SHARE_BASE_URL);
  if (isHttpUrl(envShareBase)) {
    return ensureApiBasePath(envShareBase);
  }

  const current = sanitizeUrl(API_BASE_URL);
  if (!current) return "";

  if (isLocalUrl(current)) {
    return "https://healthyonegram.com/api";
  }

  return /\/api$/i.test(current) ? current : `${current}/api`;
};

const formatApiKeyForDisplay = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const parts = raw.split(".");
  if (parts.length !== 2) return raw;
  return `${parts[0]}.\n${parts[1]}`;
};

const PartnerApiPage = () => {
  const { token, isAuthenticated, loading } = useAdmin();
  const router = useRouter();

  const [partners, setPartners] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [busyPartnerId, setBusyPartnerId] = useState("");

  const [name, setName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [scopesInput, setScopesInput] = useState(defaultScopes.join(", "));
  const [rateLimitPerMinute, setRateLimitPerMinute] = useState("120");
  const [createLoading, setCreateLoading] = useState(false);
  const [newlyIssuedKey, setNewlyIssuedKey] = useState("");
  const [newlyIssuedPartnerId, setNewlyIssuedPartnerId] = useState("");
  const [testApiKey, setTestApiKey] = useState("");
  const [isTestingApiKey, setIsTestingApiKey] = useState(false);
  const [isDownloadingCredentialPdf, setIsDownloadingCredentialPdf] = useState(false);
  const [apiTestResult, setApiTestResult] = useState(null);

  const partnerApiBase = useMemo(() => {
    const base = String(API_BASE_URL || "").replace(/\/+$/, "");
    if (/\/api$/i.test(base)) {
      return `${base}/v1/partner`;
    }
    return `${base}/api/v1/partner`;
  }, []);

  const partnerApiShareBase = useMemo(() => {
    const base = resolveShareApiBase();
    return base ? `${base}/v1/partner` : partnerApiBase;
  }, [partnerApiBase]);

  const partnerApiGuideUrl = useMemo(() => `${partnerApiBase}/guide`, [partnerApiBase]);
  const partnerApiGuidePdfUrl = useMemo(() => `${partnerApiBase}/guide.pdf`, [partnerApiBase]);
  const partnerApiShareGuideUrl = useMemo(() => `${partnerApiShareBase}/guide`, [partnerApiShareBase]);
  const partnerApiShareGuidePdfUrl = useMemo(
    () => `${partnerApiShareBase}/guide.pdf`,
    [partnerApiShareBase],
  );

  const loadPartners = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);

    const response = await getData("/api/v1/partner/admin/partners", token);
    if (response?.success) {
      setPartners(Array.isArray(response.data) ? response.data : []);
    } else {
      setPartners([]);
      toast.error(response?.message || "Failed to load partners");
    }

    setIsLoading(false);
  }, [token]);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, loading, router]);

  useEffect(() => {
    if (isAuthenticated && token) {
      loadPartners();
    }
  }, [isAuthenticated, token, loadPartners]);

  const parseScopes = (value) =>
    String(value || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

  const handleCreatePartner = async () => {
    const trimmedName = String(name || "").trim();
    const trimmedEmail = String(contactEmail || "").trim();
    const parsedScopes = parseScopes(scopesInput);

    if (!trimmedName || !trimmedEmail) {
      toast.error("Name and contact email are required");
      return;
    }

    if (parsedScopes.length === 0) {
      toast.error("Provide at least one scope");
      return;
    }

    setCreateLoading(true);
    const response = await postData(
      "/api/v1/partner/admin/partners",
      {
        name: trimmedName,
        contactEmail: trimmedEmail,
        scopes: parsedScopes,
        rateLimitPerMinute: Number(rateLimitPerMinute || 120),
      },
      token,
    );

    if (response?.success) {
      toast.success("Partner created");
      setName("");
      setContactEmail("");
      setScopesInput(defaultScopes.join(", "));
      setRateLimitPerMinute("120");
      const createdApiKey = String(response?.data?.apiKey || "");
      const createdPartnerId = String(response?.data?.partner?.id || "");
      setNewlyIssuedKey(createdApiKey);
      setNewlyIssuedPartnerId(createdPartnerId);
      setTestApiKey(createdApiKey);
      setApiTestResult(null);
      await loadPartners();
    } else {
      toast.error(response?.message || "Failed to create partner");
    }

    setCreateLoading(false);
  };

  const handleRotateKey = async (partnerId) => {
    setBusyPartnerId(partnerId);

    const response = await postData(
      `/api/v1/partner/admin/partners/${partnerId}/rotate-key`,
      {},
      token,
    );

    if (response?.success) {
      toast.success("Partner key rotated");
      const rotatedApiKey = String(response?.data?.apiKey || "");
      setNewlyIssuedKey(rotatedApiKey);
      setNewlyIssuedPartnerId(String(partnerId || ""));
      setTestApiKey(rotatedApiKey);
      setApiTestResult(null);
      await loadPartners();
    } else {
      toast.error(response?.message || "Failed to rotate key");
    }

    setBusyPartnerId("");
  };

  const handleToggleStatus = async (partner) => {
    setBusyPartnerId(partner.id);

    const nextStatus = String(partner.status) === "active" ? "paused" : "active";
    const response = await patchData(
      `/api/v1/partner/admin/partners/${partner.id}`,
      { status: nextStatus },
      token,
    );

    if (response?.success) {
      toast.success(`Partner ${nextStatus}`);
      await loadPartners();
    } else {
      toast.error(response?.message || "Failed to update partner");
    }

    setBusyPartnerId("");
  };

  const handleDeletePartner = async (partner) => {
    const confirmed = confirm(`Delete partner ${partner.name}? This will remove all API keys for this partner.`);
    if (!confirmed) return;

    setBusyPartnerId(partner.id);
    const response = await deleteData(`/api/v1/partner/admin/partners/${partner.id}`, token);

    if (response?.success) {
      toast.success("Partner deleted");
      await loadPartners();
    } else {
      toast.error(response?.message || "Failed to delete partner");
    }

    setBusyPartnerId("");
  };

  const handleCopy = async (value, label) => {
    if (!value) {
      toast.error(`No ${label} to copy`);
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied`);
    } catch {
      toast.error(`Unable to copy ${label}`);
    }
  };

  const handleExportCsv = async () => {
    const response = await getData("/api/v1/partner/admin/partners/export.csv", token);

    if (typeof response !== "string") {
      toast.error(response?.message || "Failed to export CSV");
      return;
    }

    const blob = new Blob([response], { type: "text/csv;charset=utf-8;" });
    const fileName = `partner-api-partners-${new Date().toISOString().slice(0, 10)}.csv`;
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
    toast.success("Partner CSV downloaded");
  };

  const handleTestApiKey = async () => {
    const key = String(testApiKey || "").trim();
    if (!key) {
      toast.error("Enter API key to test");
      return;
    }

    setIsTestingApiKey(true);
    setApiTestResult(null);

    try {
      const response = await fetch(`${partnerApiBase}/health`, {
        method: "GET",
        headers: {
          "x-api-key": key,
        },
      });

      const body = await response.json().catch(() => ({}));
      if (response.ok) {
        setApiTestResult({
          ok: true,
          message: "API key is valid. Partner API health check passed.",
          status: response.status,
        });
        toast.success("API key is valid");
      } else {
        setApiTestResult({
          ok: false,
          message: body?.error?.message || body?.message || "API key test failed",
          status: response.status,
        });
        toast.error("API key test failed");
      }
    } catch (error) {
      setApiTestResult({
        ok: false,
        message: "Could not reach server for API key test",
        status: null,
      });
      toast.error(error?.message || "API key test failed");
    }

    setIsTestingApiKey(false);
  };

  const handleDownloadCredentialPdf = async () => {
    const partnerId = String(newlyIssuedPartnerId || "").trim();
    const apiKey = String(newlyIssuedKey || "").trim();

    if (!partnerId || !apiKey) {
      toast.error("Create or rotate a key first to download credential PDF");
      return;
    }

    setIsDownloadingCredentialPdf(true);
    try {
      const response = await fetch(`${partnerApiBase}/admin/partners/${partnerId}/credential-pdf`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ apiKey }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message || "Failed to generate credential PDF");
      }

      const blob = await response.blob();
      const disposition = response.headers.get("content-disposition") || "";
      const match = disposition.match(/filename="([^"]+)"/i);
      const fileName = match?.[1] || `partner-credential-${partnerId}.pdf`;

      const href = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = href;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(href);
      toast.success("Credential PDF downloaded");
    } catch (error) {
      toast.error(error?.message || "Failed to download credential PDF");
    } finally {
      setIsDownloadingCredentialPdf(false);
    }
  };

  const sampleCurl = `curl -X GET "${partnerApiBase}/products?limit=20" -H "x-api-key: YOUR_PARTNER_API_KEY"`;
  const isUsingLocalLinks = useMemo(() => isLocalUrl(partnerApiBase), [partnerApiBase]);

  if (loading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <CircularProgress />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Partner API</h1>
          <p className="text-gray-500">Create partner credentials and share ready-to-use API access</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outlined" onClick={handleExportCsv}>Export CSV</Button>
          <Button variant="outlined" onClick={loadPartners}>Refresh</Button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-5 space-y-3">
        <h2 className="text-lg font-semibold text-gray-800">API Base</h2>
        <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
          API Key is plain text (one line) and not a PDF. PDF files are optional docs only.
        </div>
        <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-xs text-gray-700">
          Partner list shows only <strong>Key Prefix</strong> (for security). Full API key is visible only immediately after create/rotate.
        </div>
        {isUsingLocalLinks ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            Localhost appears because admin is currently running on local machine. Copy buttons use live share URL by default.
          </div>
        ) : null}
        <p className="text-sm text-gray-600 break-all">{partnerApiBase}</p>
        <div className="bg-gray-50 rounded-md p-3 text-xs text-gray-700 break-all">Share API Base: {partnerApiShareBase}</div>
        <div className="bg-gray-50 rounded-md p-3 text-xs text-gray-700 break-all">{sampleCurl}</div>
        <div className="bg-gray-50 rounded-md p-3 text-xs text-gray-700 break-all">Shareable Guide: {partnerApiShareGuideUrl}</div>
        <div className="bg-gray-50 rounded-md p-3 text-xs text-gray-700 break-all">Downloadable PDF: {partnerApiShareGuidePdfUrl}</div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="small"
            variant="outlined"
            title="Copies live API base URL for sharing"
            onClick={() => handleCopy(partnerApiShareBase, "API base")}
          >
            Copy API Base
          </Button>
          <Button
            size="small"
            variant="outlined"
            title="Copies live web guide URL"
            onClick={() => handleCopy(partnerApiShareGuideUrl, "guide URL")}
          >
            Copy Guide URL
          </Button>
          <Button
            size="small"
            variant="outlined"
            title="Copies live PDF URL to share directly"
            onClick={() => handleCopy(partnerApiShareGuidePdfUrl, "guide PDF URL")}
          >
            Copy PDF URL
          </Button>
          <Button
            size="small"
            variant="outlined"
            title="Copies sample API request command"
            onClick={() => handleCopy(sampleCurl.replace(partnerApiBase, partnerApiShareBase), "cURL")}
          >
            Copy cURL
          </Button>
          <Button
            size="small"
            variant="outlined"
            title="Opens guide in new tab"
            onClick={() => window.open(partnerApiGuideUrl, "_blank")}
          >
            Open Guide
          </Button>
          <Button
            size="small"
            variant="outlined"
            title="Downloads the API guide PDF"
            onClick={() => window.open(partnerApiGuidePdfUrl, "_blank")}
          >
            Download PDF
          </Button>
        </div>
        <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-xs text-gray-700">
          <p><strong>Button help:</strong> Copy API Base = base endpoint, Copy Guide URL = web docs, Copy PDF URL = direct PDF, Copy cURL = sample request, Open Guide = preview docs, Download PDF = get file.</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-5 space-y-3">
        <h2 className="text-lg font-semibold text-gray-800">Create Partner</h2>
        <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
          <p className="font-medium text-gray-800 mb-2">Quick API Test</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-start">
            <TextField
              label="Paste Partner API Key"
              value={testApiKey}
              onChange={(event) => setTestApiKey(event.target.value)}
              size="small"
              fullWidth
              className="md:col-span-2"
            />
            <Button
              variant="outlined"
              onClick={handleTestApiKey}
              disabled={isTestingApiKey}
            >
              {isTestingApiKey ? "Testing..." : "Test Key"}
            </Button>
          </div>
          {apiTestResult ? (
            <p className={`text-xs mt-2 ${apiTestResult.ok ? "text-emerald-700" : "text-red-700"}`}>
              {apiTestResult.ok ? "PASS" : "FAIL"}
              {apiTestResult.status ? ` (${apiTestResult.status})` : ""}: {apiTestResult.message}
            </p>
          ) : null}
          <p className="text-xs text-gray-500 mt-1">Tests current environment endpoint: {partnerApiBase}/health</p>
        </div>
        <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
          <p className="font-medium text-gray-800 mb-1">How to send your API (simple steps)</p>
          <p>1) Create partner and copy API key.</p>
          <p>2) Share PDF doc: {partnerApiShareGuidePdfUrl}</p>
          <p>3) Send API key separately (not in public group).</p>
          <p className="mt-1 text-xs text-gray-600">One guide/PDF for all partners. Key is unique for each partner.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <TextField
            label="Partner Name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            size="small"
            fullWidth
          />
          <TextField
            label="Contact Email"
            value={contactEmail}
            onChange={(event) => setContactEmail(event.target.value)}
            size="small"
            fullWidth
          />
          <TextField
            label="Scopes (comma separated)"
            value={scopesInput}
            onChange={(event) => setScopesInput(event.target.value)}
            size="small"
            fullWidth
          />
          <TextField
            label="Rate Limit Per Minute"
            value={rateLimitPerMinute}
            onChange={(event) => setRateLimitPerMinute(event.target.value)}
            size="small"
            fullWidth
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="contained"
            onClick={handleCreatePartner}
            disabled={createLoading}
            sx={{ bgcolor: "#c1591c", "&:hover": { bgcolor: "#a04a15" } }}
          >
            {createLoading ? "Creating..." : "Create Partner + API Key"}
          </Button>
        </div>

        {newlyIssuedKey ? (
          <div className="border border-amber-200 bg-amber-50 rounded-md p-3">
            <p className="text-sm font-semibold text-amber-800">New API Key (copy now)</p>
            <pre className="text-xs text-amber-700 break-all mt-1 whitespace-pre-wrap">{formatApiKeyForDisplay(newlyIssuedKey)}</pre>
            <div className="flex flex-wrap gap-2 mt-1">
              <Button size="small" variant="outlined" onClick={() => handleCopy(newlyIssuedKey, "API key")}>Copy API Key</Button>
              <Button
                size="small"
                variant="outlined"
                onClick={() => handleCopy(`Guide PDF: ${partnerApiShareGuidePdfUrl}\nAPI Key: ${newlyIssuedKey}`, "share package")}
              >
                Copy PDF + Key
              </Button>
              <Button
                size="small"
                variant="outlined"
                onClick={handleDownloadCredentialPdf}
                disabled={isDownloadingCredentialPdf || !newlyIssuedPartnerId}
              >
                {isDownloadingCredentialPdf ? "Preparing PDF..." : "Download Credential PDF"}
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      <div className="bg-white rounded-xl shadow-sm p-5">
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Partners</h2>
        {isLoading ? (
          <div className="flex justify-center py-6">
            <CircularProgress size={26} />
          </div>
        ) : partners.length === 0 ? (
          <p className="text-gray-500 py-2">No partners created yet.</p>
        ) : (
          <div className="space-y-3">
            {partners.map((partner) => (
              <div
                key={partner.id}
                className="border border-gray-200 rounded-lg p-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-gray-800">{partner.name}</p>
                  <p className="text-sm text-gray-600 break-all">{partner.contactEmail}</p>
                  <p className="text-xs text-gray-500 mt-1">Scopes: {(partner.scopes || []).join(", ") || "none"}</p>
                  <p className="text-xs text-gray-500 mt-1">Key Prefix: {partner.keyPrefix || "none"}</p>
                  <p className="text-xs text-gray-500 mt-1">Status: {partner.status} • RPM: {partner.rateLimitPerMinute}</p>
                  {partner?.rateLimit ? (
                    <p
                      className={`text-xs mt-1 inline-flex items-center rounded-full border px-2 py-0.5 ${
                        partner.rateLimit.isLimited
                          ? "bg-red-50 text-red-700 border-red-200"
                          : "bg-emerald-50 text-emerald-700 border-emerald-200"
                      }`}
                    >
                      Rate usage: {partner.rateLimit.used}/{partner.rateLimit.limit}
                      {partner.rateLimit.resetInSeconds > 0
                        ? ` • resets in ${partner.rateLimit.resetInSeconds}s`
                        : " • idle"}
                    </p>
                  ) : null}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => handleRotateKey(partner.id)}
                    disabled={busyPartnerId === partner.id}
                  >
                    Rotate Key
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => handleToggleStatus(partner)}
                    disabled={busyPartnerId === partner.id}
                  >
                    {partner.status === "active" ? "Pause" : "Activate"}
                  </Button>
                  <Button
                    size="small"
                    color="error"
                    variant="outlined"
                    onClick={() => handleDeletePartner(partner)}
                    disabled={busyPartnerId === partner.id}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PartnerApiPage;
