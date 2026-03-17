"use client";

import { useAdmin } from "@/context/AdminContext";
import { deleteData, getData, postData, putData, uploadFile } from "@/utils/api";
import { getImageUrl } from "@/utils/imageUtils";
import {
  Button,
  CircularProgress,
  Divider,
  FormControlLabel,
  Modal,
  MenuItem,
  Select,
  Switch,
  TextField,
} from "@mui/material";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import { MdImage, MdMailOutline, MdSearch } from "react-icons/md";
import Pagination from "@mui/material/Pagination";

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
    typeof product?.price === "number"
      ? `₹${product.price}`
      : product?.price
        ? `₹${product.price}`
        : "";

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

const NewsletterPage = () => {
  const { token, isAuthenticated, loading } = useAdmin();
  const router = useRouter();

  const [subscribers, setSubscribers] = useState([]);
  const [stats, setStats] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  const [templateLoading, setTemplateLoading] = useState(false);
  const [templateSaving, setTemplateSaving] = useState(false);
  const [campaign, setCampaign] = useState({
    subject: "",
    text: "",
    html: "",
  });
  const htmlRef = useRef(null);

  const [productModalOpen, setProductModalOpen] = useState(false);
  const [productQuery, setProductQuery] = useState("");
  const [productResults, setProductResults] = useState([]);
  const [productLoading, setProductLoading] = useState(false);
  const [productOfferText, setProductOfferText] = useState("");
  const [templateUpdatedAt, setTemplateUpdatedAt] = useState(null);
  const [testEmail, setTestEmail] = useState("");
  const [sendTestLoading, setSendTestLoading] = useState(false);
  const [sendBroadcastLoading, setSendBroadcastLoading] = useState(false);
  const [broadcastLimit, setBroadcastLimit] = useState(200);
  const [broadcastConfirm, setBroadcastConfirm] = useState(false);

  const fetchSubscribers = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await getData(
        `/api/newsletter/subscribers?page=${page}&limit=20&status=${statusFilter}`,
        token,
      );

      if (response.success) {
        setSubscribers(response.subscribers || []);
        setStats(response.stats || null);
        setTotalPages(response.pagination?.pages || 1);
      } else {
        setSubscribers([]);
        setStats(null);
      }
    } catch (error) {
      console.error("Failed to fetch subscribers:", error);
      setSubscribers([]);
      setStats(null);
    }
    setIsLoading(false);
  }, [page, statusFilter, token]);

  const fetchTemplate = useCallback(async () => {
    if (!token) return;
    setTemplateLoading(true);
    try {
      const response = await getData("/api/newsletter/campaign/template", token);
      if (response?.success) {
        setCampaign({
          subject: response?.template?.subject || "",
          text: response?.template?.text || "",
          html: response?.template?.html || "",
        });
        setTemplateUpdatedAt(response?.updatedAt || null);
      } else {
        toast.error(response?.message || "Failed to load template");
      }
    } catch (error) {
      console.error("Failed to fetch newsletter template:", error);
      toast.error("Failed to load template");
    } finally {
      setTemplateLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, loading, router]);

  useEffect(() => {
    if (isAuthenticated && token) {
      fetchSubscribers();
    }
  }, [isAuthenticated, token, fetchSubscribers]);

  useEffect(() => {
    if (isAuthenticated && token) {
      fetchTemplate();
    }
  }, [isAuthenticated, token, fetchTemplate]);

  const handleSaveTemplate = async () => {
    if (!campaign?.subject?.trim()) {
      toast.error("Subject is required");
      return;
    }
    setTemplateSaving(true);
    try {
      const response = await putData(
        "/api/newsletter/campaign/template",
        campaign,
        token,
      );
      if (response?.success) {
        toast.success("Template saved");
        setCampaign({
          subject: response?.template?.subject || campaign.subject,
          text: response?.template?.text || campaign.text,
          html: response?.template?.html || campaign.html,
        });
        setTemplateUpdatedAt(response?.updatedAt || null);
      } else {
        toast.error(response?.message || "Failed to save template");
      }
    } catch (error) {
      console.error("Failed to save newsletter template:", error);
      toast.error("Failed to save template");
    } finally {
      setTemplateSaving(false);
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
    setCampaign((prev) => ({ ...prev, html: next }));
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

      const snippet = `<p style=\"margin:16px 0;\"><img src=\"${url}\" alt=\"\" style=\"max-width:100%;height:auto;border-radius:14px;border:1px solid #ece3d8;display:block;\" /></p>`;
      const next = insertAtCursor(htmlRef.current, `\n${snippet}\n`);
      setCampaign((prev) => ({ ...prev, html: next }));
      toast.success("Image inserted");
    } catch (error) {
      toast.error("Image upload failed");
    } finally {
      event.target.value = "";
    }
  };

  const handleSendTest = async () => {
    if (!campaign?.subject?.trim()) {
      toast.error("Subject is required");
      return;
    }
    if (!testEmail?.trim()) {
      toast.error("Test email is required");
      return;
    }

    setSendTestLoading(true);
    try {
      const response = await postData(
        "/api/newsletter/campaign/send",
        {
          mode: "test",
          testEmail,
          ...campaign,
        },
        token,
      );
      if (response?.success) {
        toast.success("Test newsletter sent");
      } else {
        toast.error(response?.message || "Failed to send test newsletter");
      }
    } catch (error) {
      console.error("Failed to send test newsletter:", error);
      toast.error("Failed to send test newsletter");
    } finally {
      setSendTestLoading(false);
    }
  };

  const handleSendBroadcast = async () => {
    if (!campaign?.subject?.trim()) {
      toast.error("Subject is required");
      return;
    }

    const limit = Number.parseInt(String(broadcastLimit || ""), 10);
    if (!Number.isFinite(limit) || limit <= 0) {
      toast.error("Broadcast limit must be a positive number");
      return;
    }

    if (!broadcastConfirm) {
      toast.error("Enable the confirmation switch before broadcasting");
      return;
    }

    const ok = confirm(
      `Send newsletter broadcast to up to ${limit} active subscribers?`,
    );
    if (!ok) return;

    setSendBroadcastLoading(true);
    try {
      const response = await postData(
        "/api/newsletter/campaign/send",
        {
          mode: "active",
          confirm: true,
          limit,
          ...campaign,
        },
        token,
      );

      if (response?.success) {
        const summary = response?.summary || {};
        toast.success(
          `Broadcast done: sent ${summary.sent || 0}/${summary.attempted || 0}`,
        );
      } else {
        toast.error(response?.message || "Failed to send broadcast");
      }
    } catch (error) {
      console.error("Failed to send newsletter broadcast:", error);
      toast.error("Failed to send broadcast");
    } finally {
      setSendBroadcastLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this subscriber?")) return;
    try {
      const response = await deleteData(`/api/newsletter/subscribers/${id}`, token);
      if (response.success) {
        toast.success("Subscriber deleted");
        fetchSubscribers();
      } else {
        toast.error(response.message || "Failed to delete subscriber");
      }
    } catch (error) {
      toast.error("Failed to delete subscriber");
    }
  };

  if (loading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Newsletter</h1>
          <p className="text-gray-500">Manage newsletter subscribers</p>
        </div>
        <div className="flex items-center gap-2">
          <Select
            size="small"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <MenuItem value="all">All</MenuItem>
            <MenuItem value="active">Active</MenuItem>
            <MenuItem value="inactive">Inactive</MenuItem>
          </Select>
          <Button variant="outlined" onClick={fetchSubscribers}>
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm p-5">
          <div className="flex items-center gap-2 mb-2">
            <MdMailOutline className="text-xl text-orange-500" />
            <h2 className="font-semibold text-gray-800">Subscribers</h2>
          </div>
          <p className="text-gray-600 text-sm">
            Total: {stats?.total || 0}
          </p>
          <p className="text-gray-600 text-sm">
            Active: {stats?.active || 0}
          </p>
          <p className="text-gray-600 text-sm">
            Inactive: {stats?.inactive || 0}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-5 mb-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">
              Campaign (Send Newsletter)
            </h2>
            <p className="text-sm text-gray-500">
              Save a template and send a test/broadcast to subscribers.
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Newsletter section on Blogs page can be edited in{" "}
              <Link href="/blogs-page" className="text-blue-600 hover:underline">
                Blogs Page
              </Link>
              .
            </p>
            {templateUpdatedAt ? (
              <p className="text-xs text-gray-400 mt-1">
                Last saved: {new Date(templateUpdatedAt).toLocaleString()}
              </p>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outlined"
              onClick={fetchTemplate}
              disabled={templateLoading}
            >
              {templateLoading ? "Loading..." : "Reload"}
            </Button>
            <Button
              variant="contained"
              onClick={handleSaveTemplate}
              disabled={templateSaving}
              sx={{ textTransform: "none" }}
            >
              {templateSaving ? "Saving..." : "Save Template"}
            </Button>
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

        <Divider className="!my-4" />

        <div className="grid grid-cols-1 gap-4">
          <TextField
            label="Subject"
            value={campaign.subject}
            onChange={(e) =>
              setCampaign((prev) => ({ ...prev, subject: e.target.value }))
            }
            fullWidth
            size="small"
          />
          <TextField
            label="Text (optional)"
            helperText="If HTML is empty, the server will generate a safe HTML email from this text."
            value={campaign.text}
            onChange={(e) =>
              setCampaign((prev) => ({ ...prev, text: e.target.value }))
            }
            fullWidth
            size="small"
            multiline
            minRows={4}
          />
          <TextField
            label="HTML (optional)"
            helperText="Paste raw HTML for the email body. Keep it lightweight."
            value={campaign.html}
            onChange={(e) =>
              setCampaign((prev) => ({ ...prev, html: e.target.value }))
            }
            inputRef={htmlRef}
            fullWidth
            size="small"
            multiline
            minRows={6}
          />

          {String(campaign.html || "").trim() ? (
            <div className="border rounded-lg p-3 bg-white max-h-[360px] overflow-auto">
              <div
                dangerouslySetInnerHTML={{ __html: String(campaign.html || "") }}
              />
            </div>
          ) : null}
        </div>

        <Divider className="!my-4" />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <TextField
            label="Send Test To"
            placeholder="name@domain.com"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            fullWidth
            size="small"
          />
          <Button
            variant="outlined"
            onClick={handleSendTest}
            disabled={sendTestLoading}
            sx={{ textTransform: "none", height: 40 }}
          >
            {sendTestLoading ? "Sending..." : "Send Test"}
          </Button>
          <div className="flex items-center gap-2">
            <TextField
              label="Broadcast Limit"
              type="number"
              value={broadcastLimit}
              onChange={(e) => setBroadcastLimit(e.target.value)}
              size="small"
              fullWidth
              inputProps={{ min: 1 }}
            />
            <Button
              variant="contained"
              color="warning"
              onClick={handleSendBroadcast}
              disabled={sendBroadcastLoading}
              sx={{ textTransform: "none", height: 40, whiteSpace: "nowrap" }}
            >
              {sendBroadcastLoading ? "Sending..." : "Send Broadcast"}
            </Button>
          </div>
        </div>

        <div className="mt-3">
          <FormControlLabel
            control={
              <Switch
                checked={broadcastConfirm}
                onChange={(e) => setBroadcastConfirm(e.target.checked)}
              />
            }
            label="I understand this will email real subscribers (required)"
          />
          <p className="text-xs text-gray-400">
            Broadcast is disabled by default on the server. To enable, set{" "}
            <span className="font-mono">NEWSLETTER_BROADCAST_ENABLED=true</span>.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-5">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <CircularProgress size={28} />
          </div>
        ) : subscribers.length === 0 ? (
          <div className="text-center py-10 text-gray-500">
            No subscribers found.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="text-left text-sm font-semibold text-gray-600 px-4 py-2">
                      Email
                    </th>
                    <th className="text-left text-sm font-semibold text-gray-600 px-4 py-2">
                      Status
                    </th>
                    <th className="text-left text-sm font-semibold text-gray-600 px-4 py-2">
                      Source
                    </th>
                    <th className="text-left text-sm font-semibold text-gray-600 px-4 py-2">
                      Subscribed At
                    </th>
                    <th className="text-left text-sm font-semibold text-gray-600 px-4 py-2">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {subscribers.map((subscriber) => (
                    <tr key={subscriber._id} className="border-b">
                      <td className="px-4 py-2 text-sm text-gray-700">
                        {subscriber.email}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-600">
                        {subscriber.isActive ? "Active" : "Inactive"}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-600">
                        {subscriber.source || "unknown"}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-600">
                        {subscriber.subscribedAt
                          ? new Date(subscriber.subscribedAt).toLocaleDateString()
                          : "-"}
                      </td>
                      <td className="px-4 py-2 text-sm">
                        <Button
                          size="small"
                          color="error"
                          onClick={() => handleDelete(subscriber._id)}
                        >
                          Delete
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-center py-6">
              <Pagination
                count={totalPages}
                page={page}
                onChange={(e, value) => setPage(value)}
                showFirstButton
                showLastButton
              />
            </div>
          </>
        )}
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
                  <div className="text-xs text-gray-500 mt-1">{p?._id}</div>
                </div>
              </button>
            ))}
            {!productLoading && productResults.length === 0 && (
              <div className="text-sm text-gray-500">Search to find products.</div>
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

export default NewsletterPage;
