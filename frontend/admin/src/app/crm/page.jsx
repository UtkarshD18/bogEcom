"use client";

import { useAdmin } from "@/context/AdminContext";
import {
  fetchCrmContactTimeline,
  fetchCrmContacts,
  fetchCrmOverview,
  fetchCrmWhatsappAudiencePreview,
  fetchCrmWhatsappOverview,
  fetchCrmWhatsappTemplates,
  sendCrmWhatsappCampaign,
  sendCrmWhatsappMessage,
  updateCrmContact,
} from "@/services/crmApi";
import { uploadFile, uploadVideoFile } from "@/utils/api";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Pagination,
  TextField,
} from "@mui/material";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "react-hot-toast";

const CHANNEL_OPTIONS = [
  { value: "", label: "All Channels" },
  { value: "website", label: "Website" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "facebook", label: "Facebook" },
  { value: "instagram", label: "Instagram" },
  { value: "email", label: "Email" },
  { value: "push", label: "Push" },
  { value: "support", label: "Support" },
  { value: "phone", label: "Phone" },
  { value: "admin", label: "Admin" },
  { value: "other", label: "Other" },
];

const LIFECYCLE_OPTIONS = [
  { value: "", label: "All Stages" },
  { value: "lead", label: "Lead" },
  { value: "prospect", label: "Prospect" },
  { value: "customer", label: "Customer" },
  { value: "repeat_customer", label: "Repeat Customer" },
  { value: "inactive", label: "Inactive" },
];

const STATUS_OPTIONS = [
  { value: "", label: "All Statuses" },
  { value: "open", label: "Open" },
  { value: "contacted", label: "Contacted" },
  { value: "qualified", label: "Qualified" },
  { value: "converted", label: "Converted" },
  { value: "lost", label: "Lost" },
];

const WHATSAPP_SEGMENT_OPTIONS = [
  { value: "all", label: "All Consented Contacts" },
  { value: "leads", label: "Leads & Prospects" },
  { value: "customers", label: "Customers" },
  { value: "repeat_customers", label: "Repeat Customers" },
  { value: "inactive", label: "Inactive Contacts" },
  { value: "vip", label: "VIP Tagged Contacts" },
];

const CONSENT_OPTIONS = [
  { value: "unknown", label: "Unknown" },
  { value: "true", label: "Allowed" },
  { value: "false", label: "Blocked" },
];

const DEFAULT_CONFIRMATION_DIALOG = {
  open: false,
  action: "personal",
  title: "",
  description: "",
  confirmLabel: "Confirm",
  warning: "",
  highlights: [],
  payload: null,
};

const prettifyValue = (value = "") =>
  String(value || "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

const formatDateTime = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

const formatCurrency = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

const stageBadgeClass = (value) => {
  if (value === "customer" || value === "repeat_customer") {
    return "bg-emerald-100 text-emerald-700";
  }
  if (value === "prospect") return "bg-amber-100 text-amber-700";
  if (value === "inactive") return "bg-slate-200 text-slate-700";
  return "bg-blue-100 text-blue-700";
};

const statusBadgeClass = (value) => {
  if (value === "converted") return "bg-emerald-100 text-emerald-700";
  if (value === "qualified") return "bg-cyan-100 text-cyan-700";
  if (value === "contacted") return "bg-amber-100 text-amber-700";
  if (value === "lost") return "bg-rose-100 text-rose-700";
  return "bg-slate-100 text-slate-700";
};

const directionBadgeClass = (value) => {
  if (value === "inbound") return "bg-emerald-100 text-emerald-700";
  if (value === "outbound") return "bg-sky-100 text-sky-700";
  return "bg-slate-100 text-slate-700";
};

const whatsappStatusClass = (value) => {
  if (value === "read") return "bg-emerald-100 text-emerald-700";
  if (value === "delivered" || value === "sent") return "bg-sky-100 text-sky-700";
  if (value === "failed") return "bg-rose-100 text-rose-700";
  return "bg-slate-100 text-slate-700";
};

const consentBadgeClass = (value) => {
  if (value === true) return "bg-emerald-100 text-emerald-700";
  if (value === false) return "bg-rose-100 text-rose-700";
  return "bg-slate-100 text-slate-600";
};

const resolveTimelineSummary = (item = {}) => {
  if (item.message) return item.message;
  if (item?.metadata?.status) return `Status: ${prettifyValue(item.metadata.status)}`;
  if (item.pageUrl) return item.pageUrl;
  if (item.referrer) return item.referrer;
  return "No extra details.";
};

const resolveTimelineMetaTags = (item = {}) => {
  const tags = [];

  if (item.direction) {
    tags.push({
      label: prettifyValue(item.direction),
      className: directionBadgeClass(item.direction),
    });
  }

  if (item?.metadata?.status) {
    tags.push({
      label: prettifyValue(item.metadata.status),
      className: whatsappStatusClass(item.metadata.status),
    });
  }

  if (item?.metadata?.templateName) {
    tags.push({
      label: `Template: ${item.metadata.templateName}`,
      className: "bg-fuchsia-100 text-fuchsia-700",
    });
  }

  if (item?.campaign?.campaign) {
    tags.push({
      label: `Campaign: ${item.campaign.campaign}`,
      className: "bg-orange-100 text-orange-700",
    });
  }

  return tags;
};

const parseVariableInput = (value = "") =>
  String(value || "")
    .split(/[\n,]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);

const getConfigTone = (ready) =>
  ready
    ? "bg-emerald-100 text-emerald-700"
    : "bg-amber-100 text-amber-700";

const getWhatsappHealthTone = (state = "unknown") => {
  if (state === "ready") return "bg-emerald-100 text-emerald-700";
  if (state === "sender_warning") return "bg-amber-100 text-amber-700";
  if (["token_expired", "invalid_token", "auth_failed", "permission_denied"].includes(state)) {
    return "bg-rose-100 text-rose-700";
  }
  return "bg-amber-100 text-amber-700";
};

const getWhatsappHealthPanelTone = (state = "unknown") => {
  if (state === "ready") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (state === "sender_warning") return "border-amber-200 bg-amber-50 text-amber-700";
  if (["token_expired", "invalid_token", "auth_failed", "permission_denied"].includes(state)) {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }
  return "border-amber-200 bg-amber-50 text-amber-700";
};

const getWhatsappHealthLabel = (state = "unknown") => {
  if (state === "ready") return "Connected";
  if (state === "sender_warning") return "Sender Warning";
  if (state === "token_expired") return "Token Expired";
  if (state === "invalid_token") return "Auth Invalid";
  if (state === "permission_denied") return "Permission Denied";
  if (state === "auth_failed") return "Auth Failed";
  if (state === "not_configured") return "Needs Config";
  return "Check Needed";
};

const formatWhatsappHealthField = (value, fallback = "Unknown") =>
  value ? prettifyValue(value) : fallback;

const normalizeConsentDraftValue = (value) => {
  if (value === true || value === "true") return "true";
  if (value === false || value === "false") return "false";
  return "unknown";
};

const parseConsentDraftValue = (value) => {
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
};

const findTemplateByName = (templates = [], templateName = "") =>
  (Array.isArray(templates) ? templates : []).find(
    (template) => template.name === templateName,
  ) || null;

const resolveTemplateLanguageCode = (
  templates = [],
  templateName = "",
  fallback = "en",
) => findTemplateByName(templates, templateName)?.language || fallback;

const truncateForPreview = (value = "", maxLength = 140) => {
  const normalized = String(value || "").trim();
  if (!normalized) return "-";
  return normalized.length > maxLength
    ? `${normalized.slice(0, maxLength - 3)}...`
    : normalized;
};

const CrmPage = () => {
  const { token, isAuthenticated, loading } = useAdmin();
  const router = useRouter();

  const [overview, setOverview] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [selectedContact, setSelectedContact] = useState(null);
  const [selectedContactId, setSelectedContactId] = useState("");
  const [timeline, setTimeline] = useState([]);
  const [recentOrders, setRecentOrders] = useState([]);
  const [whatsappOverview, setWhatsappOverview] = useState(null);
  const [whatsappTemplates, setWhatsappTemplates] = useState([]);
  const [audiencePreview, setAudiencePreview] = useState({
    count: 0,
    sample: [],
  });
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [whatsappLoading, setWhatsappLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [sendingPersonalWhatsapp, setSendingPersonalWhatsapp] = useState(false);
  const [sendingCampaignWhatsapp, setSendingCampaignWhatsapp] = useState(false);
  const [uploadingWhatsappMedia, setUploadingWhatsappMedia] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filters, setFilters] = useState({
    q: "",
    channel: "",
    lifecycleStage: "",
    status: "",
  });
  const [draft, setDraft] = useState({
    lifecycleStage: "lead",
    status: "open",
    sourceChannel: "website",
    tags: "",
    consentWhatsapp: "unknown",
    consentEmail: "unknown",
    consentPush: "unknown",
  });
  const [personalWhatsappForm, setPersonalWhatsappForm] = useState({
    mode: "text",
    body: "",
    templateName: "",
    languageCode: "en",
    bodyVariables: "",
    headerVariables: "",
    mediaUrl: "",
    mediaCaption: "",
    mediaFilename: "",
    campaignName: "",
  });
  const [campaignForm, setCampaignForm] = useState({
    segment: "all",
    inactiveDays: "45",
    templateName: "",
    languageCode: "en",
    bodyVariables: "",
    headerVariables: "",
    campaignName: "WhatsApp promotional campaign",
  });
  const [confirmationDialog, setConfirmationDialog] = useState(
    DEFAULT_CONFIRMATION_DIALOG,
  );
  const [lastWhatsappSubmission, setLastWhatsappSubmission] = useState(null);
  const selectedContactIdRef = useRef("");

  const applySelectedContact = useCallback((contact) => {
    selectedContactIdRef.current = String(contact?.id || "");
    setSelectedContact(contact || null);
    setSelectedContactId(String(contact?.id || ""));
    setRecentOrders([]);
    setDraft({
      lifecycleStage: contact?.lifecycleStage || "lead",
      status: contact?.status || "open",
      sourceChannel: contact?.sourceChannel || "website",
      tags: Array.isArray(contact?.tags) ? contact.tags.join(", ") : "",
      consentWhatsapp: normalizeConsentDraftValue(contact?.consent?.whatsapp),
      consentEmail: normalizeConsentDraftValue(contact?.consent?.email),
      consentPush: normalizeConsentDraftValue(contact?.consent?.push),
    });
  }, []);

  const closeConfirmationDialog = useCallback(() => {
    setConfirmationDialog(DEFAULT_CONFIRMATION_DIALOG);
  }, []);

  const setPersonalTemplateSelection = useCallback(
    (templateName) => {
      setPersonalWhatsappForm((prev) => ({
        ...prev,
        templateName,
        languageCode: resolveTemplateLanguageCode(
          whatsappTemplates,
          templateName,
          prev.languageCode || "en",
        ),
      }));
    },
    [whatsappTemplates],
  );

  const setCampaignTemplateSelection = useCallback(
    (templateName) => {
      setCampaignForm((prev) => ({
        ...prev,
        templateName,
        languageCode: resolveTemplateLanguageCode(
          whatsappTemplates,
          templateName,
          prev.languageCode || "en",
        ),
      }));
    },
    [whatsappTemplates],
  );

  const loadOverview = useCallback(async () => {
    const response = await fetchCrmOverview(token);
    if (!response?.success) {
      throw new Error(response?.message || "Failed to load CRM overview.");
    }
    setOverview(response.data || null);
  }, [token]);

  const loadContacts = useCallback(async ({ overridePage } = {}) => {
    setIsLoading(true);
    try {
      const response = await fetchCrmContacts(
        {
          page: overridePage || page,
          limit: 20,
          filters,
        },
        token,
      );

      if (!response?.success) {
        throw new Error(response?.message || "Failed to load CRM contacts.");
      }

      const nextContacts = Array.isArray(response.data?.contacts)
        ? response.data.contacts
        : [];
      const nextPagination = response.data?.pagination || {};

      setContacts(nextContacts);
      const totalPagesValue = Math.max(Number(nextPagination.totalPages || 1), 1);
      setTotalPages(totalPagesValue);

      if (
        totalPagesValue > 0 &&
        Number(nextPagination.page || overridePage || page || 1) > totalPagesValue
      ) {
        setPage(totalPagesValue);
        return;
      }

      if (nextContacts.length === 0) {
        applySelectedContact(null);
        return;
      }

      const matchingSelected = nextContacts.find(
        (entry) => String(entry.id) === String(selectedContactIdRef.current || ""),
      );
      applySelectedContact(matchingSelected || nextContacts[0]);
    } catch (error) {
      setContacts([]);
      setTotalPages(1);
      applySelectedContact(null);
      toast.error(error?.message || "Failed to load CRM contacts.");
    } finally {
      setIsLoading(false);
    }
  }, [applySelectedContact, filters, page, token]);

  const loadTimeline = useCallback(async () => {
    if (!selectedContactId || !token) {
      setTimeline([]);
      setRecentOrders([]);
      return;
    }

    setTimelineLoading(true);
    try {
      const response = await fetchCrmContactTimeline(
        selectedContactId,
        { page: 1, limit: 40 },
        token,
      );

      if (!response?.success) {
        throw new Error(response?.message || "Failed to load CRM timeline.");
      }

      const contact = response.data?.contact || null;
      const interactions = Array.isArray(response.data?.interactions)
        ? response.data.interactions
        : [];
      const nextRecentOrders = Array.isArray(response.data?.recentOrders)
        ? response.data.recentOrders
        : [];

      if (contact) {
        applySelectedContact(contact);
      }

      setTimeline(interactions);
      setRecentOrders(nextRecentOrders);
    } catch (error) {
      setTimeline([]);
      setRecentOrders([]);
      toast.error(error?.message || "Failed to load CRM timeline.");
    } finally {
      setTimelineLoading(false);
    }
  }, [applySelectedContact, selectedContactId, token]);

  const loadWhatsappWorkspace = useCallback(async () => {
    setWhatsappLoading(true);
    try {
      const [overviewResponse, templatesResponse] = await Promise.all([
        fetchCrmWhatsappOverview(token),
        fetchCrmWhatsappTemplates(token),
      ]);

      if (!overviewResponse?.success) {
        throw new Error(
          overviewResponse?.message || "Failed to load WhatsApp CRM overview.",
        );
      }

      setWhatsappOverview(overviewResponse.data || null);

      if (templatesResponse?.success) {
        const templates = Array.isArray(templatesResponse.data?.templates)
          ? templatesResponse.data.templates
          : [];
        setWhatsappTemplates(templates);

        if (templates.length > 0) {
          setPersonalWhatsappForm((prev) => {
            const defaultPersonalTemplate =
              findTemplateByName(templates, prev.templateName) || templates[0];
            return {
              ...prev,
              templateName: defaultPersonalTemplate?.name || prev.templateName || "",
              languageCode:
                defaultPersonalTemplate?.language || prev.languageCode || "en",
            };
          });
          setCampaignForm((prev) => {
            const defaultCampaignTemplate =
              findTemplateByName(templates, prev.templateName) || templates[0];
            return {
              ...prev,
              templateName: defaultCampaignTemplate?.name || prev.templateName || "",
              languageCode:
                defaultCampaignTemplate?.language || prev.languageCode || "en",
            };
          });
        }
      } else {
        setWhatsappTemplates([]);
      }
    } catch (error) {
      setWhatsappOverview(null);
      setWhatsappTemplates([]);
      toast.error(error?.message || "Failed to load WhatsApp CRM workspace.");
    } finally {
      setWhatsappLoading(false);
    }
  }, [token]);

  const loadAudiencePreview = useCallback(async () => {
    if (!token) return;
    const response = await fetchCrmWhatsappAudiencePreview(
      {
        segment: campaignForm.segment,
        inactiveDays: campaignForm.inactiveDays,
      },
      token,
    );

    if (!response?.success) {
      throw new Error(response?.message || "Failed to preview WhatsApp audience.");
    }

    setAudiencePreview(response.data || { count: 0, sample: [] });
  }, [campaignForm.inactiveDays, campaignForm.segment, token]);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, loading, router]);

  useEffect(() => {
    if (!isAuthenticated || !token) return;

    Promise.all([loadOverview(), loadContacts(), loadWhatsappWorkspace()]).catch(
      (error) => {
        toast.error(error?.message || "Failed to load CRM dashboard.");
      },
    );
  }, [isAuthenticated, token, loadContacts, loadOverview, loadWhatsappWorkspace]);

  useEffect(() => {
    if (!isAuthenticated || !token) return;

    loadAudiencePreview().catch((error) => {
      toast.error(error?.message || "Failed to preview WhatsApp audience.");
    });
  }, [isAuthenticated, token, loadAudiencePreview]);

  useEffect(() => {
    if (isAuthenticated && token && selectedContactId) {
      loadTimeline();
    }
  }, [isAuthenticated, token, selectedContactId, loadTimeline]);

  useEffect(() => {
    selectedContactIdRef.current = String(selectedContactId || "");
  }, [selectedContactId]);

  const handleFilterChange = (event) => {
    const { name, value } = event.target;
    setPage(1);
    setFilters((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const clearFilters = () => {
    setPage(1);
    setFilters({
      q: "",
      channel: "",
      lifecycleStage: "",
      status: "",
    });
  };

  const handleRefreshContacts = async () => {
    if (!token) return;
    setPage(1);
    await loadContacts({ overridePage: 1 });
  };

  const refreshAdminCrmData = async () => {
    await Promise.all([
      loadOverview(),
      loadContacts(),
      loadTimeline(),
      loadWhatsappWorkspace(),
      loadAudiencePreview(),
    ]);
  };

  const handleSaveContact = async () => {
    if (!selectedContactId || !token) return;

    setIsSaving(true);
    try {
      const response = await updateCrmContact(
        selectedContactId,
        {
          lifecycleStage: draft.lifecycleStage,
          status: draft.status,
          sourceChannel: draft.sourceChannel,
          tags: draft.tags,
          consent: {
            whatsapp: parseConsentDraftValue(draft.consentWhatsapp),
            email: parseConsentDraftValue(draft.consentEmail),
            push: parseConsentDraftValue(draft.consentPush),
          },
        },
        token,
      );

      if (!response?.success) {
        throw new Error(response?.message || "Failed to update CRM contact.");
      }

      toast.success("CRM contact updated.");
      await Promise.all([loadOverview(), loadContacts(), loadTimeline()]);
    } catch (error) {
      toast.error(error?.message || "Failed to update CRM contact.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleWhatsappMediaUpload = async (event) => {
    const file = event?.target?.files?.[0];
    if (!file || !token) return;

    const isGifMode = personalWhatsappForm.mode === "gif";
    const isImageMode = personalWhatsappForm.mode === "image";

    if (!isGifMode && !isImageMode) {
      toast.error("Switch send mode to Image or GIF before uploading media.");
      event.target.value = "";
      return;
    }

    const fileType = String(file.type || "").toLowerCase();
    const fileName = String(file.name || "").toLowerCase();
    const isGifFile = fileType === "image/gif" || fileName.endsWith(".gif");
    const isVideoFile = fileType.startsWith("video/");

    if (isImageMode && !fileType.startsWith("image/")) {
      toast.error("Image mode accepts image files only.");
      event.target.value = "";
      return;
    }

    if (isGifMode && !isGifFile && !isVideoFile) {
      toast.error("GIF mode accepts GIF, MP4, or WebM files.");
      event.target.value = "";
      return;
    }

    setUploadingWhatsappMedia(true);
    try {
      const response = isVideoFile
        ? await uploadVideoFile(file, token)
        : await uploadFile(file, token);

      if (!response?.success) {
        throw new Error(response?.message || "Media upload failed.");
      }

      const uploadedUrl =
        response?.data?.url ||
        (Array.isArray(response?.data) ? response.data[0]?.url : "") ||
        "";

      if (!uploadedUrl) {
        throw new Error("Upload succeeded but no media URL was returned.");
      }

      setPersonalWhatsappForm((prev) => ({
        ...prev,
        mediaUrl: uploadedUrl,
        mediaFilename: file.name || prev.mediaFilename,
      }));

      toast.success("Media uploaded. Ready to send on WhatsApp.");
    } catch (error) {
      toast.error(error?.message || "Failed to upload media.");
    } finally {
      setUploadingWhatsappMedia(false);
      event.target.value = "";
    }
  };

  const buildPersonalWhatsappPayload = () => {
    const isTextMode = personalWhatsappForm.mode === "text";
    const isTemplateMode = personalWhatsappForm.mode === "template";
    const isMediaMode =
      personalWhatsappForm.mode === "image" || personalWhatsappForm.mode === "gif";
    const bodyVariables = parseVariableInput(personalWhatsappForm.bodyVariables);
    const headerVariables = parseVariableInput(personalWhatsappForm.headerVariables);
    const resolvedLanguageCode = isTemplateMode
      ? resolveTemplateLanguageCode(
          whatsappTemplates,
          personalWhatsappForm.templateName,
          personalWhatsappForm.languageCode || "en",
        )
      : personalWhatsappForm.languageCode;

    if (!selectedContactId || !token) {
      throw new Error("Select a CRM contact before sending WhatsApp.");
    }

    if (!selectedContact?.phone) {
      throw new Error("Selected CRM contact does not have a WhatsApp-ready phone number.");
    }

    if (selectedContact?.consent?.whatsapp === false) {
      throw new Error(
        "This CRM contact has WhatsApp consent disabled. Re-enable consent before sending.",
      );
    }

    if (isTextMode && !String(personalWhatsappForm.body).trim()) {
      throw new Error("Write a message before sending a personal WhatsApp reply.");
    }

    if (isTemplateMode && !String(personalWhatsappForm.templateName).trim()) {
      throw new Error("Choose an approved WhatsApp template first.");
    }

    if (isMediaMode && !String(personalWhatsappForm.mediaUrl).trim()) {
      throw new Error("Upload media before sending.");
    }

    return {
      mode: personalWhatsappForm.mode,
      body: isTextMode ? personalWhatsappForm.body : "",
      templateName: isTemplateMode ? personalWhatsappForm.templateName : "",
      languageCode: resolvedLanguageCode,
      bodyVariables,
      headerVariables,
      mediaType: isMediaMode ? personalWhatsappForm.mode : "",
      mediaUrl: isMediaMode ? personalWhatsappForm.mediaUrl : "",
      mediaCaption: isMediaMode ? personalWhatsappForm.mediaCaption : "",
      mediaFilename: isMediaMode ? personalWhatsappForm.mediaFilename : "",
      campaignName: personalWhatsappForm.campaignName,
    };
  };

  const executePersonalWhatsappSend = async (payload) => {
    setSendingPersonalWhatsapp(true);
    try {
      const response = await sendCrmWhatsappMessage(selectedContactId, payload, token);

      if (!response?.success) {
        throw new Error(response?.message || "Failed to send WhatsApp message.");
      }

      const result = response.data || {};
      setLastWhatsappSubmission({
        scope: "personal",
        submittedAt: new Date().toISOString(),
        mode: result.mode || payload.mode,
        phone: result.to || selectedContact?.phone || "",
        messageId: result.messageId || "",
        templateName: result.templateName || payload.templateName || "",
        languageCode: result.languageCode || payload.languageCode || "",
      });
      toast.success(
        `WhatsApp ${prettifyValue(result.mode || payload.mode)} submitted to ${
          result.to || selectedContact?.phone || "the selected contact"
        }.`,
      );
      setPersonalWhatsappForm((prev) => ({
        ...prev,
        body: "",
        bodyVariables: "",
        headerVariables: "",
        mediaUrl: "",
        mediaCaption: "",
        mediaFilename: "",
      }));
      await refreshAdminCrmData();
      return true;
    } catch (error) {
      toast.error(error?.message || "Failed to send WhatsApp message.");
      return false;
    } finally {
      setSendingPersonalWhatsapp(false);
    }
  };

  const handleSendPersonalWhatsapp = () => {
    try {
      const payload = buildPersonalWhatsappPayload();
      const highlights = [
        {
          label: "Recipient",
          value: selectedContact?.phone || "No phone",
        },
        {
          label: "Mode",
          value: prettifyValue(payload.mode),
        },
      ];

      if (payload.mode === "template") {
        highlights.push(
          {
            label: "Template",
            value: payload.templateName,
          },
          {
            label: "Language",
            value: payload.languageCode,
          },
          {
            label: "Variables",
            value: `${payload.headerVariables.length} header / ${payload.bodyVariables.length} body`,
          },
        );
      } else if (payload.mode === "text") {
        highlights.push({
          label: "Message Preview",
          value: truncateForPreview(payload.body),
        });
      } else {
        highlights.push(
          {
            label: "Media",
            value: truncateForPreview(payload.mediaFilename || "Uploaded media"),
          },
          {
            label: "Caption",
            value: truncateForPreview(payload.mediaCaption),
          },
        );
      }

      if (payload.campaignName) {
        highlights.push({
          label: "Label",
          value: payload.campaignName,
        });
      }

      setConfirmationDialog({
        open: true,
        action: "personal",
        title: "Confirm WhatsApp Message",
        description:
          "Review the outbound WhatsApp payload before it is submitted through Meta.",
        confirmLabel: "Send Message",
        warning: whatsappDeliveryReady
          ? ""
          : "Meta still reports sender verification or display-name warnings. The API can accept this send while delivery still fails later.",
        highlights,
        payload,
      });
    } catch (error) {
      toast.error(error?.message || "Failed to prepare WhatsApp message.");
    }
  };

  const buildCampaignWhatsappPayload = () => {
    const audienceCount = Number(audiencePreview?.count || 0);
    const resolvedLanguageCode = resolveTemplateLanguageCode(
      whatsappTemplates,
      campaignForm.templateName,
      campaignForm.languageCode || "en",
    );

    if (!token) {
      throw new Error("Admin session expired. Log in again before sending campaigns.");
    }

    if (!String(campaignForm.templateName).trim()) {
      throw new Error("Select an approved template for the WhatsApp campaign.");
    }

    if (audienceCount <= 0) {
      throw new Error("Campaign audience preview is empty. Refresh the preview first.");
    }

    return {
      segment: campaignForm.segment,
      inactiveDays: campaignForm.inactiveDays,
      templateName: campaignForm.templateName,
      languageCode: resolvedLanguageCode,
      bodyVariables: parseVariableInput(campaignForm.bodyVariables),
      headerVariables: parseVariableInput(campaignForm.headerVariables),
      campaignName: campaignForm.campaignName,
    };
  };

  const executeWhatsappCampaign = async (payload) => {
    setSendingCampaignWhatsapp(true);
    try {
      const response = await sendCrmWhatsappCampaign(payload, token);

      if (!response?.success) {
        throw new Error(response?.message || "Failed to send WhatsApp campaign.");
      }

      const campaignResult = response.data || {};
      setLastWhatsappSubmission({
        scope: "campaign",
        submittedAt: new Date().toISOString(),
        templateName: payload.templateName,
        languageCode: payload.languageCode,
        segment: payload.segment,
        attempted: Number(campaignResult.attempted || 0),
        sent: Number(campaignResult.sent || 0),
        failed: Number(campaignResult.failed || 0),
      });
      toast.success(
        `WhatsApp campaign processed. Sent ${campaignResult.sent || 0} / ${
          campaignResult.attempted || 0
        }.`,
      );
      await refreshAdminCrmData();
      return true;
    } catch (error) {
      toast.error(error?.message || "Failed to send WhatsApp campaign.");
      return false;
    } finally {
      setSendingCampaignWhatsapp(false);
    }
  };

  const handleSendWhatsappCampaign = () => {
    try {
      const payload = buildCampaignWhatsappPayload();
      setConfirmationDialog({
        open: true,
        action: "campaign",
        title: "Confirm WhatsApp Campaign",
        description:
          "This will submit a template campaign to the previewed consented CRM audience.",
        confirmLabel: "Send Campaign",
        warning: whatsappDeliveryReady
          ? ""
          : "Meta still reports sender verification or display-name warnings. Campaign API calls can succeed while delivery later fails for some recipients.",
        highlights: [
          {
            label: "Audience",
            value: `${Number(audiencePreview?.count || 0)} contacts`,
          },
          {
            label: "Segment",
            value: prettifyValue(payload.segment),
          },
          {
            label: "Template",
            value: payload.templateName,
          },
          {
            label: "Language",
            value: payload.languageCode,
          },
          {
            label: "Variables",
            value: `${payload.headerVariables.length} header / ${payload.bodyVariables.length} body`,
          },
          {
            label: "Label",
            value: payload.campaignName || "No campaign label",
          },
        ],
        payload,
      });
    } catch (error) {
      toast.error(error?.message || "Failed to prepare WhatsApp campaign.");
    }
  };

  const handleConfirmWhatsappAction = async () => {
    if (!confirmationDialog?.payload) return;

    const wasSuccessful =
      confirmationDialog.action === "personal"
        ? await executePersonalWhatsappSend(confirmationDialog.payload)
        : await executeWhatsappCampaign(confirmationDialog.payload);

    if (wasSuccessful) {
      closeConfirmationDialog();
    }
  };

  if (loading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const summaryCards = [
    {
      label: "Total Contacts",
      value: Number(overview?.summary?.totalContacts || 0),
      tone: "from-slate-900 via-slate-800 to-slate-700",
    },
    {
      label: "Customers",
      value: Number(overview?.summary?.totalCustomers || 0),
      tone: "from-emerald-700 via-emerald-600 to-emerald-500",
    },
    {
      label: "Open Leads",
      value: Number(overview?.summary?.openLeads || 0),
      tone: "from-amber-700 via-amber-600 to-orange-500",
    },
    {
      label: "Active 30 Days",
      value: Number(overview?.summary?.activeLast30Days || 0),
      tone: "from-cyan-700 via-sky-600 to-blue-500",
    },
  ];

  const selectedWhatsappStatus = timeline.find(
    (item) => item.channel === "whatsapp" && item?.metadata?.status,
  );
  const hasSelectedWhatsappConversation = timeline.some(
    (item) => item.channel === "whatsapp",
  );
  const whatsappHealth = whatsappOverview?.configuration?.health || null;
  const whatsappHealthState =
    whatsappHealth?.state ||
    (whatsappOverview?.configuration?.messagingReady ? "ready" : "not_configured");
  const whatsappApiReady = Boolean(
    whatsappOverview?.configuration?.messagingReady &&
      (whatsappHealth ? whatsappHealth.ok : true),
  );
  const whatsappDeliveryReady =
    whatsappHealth?.deliveryReady !== undefined
      ? Boolean(whatsappHealth.deliveryReady)
      : whatsappHealthState === "ready";

  return (
    <section className="w-full p-5 space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {summaryCards.map((card) => (
          <div
            key={card.label}
            className={`rounded-2xl bg-gradient-to-br ${card.tone} text-white p-5 shadow-lg`}
          >
            <p className="text-sm text-white/80">{card.label}</p>
            <h2 className="text-3xl font-semibold mt-2">{card.value}</h2>
          </div>
        ))}
      </div>

      <div className="rounded-3xl border border-slate-200 bg-[linear-gradient(135deg,#0f172a_0%,#1e293b_45%,#0f766e_100%)] p-6 text-white shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/70">
              CRM + WhatsApp Workspace
            </p>
            <h1 className="mt-2 text-3xl font-semibold">
              See customer conversations and send personal or mass WhatsApp outreach.
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-white/80">
              The admin page now uses CRM contacts as the source of truth: timeline
              messages, consent, stage, revenue, and WhatsApp delivery/status events all
              stay attached to the same customer record.
            </p>
          </div>
          <div className="grid min-w-[260px] grid-cols-2 gap-3">
            <div className="rounded-2xl bg-white/10 p-4 backdrop-blur">
              <p className="text-xs uppercase tracking-[0.18em] text-white/70">
                WhatsApp Reachable
              </p>
              <p className="mt-2 text-2xl font-semibold">
                {Number(whatsappOverview?.summary?.totalWhatsappReachableContacts || 0)}
              </p>
            </div>
            <div className="rounded-2xl bg-white/10 p-4 backdrop-blur">
              <p className="text-xs uppercase tracking-[0.18em] text-white/70">
                Consented
              </p>
              <p className="mt-2 text-2xl font-semibold">
                {Number(whatsappOverview?.summary?.totalConsentedWhatsappContacts || 0)}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.22fr_0.95fr] gap-5">
        <div className="bg-white rounded-2xl shadow-md p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-[24px] font-[600] text-gray-900">CRM Contacts</h2>
              <p className="text-sm text-gray-500">
                Search, filter, and pick the contact whose full timeline and messaging
                controls you want to inspect.
              </p>
            </div>
            <Button
              variant="outlined"
              size="small"
              sx={{ textTransform: "none" }}
              onClick={handleRefreshContacts}
            >
              Refresh Contacts
            </Button>
            <Button
              variant="outlined"
              size="small"
              sx={{ textTransform: "none" }}
              onClick={clearFilters}
            >
              Clear Filters
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 mb-5">
            <TextField
              size="small"
              label="Search"
              name="q"
              value={filters.q}
              onChange={handleFilterChange}
              placeholder="Name, email, phone"
            />
            <TextField
              select
              size="small"
              label="Channel"
              name="channel"
              value={filters.channel}
              onChange={handleFilterChange}
            >
              {CHANNEL_OPTIONS.map((option) => (
                <MenuItem key={option.value || "all"} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              size="small"
              label="Lifecycle"
              name="lifecycleStage"
              value={filters.lifecycleStage}
              onChange={handleFilterChange}
            >
              {LIFECYCLE_OPTIONS.map((option) => (
                <MenuItem key={option.value || "all"} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              size="small"
              label="Status"
              name="status"
              value={filters.status}
              onChange={handleFilterChange}
            >
              {STATUS_OPTIONS.map((option) => (
                <MenuItem key={option.value || "all"} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-10">
              <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-600"></div>
            </div>
          ) : contacts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 py-12 text-center text-slate-500">
              No CRM contacts matched these filters yet.
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px]">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="text-left px-4 py-3 text-sm font-semibold text-slate-700">
                        Contact
                      </th>
                      <th className="text-left px-4 py-3 text-sm font-semibold text-slate-700">
                        Source
                      </th>
                      <th className="text-left px-4 py-3 text-sm font-semibold text-slate-700">
                        Stage
                      </th>
                      <th className="text-left px-4 py-3 text-sm font-semibold text-slate-700">
                        Status
                      </th>
                      <th className="text-left px-4 py-3 text-sm font-semibold text-slate-700">
                        Orders
                      </th>
                      <th className="text-left px-4 py-3 text-sm font-semibold text-slate-700">
                        Spend
                      </th>
                      <th className="text-left px-4 py-3 text-sm font-semibold text-slate-700">
                        Last Activity
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {contacts.map((contact) => (
                      <tr
                        key={contact.id}
                        className={`border-b border-slate-100 cursor-pointer transition-colors ${
                          String(contact.id) === String(selectedContactId)
                            ? "bg-orange-50"
                            : "hover:bg-slate-50"
                        }`}
                        onClick={() => applySelectedContact(contact)}
                      >
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-900">
                            {contact.name || "Unnamed contact"}
                          </div>
                          <div className="text-sm text-slate-500">
                            {contact.email || contact.phone || contact.sessionId || "-"}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-700">
                          {prettifyValue(contact.sourceChannel)}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${stageBadgeClass(contact.lifecycleStage)}`}
                          >
                            {prettifyValue(contact.lifecycleStage)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadgeClass(contact.status)}`}
                          >
                            {prettifyValue(contact.status)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-700">
                          {Number(contact.totalOrders || 0)}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-700">
                          {formatCurrency(contact.totalSpent)}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-700">
                          {formatDateTime(contact.lastInteractionAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-center pt-6">
                <Pagination
                  page={page}
                  count={totalPages}
                  onChange={(_event, value) => setPage(value)}
                  showFirstButton
                  showLastButton
                />
              </div>
            </>
          )}
        </div>

        <div className="space-y-5">
          <div className="bg-white rounded-2xl shadow-md p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">
                  {selectedContact?.name || "Select a contact"}
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  {selectedContact?.email ||
                    selectedContact?.phone ||
                    selectedContact?.sessionId ||
                    "Pick a CRM contact to inspect stage, consent, and conversation history."}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <span
                  className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${stageBadgeClass(
                    selectedContact?.lifecycleStage,
                  )}`}
                >
                  {prettifyValue(selectedContact?.lifecycleStage || "lead")}
                </span>
                <span
                  className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusBadgeClass(
                    selectedContact?.status,
                  )}`}
                >
                  {prettifyValue(selectedContact?.status || "open")}
                </span>
              </div>
            </div>

            {selectedContact ? (
              <div className="space-y-4 mt-5">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-slate-500">Interactions</p>
                    <p className="mt-1 text-lg font-semibold text-slate-900">
                      {Number(selectedContact.interactionCount || 0)}
                    </p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-slate-500">Revenue</p>
                    <p className="mt-1 text-lg font-semibold text-slate-900">
                      {formatCurrency(selectedContact.totalSpent)}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="rounded-xl border border-slate-200 p-3">
                    <p className="font-semibold text-slate-700">Consent Flags</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 font-semibold ${consentBadgeClass(
                          selectedContact?.consent?.whatsapp,
                        )}`}
                      >
                        WhatsApp:{" "}
                        {prettifyValue(String(selectedContact?.consent?.whatsapp ?? "unknown"))}
                      </span>
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 font-semibold ${consentBadgeClass(
                          selectedContact?.consent?.email,
                        )}`}
                      >
                        Email: {prettifyValue(String(selectedContact?.consent?.email ?? "unknown"))}
                      </span>
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 font-semibold ${consentBadgeClass(
                          selectedContact?.consent?.push,
                        )}`}
                      >
                        Push: {prettifyValue(String(selectedContact?.consent?.push ?? "unknown"))}
                      </span>
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-200 p-3">
                    <p className="font-semibold text-slate-700">Identity</p>
                    <div className="mt-3 space-y-1 text-slate-600">
                      <p>Phone: {selectedContact.phone || "Not available"}</p>
                      <p>Last seen: {formatDateTime(selectedContact.lastSeenAt)}</p>
                      <p>First seen: {formatDateTime(selectedContact.firstSeenAt)}</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  <TextField
                    select
                    size="small"
                    label="Lifecycle Stage"
                    value={draft.lifecycleStage}
                    onChange={(event) =>
                      setDraft((prev) => ({
                        ...prev,
                        lifecycleStage: event.target.value,
                      }))
                    }
                  >
                    {LIFECYCLE_OPTIONS.filter((option) => option.value).map((option) => (
                      <MenuItem key={option.value} value={option.value}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </TextField>

                  <TextField
                    select
                    size="small"
                    label="Status"
                    value={draft.status}
                    onChange={(event) =>
                      setDraft((prev) => ({
                        ...prev,
                        status: event.target.value,
                      }))
                    }
                  >
                    {STATUS_OPTIONS.filter((option) => option.value).map((option) => (
                      <MenuItem key={option.value} value={option.value}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </TextField>

                  <TextField
                    select
                    size="small"
                    label="Source Channel"
                    value={draft.sourceChannel}
                    onChange={(event) =>
                      setDraft((prev) => ({
                        ...prev,
                        sourceChannel: event.target.value,
                      }))
                    }
                  >
                    {CHANNEL_OPTIONS.filter((option) => option.value).map((option) => (
                      <MenuItem key={option.value} value={option.value}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </TextField>

                  <TextField
                    size="small"
                    label="Tags"
                    value={draft.tags}
                    onChange={(event) =>
                      setDraft((prev) => ({
                        ...prev,
                        tags: event.target.value,
                      }))
                    }
                    placeholder="vip, repeat, priority"
                  />

                  <TextField
                    select
                    size="small"
                    label="WhatsApp Consent"
                    value={draft.consentWhatsapp}
                    onChange={(event) =>
                      setDraft((prev) => ({
                        ...prev,
                        consentWhatsapp: event.target.value,
                      }))
                    }
                  >
                    {CONSENT_OPTIONS.map((option) => (
                      <MenuItem key={option.value} value={option.value}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </TextField>

                  <TextField
                    select
                    size="small"
                    label="Email Consent"
                    value={draft.consentEmail}
                    onChange={(event) =>
                      setDraft((prev) => ({
                        ...prev,
                        consentEmail: event.target.value,
                      }))
                    }
                  >
                    {CONSENT_OPTIONS.map((option) => (
                      <MenuItem key={option.value} value={option.value}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </TextField>

                  <TextField
                    select
                    size="small"
                    label="Push Consent"
                    value={draft.consentPush}
                    onChange={(event) =>
                      setDraft((prev) => ({
                        ...prev,
                        consentPush: event.target.value,
                      }))
                    }
                  >
                    {CONSENT_OPTIONS.map((option) => (
                      <MenuItem key={option.value} value={option.value}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </TextField>
                </div>

                <div className="flex items-center gap-3">
                  <Button
                    variant="contained"
                    sx={{ textTransform: "none" }}
                    onClick={handleSaveContact}
                    disabled={isSaving}
                  >
                    {isSaving ? "Saving..." : "Save Contact"}
                  </Button>
                  <span className="text-xs text-slate-500">
                    Last interaction {formatDateTime(selectedContact.lastInteractionAt)}
                  </span>
                </div>
              </div>
            ) : null}
          </div>

          <div className="bg-white rounded-2xl shadow-md p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">WhatsApp Message Center</h3>
                <p className="text-sm text-slate-500">
                  Personal replies for one contact, using text for active chats or templates
                  for first outreach.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <span
                  className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getWhatsappHealthTone(
                    whatsappHealthState,
                  )}`}
                >
                  API {getWhatsappHealthLabel(whatsappHealthState)}
                </span>
                <span
                  className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getConfigTone(
                    whatsappOverview?.templates?.configured,
                  )}`}
                >
                  Template Sync{" "}
                  {whatsappOverview?.templates?.configured ? "Ready" : "Manual"}
                </span>
              </div>
            </div>

            {whatsappHealth?.message ? (
              <div
                className={`mb-4 rounded-xl border px-3 py-2 text-xs ${getWhatsappHealthPanelTone(
                  whatsappHealthState,
                )}`}
              >
                <p>{whatsappHealth.message}</p>
                {whatsappHealth ? (
                  <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-3">
                    <div className="rounded-lg bg-white/60 px-2 py-1 text-slate-700">
                      <span className="font-semibold">Display</span>:{" "}
                      {whatsappHealth.displayPhoneNumber || "-"}
                    </div>
                    <div className="rounded-lg bg-white/60 px-2 py-1 text-slate-700">
                      <span className="font-semibold">Name</span>:{" "}
                      {whatsappHealth.verifiedName || "-"}
                    </div>
                    <div className="rounded-lg bg-white/60 px-2 py-1 text-slate-700">
                      <span className="font-semibold">Delivery</span>:{" "}
                      {whatsappDeliveryReady ? "Ready" : "Blocked / Risky"}
                    </div>
                    <div className="rounded-lg bg-white/60 px-2 py-1 text-slate-700">
                      <span className="font-semibold">Sender Status</span>:{" "}
                      {formatWhatsappHealthField(whatsappHealth.senderStatus)}
                    </div>
                    <div className="rounded-lg bg-white/60 px-2 py-1 text-slate-700">
                      <span className="font-semibold">Code Verify</span>:{" "}
                      {formatWhatsappHealthField(whatsappHealth.codeVerificationStatus)}
                    </div>
                    <div className="rounded-lg bg-white/60 px-2 py-1 text-slate-700">
                      <span className="font-semibold">Name Review</span>:{" "}
                      {formatWhatsappHealthField(whatsappHealth.nameStatus)}
                    </div>
                    <div className="rounded-lg bg-white/60 px-2 py-1 text-slate-700">
                      <span className="font-semibold">Quality</span>:{" "}
                      {formatWhatsappHealthField(whatsappHealth.qualityRating)}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            {selectedContact ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-slate-500">Selected Phone</p>
                    <p className="mt-1 font-semibold text-slate-900">
                      {selectedContact.phone || "No phone on CRM contact"}
                    </p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-slate-500">Latest WhatsApp Status</p>
                    <p className="mt-1 font-semibold text-slate-900">
                      {selectedWhatsappStatus?.metadata?.status
                        ? prettifyValue(selectedWhatsappStatus.metadata.status)
                        : hasSelectedWhatsappConversation
                          ? "Conversation exists"
                          : "No WhatsApp timeline yet"}
                    </p>
                  </div>
                </div>

                {selectedContact?.consent?.whatsapp === false ? (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    WhatsApp consent is blocked for this contact. Update the contact card
                    above before sending.
                  </div>
                ) : null}

                <TextField
                  select
                  size="small"
                  label="Send Mode"
                  value={personalWhatsappForm.mode}
                  onChange={(event) =>
                    setPersonalWhatsappForm((prev) => ({
                      ...prev,
                      mode: event.target.value,
                    }))
                  }
                >
                  <MenuItem value="text">Personal Text Reply</MenuItem>
                  <MenuItem value="template">Template Message</MenuItem>
                  <MenuItem value="image">Image Message</MenuItem>
                  <MenuItem value="gif">GIF Message</MenuItem>
                </TextField>

                {personalWhatsappForm.mode === "text" ? (
                  <TextField
                    size="small"
                    label="Message"
                    value={personalWhatsappForm.body}
                    onChange={(event) =>
                      setPersonalWhatsappForm((prev) => ({
                        ...prev,
                        body: event.target.value,
                      }))
                    }
                    multiline
                    minRows={4}
                    fullWidth
                    placeholder="Write a direct reply for the customer..."
                  />
                ) : personalWhatsappForm.mode === "template" ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {whatsappTemplates.length > 0 ? (
                      <TextField
                        select
                        size="small"
                        label="Approved Template"
                        value={personalWhatsappForm.templateName}
                        onChange={(event) =>
                          setPersonalTemplateSelection(event.target.value)
                        }
                      >
                        {whatsappTemplates.map((template) => (
                          <MenuItem key={template.name} value={template.name}>
                            {template.name} ({prettifyValue(template.category)} /{" "}
                            {template.language || "en"})
                          </MenuItem>
                        ))}
                      </TextField>
                    ) : (
                      <TextField
                        size="small"
                        label="Template Name"
                        value={personalWhatsappForm.templateName}
                        onChange={(event) =>
                          setPersonalWhatsappForm((prev) => ({
                            ...prev,
                            templateName: event.target.value,
                          }))
                        }
                        placeholder="approved_template_name"
                      />
                    )}

                    <TextField
                      size="small"
                      label="Language Code"
                      value={personalWhatsappForm.languageCode}
                      onChange={(event) =>
                        setPersonalWhatsappForm((prev) => ({
                          ...prev,
                          languageCode: event.target.value,
                        }))
                      }
                      helperText="Use the exact approved Meta language code, like en_US."
                    />
                    <TextField
                      size="small"
                      label="Header Variables"
                      value={personalWhatsappForm.headerVariables}
                      onChange={(event) =>
                        setPersonalWhatsappForm((prev) => ({
                          ...prev,
                          headerVariables: event.target.value,
                        }))
                      }
                      placeholder="Brand name, campaign title"
                    />
                    <TextField
                      size="small"
                      label="Body Variables"
                      value={personalWhatsappForm.bodyVariables}
                      onChange={(event) =>
                        setPersonalWhatsappForm((prev) => ({
                          ...prev,
                          bodyVariables: event.target.value,
                        }))
                      }
                      placeholder="Customer name, offer text"
                    />
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <Button
                        variant="outlined"
                        component="label"
                        size="small"
                        sx={{ textTransform: "none" }}
                        disabled={uploadingWhatsappMedia}
                      >
                        {uploadingWhatsappMedia ? "Uploading..." : "Upload Media"}
                        <input
                          hidden
                          type="file"
                          accept={
                            personalWhatsappForm.mode === "gif"
                              ? "image/gif,video/mp4,video/webm"
                              : "image/jpeg,image/png,image/webp,image/gif"
                          }
                          onChange={handleWhatsappMediaUpload}
                        />
                      </Button>
                      <span className="text-xs text-slate-500">
                        Uploads to Cloudinary and attaches the media to this send.
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <TextField
                        size="small"
                        label="Selected File"
                        value={
                          personalWhatsappForm.mediaFilename ||
                          (personalWhatsappForm.mediaUrl ? "Uploaded media" : "")
                        }
                        InputProps={{ readOnly: true }}
                        placeholder="No file uploaded yet"
                      />

                      <TextField
                        size="small"
                        label="Caption (optional)"
                        value={personalWhatsappForm.mediaCaption}
                        onChange={(event) =>
                          setPersonalWhatsappForm((prev) => ({
                            ...prev,
                            mediaCaption: event.target.value,
                          }))
                        }
                        multiline
                        minRows={3}
                        fullWidth
                        placeholder="Message caption shown with the media"
                      />

                      <Button
                        variant="text"
                        size="small"
                        sx={{ textTransform: "none", justifyContent: "flex-start" }}
                        disabled={!personalWhatsappForm.mediaUrl}
                        onClick={() =>
                          setPersonalWhatsappForm((prev) => ({
                            ...prev,
                            mediaUrl: "",
                            mediaFilename: "",
                          }))
                        }
                      >
                        Clear uploaded media
                      </Button>
                    </div>
                  </div>
                )}

                <TextField
                  size="small"
                  label="Campaign Label (optional)"
                  value={personalWhatsappForm.campaignName}
                  onChange={(event) =>
                    setPersonalWhatsappForm((prev) => ({
                      ...prev,
                      campaignName: event.target.value,
                    }))
                  }
                  placeholder="Support follow-up / recovery / promo label"
                />

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                  Text mode is best for active customer conversations already visible in the
                  timeline. Template mode is the safer path for first outreach, reactivation,
                  or promotional sends through the official WhatsApp business API. Image/GIF
                  mode requires uploading a file from your device.
                </div>

                {lastWhatsappSubmission?.scope === "personal" ? (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                    Last submit: {prettifyValue(lastWhatsappSubmission.mode)} to{" "}
                    {lastWhatsappSubmission.phone || "the selected contact"} on{" "}
                    {formatDateTime(lastWhatsappSubmission.submittedAt)}
                    {lastWhatsappSubmission.messageId
                      ? ` | Message ID: ${truncateForPreview(
                          lastWhatsappSubmission.messageId,
                          42,
                        )}`
                      : ""}
                  </div>
                ) : null}

                <div className="flex items-center justify-between gap-3">
                <Button
                  variant="contained"
                  sx={{ textTransform: "none" }}
                  disabled={
                    sendingPersonalWhatsapp ||
                    uploadingWhatsappMedia ||
                    !selectedContact.phone ||
                    selectedContact?.consent?.whatsapp === false ||
                    !whatsappApiReady
                  }
                  onClick={handleSendPersonalWhatsapp}
                >
                    {sendingPersonalWhatsapp ? "Sending..." : "Send WhatsApp Message"}
                  </Button>
                  <span className="text-xs text-slate-500">
                    Delivery and read states come back into the same timeline via Meta webhook.
                  </span>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 py-10 text-center text-slate-500">
                Select a CRM contact to open the WhatsApp composer.
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl shadow-md p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">WhatsApp Campaigns</h3>
                <p className="text-sm text-slate-500">
                  Broadcast approved templates to consented CRM segments, not just raw phone
                  lists.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {(whatsappOverview?.statusBreakdown || []).slice(0, 3).map((item) => (
                  <span
                    key={item.status}
                    className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${whatsappStatusClass(
                      item.status,
                    )}`}
                  >
                    {prettifyValue(item.status)}: {item.count}
                  </span>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <TextField
                select
                size="small"
                label="Audience Segment"
                value={campaignForm.segment}
                onChange={(event) =>
                  setCampaignForm((prev) => ({
                    ...prev,
                    segment: event.target.value,
                  }))
                }
              >
                {WHATSAPP_SEGMENT_OPTIONS.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </TextField>

              <TextField
                size="small"
                label="Inactive Window (days)"
                value={campaignForm.inactiveDays}
                onChange={(event) =>
                  setCampaignForm((prev) => ({
                    ...prev,
                    inactiveDays: event.target.value,
                  }))
                }
              />

              {whatsappTemplates.length > 0 ? (
                <TextField
                  select
                  size="small"
                  label="Approved Template"
                  value={campaignForm.templateName}
                  onChange={(event) =>
                    setCampaignTemplateSelection(event.target.value)
                  }
                >
                  {whatsappTemplates.map((template) => (
                    <MenuItem key={template.name} value={template.name}>
                      {template.name} ({prettifyValue(template.category)} /{" "}
                      {template.language || "en"})
                    </MenuItem>
                  ))}
                </TextField>
              ) : (
                <TextField
                  size="small"
                  label="Template Name"
                  value={campaignForm.templateName}
                  onChange={(event) =>
                    setCampaignForm((prev) => ({
                      ...prev,
                      templateName: event.target.value,
                    }))
                  }
                  placeholder="approved_template_name"
                />
              )}

              <TextField
                size="small"
                label="Language Code"
                value={campaignForm.languageCode}
                onChange={(event) =>
                  setCampaignForm((prev) => ({
                    ...prev,
                    languageCode: event.target.value,
                  }))
                }
                helperText="Use the exact approved Meta language code, like en_US."
              />

              <TextField
                size="small"
                label="Campaign Label"
                value={campaignForm.campaignName}
                onChange={(event) =>
                  setCampaignForm((prev) => ({
                    ...prev,
                    campaignName: event.target.value,
                  }))
                }
                placeholder="Summer whey promo / winback / new launch"
              />

              <TextField
                size="small"
                label="Header Variables"
                value={campaignForm.headerVariables}
                onChange={(event) =>
                  setCampaignForm((prev) => ({
                    ...prev,
                    headerVariables: event.target.value,
                  }))
                }
                placeholder="Brand name, city"
              />

              <TextField
                size="small"
                label="Body Variables"
                value={campaignForm.bodyVariables}
                onChange={(event) =>
                  setCampaignForm((prev) => ({
                    ...prev,
                    bodyVariables: event.target.value,
                  }))
                }
                placeholder="Customer name, offer, CTA"
                multiline
                minRows={3}
                fullWidth
              />
            </div>

            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    Audience preview: {Number(audiencePreview?.count || 0)} consented contacts
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Only CRM contacts with phone numbers and WhatsApp consent are included in
                    campaign send.
                  </p>
                </div>
                <Button
                  variant="outlined"
                  size="small"
                  sx={{ textTransform: "none" }}
                  onClick={() => {
                    loadAudiencePreview().catch((error) => {
                      toast.error(
                        error?.message || "Failed to refresh WhatsApp audience preview.",
                      );
                    });
                  }}
                >
                  Refresh Preview
                </Button>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {(audiencePreview?.sample || []).map((contact) => (
                  <div
                    key={contact.id}
                    className="rounded-xl border border-white bg-white p-3 text-sm"
                  >
                    <p className="font-semibold text-slate-900">
                      {contact.name || "Unnamed contact"}
                    </p>
                    <p className="mt-1 text-slate-600">
                      {contact.phone || contact.email || "No identity"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {prettifyValue(contact.lifecycleStage)} /{" "}
                      {prettifyValue(contact.status)}
                    </p>
                  </div>
                ))}
                {!(audiencePreview?.sample || []).length ? (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-white p-4 text-sm text-slate-500">
                    No contacts in this segment preview yet.
                  </div>
                ) : null}
              </div>
            </div>

            {lastWhatsappSubmission?.scope === "campaign" ? (
              <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                Last campaign: {lastWhatsappSubmission.sent || 0} sent /{" "}
                {lastWhatsappSubmission.attempted || 0} attempted for{" "}
                {prettifyValue(lastWhatsappSubmission.segment || "all")} on{" "}
                {formatDateTime(lastWhatsappSubmission.submittedAt)}
              </div>
            ) : null}

            <div className="mt-4 flex items-center justify-between gap-3">
              <Button
                variant="contained"
                sx={{ textTransform: "none" }}
                disabled={
                  sendingCampaignWhatsapp ||
                  Number(audiencePreview?.count || 0) === 0 ||
                  !whatsappApiReady
                }
                onClick={handleSendWhatsappCampaign}
              >
                {sendingCampaignWhatsapp ? "Sending..." : "Send WhatsApp Campaign"}
              </Button>
              <span className="text-xs text-slate-500">
                Broadcasts use approved templates so delivery states can flow back into CRM.
              </span>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-md p-5">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Recent Orders</h3>
                <p className="text-sm text-slate-500">
                  Direct shipment access for the selected CRM contact.
                </p>
              </div>
              {selectedContact ? (
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                  {Number(selectedContact.totalOrders || recentOrders.length || 0)} orders
                </span>
              ) : null}
            </div>

            {timelineLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600"></div>
              </div>
            ) : recentOrders.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 py-10 text-center text-slate-500">
                {selectedContact
                  ? "No orders matched this CRM contact yet."
                  : "Select a contact to view linked orders."}
              </div>
            ) : (
              <div className="space-y-3">
                {recentOrders.map((order) => (
                  <div
                    key={order.id}
                    className="rounded-2xl border border-slate-100 bg-slate-50 p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {order.displayOrderId || "Order"}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          {formatDateTime(order.createdAt)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-slate-900">
                          {formatCurrency(order.totalAmount)}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          {prettifyValue(order.paymentStatus)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                      <div className="rounded-xl bg-white p-3 border border-slate-100">
                        <p className="text-slate-500">Order Status</p>
                        <p className="mt-1 font-medium text-slate-900">
                          {prettifyValue(order.orderStatus)}
                        </p>
                      </div>
                      <div className="rounded-xl bg-white p-3 border border-slate-100">
                        <p className="text-slate-500">Shipment Status</p>
                        <p className="mt-1 font-medium text-slate-900">
                          {prettifyValue(order.shipmentStatus)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                      <div className="text-sm text-slate-600">
                        <span className="font-semibold text-slate-900">AWB:</span>{" "}
                        {order.awbNumber || "N/A"}
                        <span className="ml-3 font-semibold text-slate-900">Courier:</span>{" "}
                        {order.courierName || "Xpressbees"}
                      </div>

                      {order.trackingUrl ? (
                        <a
                          href={order.trackingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-700"
                        >
                          Track Shipment
                        </a>
                      ) : (
                        <span className="text-xs text-slate-400">
                          Tracking not available yet
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl shadow-md p-5">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Timeline</h3>
                <p className="text-sm text-slate-500">
                  Messages, statuses, orders, and support touchpoints stay attached to the
                  same customer record.
                </p>
              </div>
            </div>

            {timelineLoading ? (
              <div className="flex justify-center py-10">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600"></div>
              </div>
            ) : timeline.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 py-10 text-center text-slate-500">
                {selectedContact
                  ? "No interactions recorded for this contact yet."
                  : "Select a contact to view timeline."}
              </div>
            ) : (
              <div className="space-y-3 max-h-[760px] overflow-y-auto pr-1">
                {timeline.map((item) => (
                  <article
                    key={item.id}
                    className={`rounded-2xl border p-4 ${
                      item.channel === "whatsapp"
                        ? "border-teal-100 bg-teal-50/60"
                        : "border-slate-100 bg-slate-50"
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      <span className="inline-flex rounded-full bg-slate-900 px-2.5 py-1 text-xs font-semibold text-white">
                        {prettifyValue(item.channel)}
                      </span>
                      <span className="inline-flex rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600">
                        {prettifyValue(item.eventType)}
                      </span>
                      {resolveTimelineMetaTags(item).map((tag) => (
                        <span
                          key={`${item.id}-${tag.label}`}
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${tag.className}`}
                        >
                          {tag.label}
                        </span>
                      ))}
                      <span className="ml-auto text-xs text-slate-500">
                        {formatDateTime(item.happenedAt)}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-slate-900">
                      {item.eventName || prettifyValue(item.eventType)}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      {resolveTimelineSummary(item)}
                    </p>
                    {item?.metadata?.messageId ? (
                      <p className="mt-3 text-xs text-slate-500">
                        Provider message ID: {item.metadata.messageId}
                      </p>
                    ) : null}
                  </article>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl shadow-md p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">WhatsApp Ops Snapshot</h3>
                <p className="text-sm text-slate-500">
                  Recent WhatsApp events across the CRM, not just the selected contact.
                </p>
              </div>
              <div className="text-xs text-slate-500">
                Inbound 30d: {Number(whatsappOverview?.summary?.inboundLast30Days || 0)} •
                Outbound 30d: {Number(whatsappOverview?.summary?.outboundLast30Days || 0)}
              </div>
            </div>

            {whatsappLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600"></div>
              </div>
            ) : (whatsappOverview?.recentEvents || []).length > 0 ? (
              <div className="space-y-3">
                {whatsappOverview.recentEvents.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-xl border border-slate-100 bg-slate-50 p-4"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-slate-900">
                        {item.contact?.name || item.contact?.phone || "Unknown contact"}
                      </span>
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${directionBadgeClass(
                          item.direction,
                        )}`}
                      >
                        {prettifyValue(item.direction)}
                      </span>
                      {item?.metadata?.status ? (
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${whatsappStatusClass(
                            item.metadata.status,
                          )}`}
                        >
                          {prettifyValue(item.metadata.status)}
                        </span>
                      ) : null}
                      <span className="ml-auto text-xs text-slate-500">
                        {formatDateTime(item.happenedAt)}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-slate-600">
                      {item.message || item.eventName || prettifyValue(item.eventType)}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 py-10 text-center text-slate-500">
                No WhatsApp CRM events have been recorded yet.
              </div>
            )}
          </div>
        </div>
      </div>

      <Dialog
        open={confirmationDialog.open}
        onClose={() => {
          if (!sendingPersonalWhatsapp && !sendingCampaignWhatsapp) {
            closeConfirmationDialog();
          }
        }}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>{confirmationDialog.title || "Confirm WhatsApp Action"}</DialogTitle>
        <DialogContent dividers className="space-y-4">
          <p className="text-sm text-slate-600">
            {confirmationDialog.description || "Review this action before continuing."}
          </p>

          {confirmationDialog.warning ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {confirmationDialog.warning}
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {(confirmationDialog.highlights || []).map((item) => (
              <div
                key={`${confirmationDialog.action}-${item.label}`}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  {item.label}
                </p>
                <p className="mt-1 text-sm font-medium text-slate-900">
                  {item.value || "-"}
                </p>
              </div>
            ))}
          </div>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={closeConfirmationDialog}
            disabled={sendingPersonalWhatsapp || sendingCampaignWhatsapp}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleConfirmWhatsappAction}
            disabled={sendingPersonalWhatsapp || sendingCampaignWhatsapp}
          >
            {sendingPersonalWhatsapp || sendingCampaignWhatsapp
              ? "Submitting..."
              : confirmationDialog.confirmLabel || "Confirm"}
          </Button>
        </DialogActions>
      </Dialog>
    </section>
  );
};

export default CrmPage;
