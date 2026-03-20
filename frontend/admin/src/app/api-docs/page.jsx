"use client";

import { useAdmin } from "@/context/AdminContext";
import { API_BASE_URL, deleteData, getData, postMultipartData, putData } from "@/utils/api";
import {
  Button,
  CircularProgress,
  FormControlLabel,
  Switch,
  TextField,
} from "@mui/material";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { MdOutlinePictureAsPdf } from "react-icons/md";

const buildPublicShareUrl = (slug) => {
  const base = String(API_BASE_URL || "").replace(/\/+$/, "");
  if (/\/api$/i.test(base)) {
    return `${base}/api-docs/public/${slug}`;
  }
  return `${base}/api/api-docs/public/${slug}`;
};

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
  if (isLocalUrl(current)) return "https://healthyonegram.com/api";
  return /\/api$/i.test(current) ? current : `${current}/api`;
};

const buildPartnerGuideUrl = () => {
  const base = resolveShareApiBase();
  if (/\/api$/i.test(base)) {
    return `${base}/v1/partner/guide`;
  }
  return `${base}/api/v1/partner/guide`;
};

const buildPartnerGuidePdfUrl = () => {
  const base = resolveShareApiBase();
  if (/\/api$/i.test(base)) {
    return `${base}/v1/partner/guide.pdf`;
  }
  return `${base}/api/v1/partner/guide.pdf`;
};

const ApiDocsPage = () => {
  const { token, isAuthenticated, loading } = useAdmin();
  const router = useRouter();

  const [docs, setDocs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [selectedPdf, setSelectedPdf] = useState(null);
  const [busyDocId, setBusyDocId] = useState("");

  const partnerGuideUrl = useMemo(() => buildPartnerGuideUrl(), []);
  const partnerGuidePdfUrl = useMemo(() => buildPartnerGuidePdfUrl(), []);

  const totalDocs = useMemo(() => docs.length, [docs]);
  const publicDocs = useMemo(() => docs.filter((item) => item.isPublic).length, [docs]);

  const fetchDocs = useCallback(async () => {
    if (!token) return;

    setIsLoading(true);
    const response = await getData("/api/api-docs/admin/all", token);

    if (response?.success) {
      setDocs(Array.isArray(response.data) ? response.data : []);
    } else {
      setDocs([]);
      toast.error(response?.message || "Failed to load API PDFs");
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
      fetchDocs();
    }
  }, [isAuthenticated, token, fetchDocs]);

  const handleUpload = async () => {
    const trimmedTitle = String(title || "").trim();
    if (!trimmedTitle) {
      toast.error("Title is required");
      return;
    }

    if (!selectedPdf) {
      toast.error("Please choose a PDF file");
      return;
    }

    const payload = new FormData();
    payload.append("title", trimmedTitle);
    payload.append("description", String(description || "").trim());
    payload.append("isPublic", String(isPublic));
    payload.append("pdf", selectedPdf);

    setIsUploading(true);
    const response = await postMultipartData("/api/api-docs/admin/create", payload, token);

    if (response?.success) {
      toast.success("API PDF uploaded");
      setTitle("");
      setDescription("");
      setIsPublic(true);
      setSelectedPdf(null);
      await fetchDocs();
    } else {
      toast.error(response?.message || "Upload failed");
    }

    setIsUploading(false);
  };

  const handleDelete = async (docId) => {
    if (!confirm("Delete this API PDF?")) return;

    setBusyDocId(docId);
    const response = await deleteData(`/api/api-docs/admin/${docId}`, token);

    if (response?.success) {
      toast.success("API PDF deleted");
      await fetchDocs();
    } else {
      toast.error(response?.message || "Delete failed");
    }

    setBusyDocId("");
  };

  const handleTogglePublic = async (doc) => {
    setBusyDocId(doc.id);
    const response = await putData(
      `/api/api-docs/admin/${doc.id}`,
      { isPublic: !doc.isPublic },
      token,
    );

    if (response?.success) {
      toast.success(doc.isPublic ? "Set to private" : "Set to public");
      await fetchDocs();
    } else {
      toast.error(response?.message || "Update failed");
    }

    setBusyDocId("");
  };

  const handleCopyShare = async (slug) => {
    const url = buildPublicShareUrl(slug);
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Share link copied");
    } catch {
      toast.error("Unable to copy link");
    }
  };

  const handleCopyText = async (value, successText) => {
    try {
      await navigator.clipboard.writeText(String(value || ""));
      toast.success(successText);
    } catch {
      toast.error("Unable to copy link");
    }
  };

  const handleEdit = async (doc) => {
    const nextTitle = prompt("Update title", String(doc.title || ""));
    if (nextTitle === null) return;

    const nextDescription = prompt(
      "Update description",
      String(doc.description || ""),
    );
    if (nextDescription === null) return;

    const titleTrimmed = String(nextTitle || "").trim();
    if (!titleTrimmed) {
      toast.error("Title cannot be empty");
      return;
    }

    setBusyDocId(doc.id);
    const response = await putData(
      `/api/api-docs/admin/${doc.id}`,
      {
        title: titleTrimmed,
        description: String(nextDescription || "").trim(),
      },
      token,
    );

    if (response?.success) {
      toast.success("API PDF updated");
      await fetchDocs();
    } else {
      toast.error(response?.message || "Update failed");
    }

    setBusyDocId("");
  };

  if (loading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <CircularProgress />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">API PDFs</h1>
          <p className="text-gray-500">Upload, manage, and share API documentation in PDF form</p>
        </div>
        <Button variant="outlined" onClick={fetchDocs}>
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm p-4">
          <p className="text-sm text-gray-500">Total PDFs</p>
          <p className="text-2xl font-semibold text-gray-800">{totalDocs}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4">
          <p className="text-sm text-gray-500">Public</p>
          <p className="text-2xl font-semibold text-emerald-700">{publicDocs}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4">
          <p className="text-sm text-gray-500">Private</p>
          <p className="text-2xl font-semibold text-amber-700">{Math.max(totalDocs - publicDocs, 0)}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-5 mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Partner API Guide</h2>
        <p className="text-sm text-gray-600 mb-2">
          Share this live API guide link with partners for endpoint details and authentication format.
        </p>
        <p className="text-xs text-amber-700 mb-2">
          Note: API keys are generated from the Partner API page, not from PDF uploads.
        </p>
        <div className="bg-gray-50 rounded-md p-3 text-xs text-gray-700 break-all mb-3">{partnerGuideUrl}</div>
        <div className="bg-gray-50 rounded-md p-3 text-xs text-gray-700 break-all mb-3">{partnerGuidePdfUrl}</div>
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <Button
            size="small"
            variant="outlined"
            onClick={() => handleCopyText(partnerGuideUrl, "Partner API guide link copied")}
          >
            Copy Guide Link
          </Button>
          <Button
            size="small"
            variant="outlined"
            onClick={() => handleCopyText(partnerGuidePdfUrl, "Partner API PDF link copied")}
          >
            Copy PDF Link
          </Button>
          <Button
            size="small"
            variant="outlined"
            onClick={() => window.open(partnerGuideUrl, "_blank")}
          >
            Open Guide
          </Button>
          <Button
            size="small"
            variant="outlined"
            onClick={() => window.open(partnerGuidePdfUrl, "_blank")}
          >
            Download Partner API PDF
          </Button>
        </div>

        <h2 className="text-lg font-semibold text-gray-800 mb-3">Upload New API PDF</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <TextField
            label="Title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            size="small"
            fullWidth
          />
          <TextField
            label="Description (optional)"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            size="small"
            fullWidth
          />
          <div className="md:col-span-2">
            <input
              type="file"
              accept="application/pdf,.pdf"
              onChange={(event) => {
                const file = event.target.files?.[0] || null;
                setSelectedPdf(file);
              }}
              className="block w-full text-sm text-gray-700"
            />
            {selectedPdf ? (
              <p className="text-xs text-gray-500 mt-1">Selected: {selectedPdf.name}</p>
            ) : null}
          </div>
          <div className="md:col-span-2">
            <FormControlLabel
              control={
                <Switch
                  checked={isPublic}
                  onChange={(event) => setIsPublic(event.target.checked)}
                  color="success"
                />
              }
              label="Publicly shareable"
            />
          </div>
        </div>
        <div className="mt-4">
          <Button
            variant="contained"
            onClick={handleUpload}
            disabled={isUploading}
            sx={{ bgcolor: "#c1591c", "&:hover": { bgcolor: "#a04a15" } }}
          >
            {isUploading ? "Uploading..." : "Upload API PDF"}
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-5">
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Manage API PDFs</h2>
        {isLoading ? (
          <div className="flex justify-center py-6">
            <CircularProgress size={26} />
          </div>
        ) : docs.length === 0 ? (
          <p className="text-gray-500 py-4">No API PDF uploaded yet.</p>
        ) : (
          <div className="space-y-3">
            {docs.map((doc) => (
              <div
                key={doc.id}
                className="border border-gray-200 rounded-lg p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-gray-800 flex items-center gap-2">
                    <MdOutlinePictureAsPdf className="text-red-500" />
                    <span className="truncate">{doc.title}</span>
                  </p>
                  <p className="text-sm text-gray-500 mt-1 break-all">{doc.description || "No description"}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {doc.originalFileName} • {(Number(doc.fileSize || 0) / (1024 * 1024)).toFixed(2)} MB
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => window.open(doc.fileUrl, "_blank")}
                  >
                    Open PDF
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => handleCopyShare(doc.slug)}
                    disabled={!doc.isPublic}
                  >
                    Copy Share Link
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => handleEdit(doc)}
                    disabled={busyDocId === doc.id}
                  >
                    Edit
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => handleTogglePublic(doc)}
                    disabled={busyDocId === doc.id}
                  >
                    {doc.isPublic ? "Make Private" : "Make Public"}
                  </Button>
                  <Button
                    size="small"
                    color="error"
                    variant="outlined"
                    onClick={() => handleDelete(doc.id)}
                    disabled={busyDocId === doc.id}
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

export default ApiDocsPage;
