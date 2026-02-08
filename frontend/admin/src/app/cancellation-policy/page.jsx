"use client";

import { useAdmin } from "@/context/AdminContext";
import { getData, putData } from "@/utils/api";
import { Button, CircularProgress, TextField } from "@mui/material";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { MdInfo, MdSave } from "react-icons/md";

/**
 * Admin CMS - Cancellation Policy Editor
 * Allows admin to edit the cancellation and return policy
 */
const CancellationPolicyAdmin = () => {
  const { token, isAuthenticated, loading } = useAdmin();
  const router = useRouter();

  const [content, setContent] = useState("");
  const [originalContent, setOriginalContent] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch current policy
  const fetchPolicy = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await getData("/api/cancellation/admin", token);
      if (response.success) {
        const policyContent = response.data.content || "";
        setContent(policyContent);
        setOriginalContent(policyContent);
      } else {
        toast.error("Failed to load cancellation policy");
      }
    } catch (error) {
      console.error("Failed to fetch policy:", error);
      toast.error("Failed to load cancellation policy");
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
      fetchPolicy();
    }
  }, [isAuthenticated, token, fetchPolicy]);

  // Track changes
  useEffect(() => {
    setHasChanges(content !== originalContent);
  }, [content, originalContent]);

  const handleSave = async () => {
    if (!content.trim()) {
      toast.error("Content cannot be empty");
      return;
    }

    setIsSaving(true);
    try {
      const response = await putData(
        "/api/cancellation/admin",
        { content },
        token,
      );

      if (response.success) {
        toast.success("Cancellation policy updated successfully");
        setOriginalContent(content);
        setHasChanges(false);
      } else {
        toast.error(response.message || "Failed to update policy");
      }
    } catch (error) {
      console.error("Failed to save policy:", error);
      toast.error("Failed to update policy");
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    if (hasChanges && !confirm("Discard unsaved changes?")) {
      return;
    }
    setContent(originalContent);
  };

  if (loading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <CircularProgress />
      </div>
    );
  }

  if (isLoading) {
    return (
      <section className="w-full py-3 px-5">
        <div className="flex items-center justify-center py-12">
          <CircularProgress />
        </div>
      </section>
    );
  }

  return (
    <section className="w-full py-3 px-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-[18px] text-gray-700 font-[600] mb-1">
            Cancellation & Return Policy
          </h2>
          <p className="text-sm text-gray-500">
            Manage the cancellation and return policy content
          </p>
        </div>
        <div className="flex gap-2">
          {hasChanges && (
            <Button
              onClick={handleReset}
              variant="outlined"
              disabled={isSaving}
              className="!text-gray-600 !border-gray-300"
            >
              Reset
            </Button>
          )}
          <Button
            onClick={handleSave}
            disabled={!hasChanges || isSaving}
            startIcon={isSaving ? <CircularProgress size={16} /> : <MdSave />}
            className="!bg-blue-600 !text-white !px-4 !py-2 !rounded-md hover:!bg-blue-700 disabled:!bg-gray-300"
          >
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 flex items-start gap-3">
        <MdInfo className="text-blue-600 text-xl mt-0.5 flex-shrink-0" />
        <div>
          <h3 className="font-semibold text-gray-800 text-sm mb-1">
            Information
          </h3>
          <p className="text-sm text-gray-600">
            This content will be displayed on the public cancellation & return
            policy page. Customers can access it from the footer and legal
            sections.
          </p>
        </div>
      </div>

      {/* Editor */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <TextField
          fullWidth
          multiline
          rows={20}
          variant="outlined"
          label="Policy Content"
          placeholder="Enter cancellation policy content..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          helperText={`${content.length} characters | Plain text and basic formatting supported`}
          sx={{
            "& .MuiOutlinedInput-root": {
              fontFamily: "monospace",
              fontSize: "14px",
              lineHeight: "1.6",
            },
          }}
        />
      </div>
    </section>
  );
};

export default CancellationPolicyAdmin;
