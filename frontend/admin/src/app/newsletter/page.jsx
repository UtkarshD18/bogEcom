"use client";

import { useAdmin } from "@/context/AdminContext";
import { deleteData, getData, postData, putData } from "@/utils/api";
import { Button, CircularProgress, MenuItem, Select, TextField } from "@mui/material";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { MdMailOutline } from "react-icons/md";
import Pagination from "@mui/material/Pagination";

const NewsletterPage = () => {
  const { token, isAuthenticated, loading } = useAdmin();
  const router = useRouter();

  const [subscribers, setSubscribers] = useState([]);
  const [stats, setStats] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [templateSubject, setTemplateSubject] = useState(
    "Latest updates from HealthyOneGram",
  );
  const [templateHtml, setTemplateHtml] = useState("");
  const [templateLoading, setTemplateLoading] = useState(true);
  const [templateSaving, setTemplateSaving] = useState(false);
  const [sendingBroadcast, setSendingBroadcast] = useState(false);

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
    const fetchTemplate = async () => {
      if (!isAuthenticated || !token) return;
      setTemplateLoading(true);
      const response = await getData("/api/newsletter/admin/template", token);
      if (response?.success && response?.data) {
        setTemplateSubject(
          response.data.subject || "Latest updates from HealthyOneGram",
        );
        setTemplateHtml(response.data.html || "");
      }
      setTemplateLoading(false);
    };

    fetchTemplate();
  }, [isAuthenticated, token]);

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

  const handleSaveTemplate = async () => {
    if (!String(templateSubject || "").trim()) {
      toast.error("Subject is required");
      return;
    }
    if (!String(templateHtml || "").trim()) {
      toast.error("Template HTML is required");
      return;
    }

    setTemplateSaving(true);
    const response = await putData(
      "/api/newsletter/admin/template",
      {
        subject: templateSubject,
        html: templateHtml,
      },
      token,
    );

    if (response?.success) {
      toast.success("Newsletter template saved");
    } else {
      toast.error(response?.message || "Failed to save template");
    }
    setTemplateSaving(false);
  };

  const handleSendBroadcast = async () => {
    if (!String(templateSubject || "").trim()) {
      toast.error("Subject is required");
      return;
    }
    if (!String(templateHtml || "").trim()) {
      toast.error("Template HTML is required");
      return;
    }

    if (!confirm("Send newsletter broadcast to subscribers now?")) return;

    setSendingBroadcast(true);
    const response = await postData(
      "/api/newsletter/admin/send-broadcast",
      {
        subject: templateSubject,
        html: templateHtml,
        status: "active",
      },
      token,
    );

    if (response?.success) {
      const result = response?.data || {};
      toast.success(
        `Broadcast done: ${result.sent || 0} sent, ${result.failed || 0} failed`,
      );
    } else {
      toast.error(response?.message || "Broadcast failed");
    }
    setSendingBroadcast(false);
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
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">
              Newsletter HTML Editor
            </h2>
            <p className="text-sm text-gray-500">
              Save template and preview before broadcast.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outlined"
              onClick={handleSaveTemplate}
              disabled={templateSaving || templateLoading}
            >
              {templateSaving ? "Saving..." : "Save Template"}
            </Button>
            <Button
              variant="contained"
              onClick={handleSendBroadcast}
              disabled={sendingBroadcast || templateLoading}
              sx={{ bgcolor: "#c1591c", "&:hover": { bgcolor: "#a04a15" } }}
            >
              {sendingBroadcast ? "Sending..." : "Send Broadcast"}
            </Button>
          </div>
        </div>

        {templateLoading ? (
          <div className="flex justify-center py-8">
            <CircularProgress size={26} />
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="space-y-3">
              <TextField
                label="Subject"
                value={templateSubject}
                onChange={(e) => setTemplateSubject(e.target.value)}
                fullWidth
                size="small"
              />
              <TextField
                label="HTML"
                value={templateHtml}
                onChange={(e) => setTemplateHtml(e.target.value)}
                multiline
                minRows={14}
                fullWidth
              />
            </div>

            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2">Preview</p>
              <iframe
                title="Newsletter Preview"
                srcDoc={templateHtml}
                className="w-full h-[430px] border border-gray-200 rounded-lg bg-white"
              />
            </div>
          </div>
        )}
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
    </div>
  );
};

export default NewsletterPage;
