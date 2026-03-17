"use client";

import { useAdmin } from "@/context/AdminContext";
import { deleteData, getData, putData, uploadFile } from "@/utils/api";
import { getImageUrl } from "@/utils/imageUtils";
import {
  Button,
  CircularProgress,
  Divider,
  FormControlLabel,
  Modal,
  Switch,
  TextField,
} from "@mui/material";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import { MdImage, MdSave, MdSearch } from "react-icons/md";

const resolveStorefrontBaseUrl = () => {
  if (typeof window === "undefined") return "https://healthyonegram.com";
  const hostname = String(window.location.hostname || "").toLowerCase();
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return "http://localhost:3000";
  }
  return String(window.location.origin || "https://healthyonegram.com").replace(
    /\/+$/,
    "",
  );
};

const buildProductCardHtml = ({ product, offerText = "" }) => {
  const baseUrl = resolveStorefrontBaseUrl();
  const productUrl = `${baseUrl}/product/${encodeURIComponent(product?._id)}`;
  const imageUrl = getImageUrl(product?.thumbnail || product?.images?.[0] || "");
  const safeName = String(product?.name || "Product").trim();
  const safeOffer = String(offerText || "").trim();

  const price =
    typeof product?.price === "number" ? `₹${product.price}` : product?.price ? `₹${product.price}` : "";

  return `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:14px 0;border:1px solid #ece3d8;border-radius:14px;overflow:hidden;background:#ffffff;">
  <tr>
    <td style="padding:14px;width:140px;vertical-align:top;">
      <a href="${productUrl}" style="text-decoration:none;display:inline-block;">
        <img src="${imageUrl}" alt="${safeName}" width="120" height="120" style="display:block;border-radius:12px;object-fit:cover;border:1px solid #ece3d8;background:#fff;" />
      </a>
    </td>
    <td style="padding:14px;vertical-align:top;">
      <div style="font-size:14px;font-weight:800;color:#111;line-height:1.3;">${safeName}</div>
      ${price ? `<div style="margin-top:6px;font-size:13px;color:#444;">Price: <strong>${price}</strong></div>` : ""}
      ${safeOffer ? `<div style="margin-top:6px;font-size:13px;color:#b45309;"><strong>Offer:</strong> ${safeOffer}</div>` : ""}
      <div style="margin-top:12px;">
        <a href="${productUrl}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:10px 14px;border-radius:10px;font-weight:800;font-size:13px;">View Product</a>
      </div>
    </td>
  </tr>
</table>
`.trim();
};

const insertAtCursor = (textareaEl, snippet) => {
  if (!textareaEl) return snippet;
  const start = textareaEl.selectionStart ?? 0;
  const end = textareaEl.selectionEnd ?? 0;
  const value = String(textareaEl.value || "");
  return value.slice(0, start) + snippet + value.slice(end);
};

const EmailTemplatesPage = () => {
  const { token, isAuthenticated, loading } = useAdmin();

  const [templates, setTemplates] = useState([]);
  const [selectedTemplateFile, setSelectedTemplateFile] = useState("");

  const [loadingList, setLoadingList] = useState(true);
  const [loadingTemplate, setLoadingTemplate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);

  const [placeholders, setPlaceholders] = useState([]);
  const [defaultHtml, setDefaultHtml] = useState("");
  const [overrideDraft, setOverrideDraft] = useState({
    enabled: true,
    subject: "",
    html: "",
    text: "",
  });

  const htmlRef = useRef(null);

  const [productModalOpen, setProductModalOpen] = useState(false);
  const [productQuery, setProductQuery] = useState("");
  const [productResults, setProductResults] = useState([]);
  const [productLoading, setProductLoading] = useState(false);
  const [productOfferText, setProductOfferText] = useState("");

  const effectivePreviewHtml = useMemo(() => {
    const html = String(overrideDraft.html || "").trim();
    return html || defaultHtml || "";
  }, [overrideDraft.html, defaultHtml]);

  const fetchTemplates = useCallback(async () => {
    if (!token) return;
    setLoadingList(true);
    try {
      const response = await getData("/api/admin/email-templates", token);
      if (response?.success) {
        setTemplates(response.templates || []);
        const first =
          response.templates?.[0]?.templateFile ||
          response.templates?.[0]?.name ||
          "";
        if (!selectedTemplateFile && first) {
          setSelectedTemplateFile(first);
        }
      } else {
        toast.error(response?.message || "Failed to load templates");
      }
    } catch (error) {
      toast.error("Failed to load templates");
    } finally {
      setLoadingList(false);
    }
  }, [selectedTemplateFile, token]);

  const fetchTemplate = useCallback(async () => {
    if (!token || !selectedTemplateFile) return;
    setLoadingTemplate(true);
    try {
      const response = await getData(
        `/api/admin/email-templates/${encodeURIComponent(selectedTemplateFile)}`,
        token,
      );
      if (response?.success) {
        setDefaultHtml(response?.defaults?.html || "");
        setPlaceholders(response?.placeholders || []);
        const ov = response?.override;
        setOverrideDraft({
          enabled: ov?.enabled !== false,
          subject: ov?.subject || "",
          html: ov?.html || "",
          text: ov?.text || "",
        });
      } else {
        toast.error(response?.message || "Failed to load template");
      }
    } catch (error) {
      toast.error("Failed to load template");
    } finally {
      setLoadingTemplate(false);
    }
  }, [selectedTemplateFile, token]);

  useEffect(() => {
    if (!loading && isAuthenticated && token) {
      fetchTemplates();
    }
  }, [fetchTemplates, isAuthenticated, loading, token]);

  useEffect(() => {
    if (!loading && isAuthenticated && token && selectedTemplateFile) {
      fetchTemplate();
    }
  }, [fetchTemplate, isAuthenticated, loading, selectedTemplateFile, token]);

  const handleSave = async () => {
    if (!selectedTemplateFile) return;
    const hasAny =
      String(overrideDraft.subject || "").trim() ||
      String(overrideDraft.html || "").trim() ||
      String(overrideDraft.text || "").trim();
    if (!hasAny) {
      toast.error("Add subject/html/text or use Reset to remove override.");
      return;
    }

    setSaving(true);
    try {
      const response = await putData(
        `/api/admin/email-templates/${encodeURIComponent(selectedTemplateFile)}`,
        overrideDraft,
        token,
      );
      if (response?.success) {
        toast.success("Template override saved");
      } else {
        toast.error(response?.message || "Failed to save template override");
      }
    } catch (error) {
      toast.error("Failed to save template override");
    } finally {
      setSaving(false);
      fetchTemplate();
    }
  };

  const handleReset = async () => {
    if (!selectedTemplateFile) return;
    setResetting(true);
    try {
      const response = await deleteData(
        `/api/admin/email-templates/${encodeURIComponent(selectedTemplateFile)}`,
        token,
      );
      if (response?.success) {
        toast.success("Override removed");
        setOverrideDraft({ enabled: true, subject: "", html: "", text: "" });
      } else {
        toast.error(response?.message || "Failed to remove override");
      }
    } catch (error) {
      toast.error("Failed to remove override");
    } finally {
      setResetting(false);
      fetchTemplate();
    }
  };

  const handleSearchProducts = async () => {
    if (!token) return;
    const q = String(productQuery || "").trim();
    if (!q) {
      setProductResults([]);
      return;
    }

    setProductLoading(true);
    try {
      const response = await getData(
        `/api/products?search=${encodeURIComponent(q)}&limit=12`,
        token,
      );
      if (response?.success) {
        setProductResults(response?.data || []);
      } else {
        toast.error(response?.message || "Product search failed");
      }
    } catch (error) {
      toast.error("Product search failed");
    } finally {
      setProductLoading(false);
    }
  };

  const handleInsertProduct = (product) => {
    const snippet = buildProductCardHtml({
      product,
      offerText: productOfferText,
    });
    const next = insertAtCursor(htmlRef.current, `\n${snippet}\n`);
    setOverrideDraft((prev) => ({ ...prev, html: next }));
    setProductModalOpen(false);
    setProductOfferText("");
  };

  const handleInsertImage = async (event) => {
    const file = event.target.files?.[0] || null;
    if (!file || !token) return;

    try {
      const upload = await uploadFile(file, token);
      const url = upload?.data?.url || "";
      if (!upload?.success || !url) {
        toast.error(upload?.message || "Image upload failed");
        return;
      }

      const snippet = `<p style="margin:16px 0;"><img src="${url}" alt="" style="max-width:100%;height:auto;border-radius:14px;border:1px solid #ece3d8;display:block;" /></p>`;
      const next = insertAtCursor(htmlRef.current, `\n${snippet}\n`);
      setOverrideDraft((prev) => ({ ...prev, html: next }));
      toast.success("Image inserted");
    } catch (error) {
      toast.error("Image upload failed");
    } finally {
      event.target.value = "";
    }
  };

  if (loading || (!isAuthenticated && !loading)) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <CircularProgress />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Email Templates</h1>
          <p className="text-gray-500 mt-1">
            Override transactional email HTML/subject from the Admin panel.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="contained"
            startIcon={saving ? <CircularProgress size={18} /> : <MdSave />}
            disabled={saving || loadingTemplate || !selectedTemplateFile}
            onClick={handleSave}
            sx={{ textTransform: "none" }}
          >
            Save Override
          </Button>
          <Button
            variant="outlined"
            color="error"
            disabled={resetting || loadingTemplate || !selectedTemplateFile}
            onClick={handleReset}
            sx={{ textTransform: "none" }}
          >
            {resetting ? "Resetting..." : "Reset Override"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-800">Templates</h2>
            {loadingList && <CircularProgress size={18} />}
          </div>
          <Divider className="my-3" />

          <div className="flex flex-col gap-2">
            {templates.map((t) => (
              <button
                key={t.templateFile}
                type="button"
                onClick={() => setSelectedTemplateFile(t.templateFile)}
                className={`text-left px-3 py-2 rounded-lg border transition-all ${
                  selectedTemplateFile === t.templateFile
                    ? "bg-blue-50 border-blue-200 text-blue-700 font-semibold"
                    : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
                }`}
              >
                <div className="text-sm">{t.templateFile}</div>
                {t.override && (
                  <div className="text-xs text-gray-500 mt-1">
                    Override:{" "}
                    {t.override.enabled ? "enabled" : "disabled"}{" "}
                    {t.override.updatedAt
                      ? `• updated ${new Date(t.override.updatedAt).toLocaleString()}`
                      : ""}
                  </div>
                )}
              </button>
            ))}
            {!loadingList && templates.length === 0 && (
              <div className="text-sm text-gray-500">No templates found.</div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-5 lg:col-span-2">
          {!selectedTemplateFile ? (
            <div className="text-gray-500">Select a template.</div>
          ) : loadingTemplate ? (
            <div className="flex items-center justify-center py-10">
              <CircularProgress />
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-gray-800">
                    {selectedTemplateFile}
                  </h2>
                  {placeholders.length > 0 && (
                    <p className="text-xs text-gray-500 mt-1">
                      Placeholders:{" "}
                      <span className="font-mono">
                        {placeholders.map((p) => `{{${p}}}`).join(" ")}
                      </span>
                      {"  "}
                      (use <span className="font-mono">{"{{{items_html}}}"}</span>{" "}
                      for rich order items)
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <FormControlLabel
                    control={
                      <Switch
                        checked={overrideDraft.enabled !== false}
                        onChange={(e) =>
                          setOverrideDraft((prev) => ({
                            ...prev,
                            enabled: e.target.checked,
                          }))
                        }
                      />
                    }
                    label="Enabled"
                  />

                  <Button
                    variant="outlined"
                    startIcon={<MdSearch />}
                    onClick={() => setProductModalOpen(true)}
                    sx={{ textTransform: "none" }}
                  >
                    Insert Product
                  </Button>

                  <Button
                    variant="outlined"
                    startIcon={<MdImage />}
                    component="label"
                    sx={{ textTransform: "none" }}
                  >
                    Insert Image
                    <input
                      type="file"
                      accept="image/*"
                      hidden
                      onChange={handleInsertImage}
                    />
                  </Button>
                </div>
              </div>

              <Divider className="my-4" />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <TextField
                  label="Subject Override (optional)"
                  value={overrideDraft.subject}
                  onChange={(e) =>
                    setOverrideDraft((prev) => ({
                      ...prev,
                      subject: e.target.value,
                    }))
                  }
                  size="small"
                  fullWidth
                  helperText="Leave empty to use the default subject from code."
                />
                <TextField
                  label="Text Override (optional)"
                  value={overrideDraft.text}
                  onChange={(e) =>
                    setOverrideDraft((prev) => ({
                      ...prev,
                      text: e.target.value,
                    }))
                  }
                  size="small"
                  fullWidth
                  helperText="Plain-text fallback (optional)."
                />
              </div>

              <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-gray-700">
                      Override HTML (optional)
                    </h3>
                    <p className="text-xs text-gray-500">
                      If empty, default template is used.
                    </p>
                  </div>
                  <textarea
                    ref={htmlRef}
                    value={overrideDraft.html}
                    onChange={(e) =>
                      setOverrideDraft((prev) => ({
                        ...prev,
                        html: e.target.value,
                      }))
                    }
                    className="mt-2 w-full h-[420px] font-mono text-xs border rounded-lg p-3 bg-gray-50"
                    placeholder="Paste/compose HTML here..."
                  />
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-gray-700">
                    Preview
                  </h3>
                  <div className="mt-2 border rounded-lg p-3 bg-white h-[420px] overflow-auto">
                    <div
                      dangerouslySetInnerHTML={{ __html: effectivePreviewHtml }}
                    />
                  </div>
                </div>
              </div>

              <Divider className="my-6" />
              <details>
                <summary className="cursor-pointer text-sm font-semibold text-gray-700">
                  View Default Template HTML
                </summary>
                <pre className="mt-3 whitespace-pre-wrap break-words text-xs bg-gray-50 border rounded-lg p-3 max-h-[320px] overflow-auto">
                  {defaultHtml}
                </pre>
              </details>
            </>
          )}
        </div>
      </div>

      <Modal open={productModalOpen} onClose={() => setProductModalOpen(false)}>
        <div className="bg-white rounded-xl shadow-lg p-5 w-[92vw] max-w-3xl mx-auto mt-16 outline-none">
          <h2 className="text-lg font-semibold text-gray-800">
            Insert Product Card
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Search products and insert a clickable product card into the HTML.
          </p>

          <Divider className="my-4" />

          <div className="flex items-center gap-2">
            <TextField
              label="Search"
              value={productQuery}
              onChange={(e) => setProductQuery(e.target.value)}
              size="small"
              fullWidth
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSearchProducts();
              }}
            />
            <Button
              variant="contained"
              onClick={handleSearchProducts}
              disabled={productLoading}
              sx={{ textTransform: "none", height: 40, whiteSpace: "nowrap" }}
              startIcon={productLoading ? <CircularProgress size={18} /> : null}
            >
              Search
            </Button>
          </div>

          <div className="mt-3">
            <TextField
              label="Offer Text (optional)"
              value={productOfferText}
              onChange={(e) => setProductOfferText(e.target.value)}
              size="small"
              fullWidth
              placeholder="e.g., Use code PB10 for 10% off"
            />
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[420px] overflow-auto pr-1">
            {productResults.map((p) => (
              <button
                key={p._id}
                type="button"
                onClick={() => handleInsertProduct(p)}
                className="flex gap-3 items-start border rounded-lg p-3 hover:bg-gray-50 text-left"
              >
                <img
                  src={getImageUrl(p?.thumbnail || p?.images?.[0] || "")}
                  alt={p?.name || "product"}
                  className="w-14 h-14 rounded-lg object-cover border"
                  loading="lazy"
                />
                <div className="flex-1">
                  <div className="text-sm font-semibold text-gray-800">
                    {p?.name}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {p?._id}
                  </div>
                </div>
              </button>
            ))}
            {!productLoading && productResults.length === 0 && (
              <div className="text-sm text-gray-500">
                Search to find products.
              </div>
            )}
          </div>

          <div className="mt-5 flex justify-end gap-2">
            <Button
              variant="outlined"
              onClick={() => setProductModalOpen(false)}
              sx={{ textTransform: "none" }}
            >
              Close
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default EmailTemplatesPage;

