"use client";

import { useAdmin } from "@/context/AdminContext";
import { getData, putData } from "@/utils/api";
import { Button, CircularProgress, TextField } from "@mui/material";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";

const EmailTemplatesPage = () => {
  const { token, isAuthenticated, loading } = useAdmin();
  const router = useRouter();

  const [subject, setSubject] = useState("Latest updates from HealthyOneGram");
  const [html, setHtml] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, loading, router]);

  useEffect(() => {
    const fetchTemplate = async () => {
      if (!token || !isAuthenticated) return;
      setIsLoading(true);
      const response = await getData("/api/newsletter/admin/template", token);
      if (response?.success && response?.data) {
        setSubject(response.data.subject || "Latest updates from HealthyOneGram");
        setHtml(response.data.html || "");
      } else {
        toast.error(response?.message || "Failed to load template");
      }
      setIsLoading(false);
    };

    fetchTemplate();
  }, [isAuthenticated, token]);

  const handleSave = async () => {
    if (isSaving) return;
    if (!String(subject || "").trim()) {
      toast.error("Subject is required");
      return;
    }
    if (!String(html || "").trim()) {
      toast.error("Template HTML is required");
      return;
    }

    setIsSaving(true);
    const response = await putData(
      "/api/newsletter/admin/template",
      { subject, html },
      token,
    );

    if (response?.success) {
      toast.success("Template saved");
    } else {
      toast.error(response?.message || "Failed to save template");
    }
    setIsSaving(false);
  };

  if (loading || !isAuthenticated || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <CircularProgress />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Email Templates</h1>
          <p className="text-gray-500">Edit, preview, and save email templates</p>
        </div>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={isSaving}
          sx={{ bgcolor: "#c1591c", "&:hover": { bgcolor: "#a04a15" } }}
        >
          {isSaving ? "Saving..." : "Save Template"}
        </Button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-5">
          <div className="space-y-4">
            <TextField
              label="Subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              fullWidth
              size="small"
            />
            <TextField
              label="HTML"
              value={html}
              onChange={(e) => setHtml(e.target.value)}
              multiline
              minRows={18}
              fullWidth
            />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-5">
          <p className="text-sm font-semibold text-gray-700 mb-3">Live Preview</p>
          <iframe
            title="Email Template Preview"
            srcDoc={html}
            className="w-full h-[560px] border border-gray-200 rounded-lg bg-white"
          />
        </div>
      </div>
    </div>
  );
};

export default EmailTemplatesPage;
