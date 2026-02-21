"use client";
import { useAdmin } from "@/context/AdminContext";
import { deleteData, getData, postData, putData } from "@/utils/api";
import {
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
} from "@mui/material";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { FaChartLine, FaRegTrashAlt } from "react-icons/fa";
import { RiEdit2Line, RiFileCopyLine } from "react-icons/ri";

const PLATFORM_OPTIONS = [
  "Instagram",
  "YouTube",
  "Facebook",
  "X",
  "LinkedIn",
  "WhatsApp",
  "Telegram",
  "Website",
  "Other",
];

const normalizePlatformKey = (platform) =>
  String(platform || "").trim().toLowerCase();

const indexPromotionPlatforms = (platforms = []) => {
  const totals = {};
  (platforms || []).forEach((entry) => {
    const key = normalizePlatformKey(entry?.platform);
    if (!key) return;
    totals[key] = (totals[key] || 0) + 1;
  });

  const seen = {};
  return (platforms || []).map((entry) => {
    const platform = String(entry?.platform || "").trim();
    const key = normalizePlatformKey(platform);
    const duplicateCount = key ? totals[key] || 1 : 1;
    const duplicateIndex = key ? (seen[key] || 0) + 1 : 1;
    if (key) {
      seen[key] = duplicateIndex;
    }
    return {
      ...entry,
      duplicateCount,
      duplicateIndex,
      isDuplicate: duplicateCount > 1,
      displayPlatform:
        duplicateCount > 1 ? `${platform} ${duplicateIndex}` : platform,
    };
  });
};

const Influencers = () => {
  const { token, isAuthenticated, loading } = useAdmin();
  const router = useRouter();

  const [influencers, setInfluencers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [openStatsDialog, setOpenStatsDialog] = useState(false);
  const [selectedInfluencer, setSelectedInfluencer] = useState(null);
  const [influencerStats, setInfluencerStats] = useState(null);
  const [editingInfluencer, setEditingInfluencer] = useState(null);
  const [expandedPlatformRows, setExpandedPlatformRows] = useState({});
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    code: "",
    discountType: "PERCENT",
    discountValue: "",
    maxDiscountAmount: "",
    minOrderAmount: "",
    commissionType: "PERCENT",
    commissionValue: "",
    expiresAt: "",
    isActive: true,
    notes: "",
    promotionPlatforms: [],
  });

  const fetchInfluencers = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await getData("/api/influencers/admin/all", token);
      if (response.success) {
        setInfluencers(response.data || []);
      } else {
        setInfluencers([]);
      }
    } catch (error) {
      console.error("Failed to fetch influencers:", error);
      setInfluencers([]);
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
      fetchInfluencers();
    }
  }, [isAuthenticated, token, fetchInfluencers]);

  const handleOpenDialog = (influencer = null) => {
    if (influencer) {
      setEditingInfluencer(influencer);
      setFormData({
        name: influencer.name || "",
        email: influencer.email || "",
        phone: influencer.phone || "",
        code: influencer.code || "",
        discountType: influencer.discountType || "PERCENT",
        discountValue: influencer.discountValue?.toString() || "",
        maxDiscountAmount: influencer.maxDiscountAmount?.toString() || "",
        minOrderAmount: influencer.minOrderAmount?.toString() || "",
        commissionType: influencer.commissionType || "PERCENT",
        commissionValue: influencer.commissionValue?.toString() || "",
        expiresAt: influencer.expiresAt
          ? new Date(influencer.expiresAt).toISOString().split("T")[0]
          : "",
        isActive: influencer.isActive !== false,
        notes: influencer.notes || "",
        promotionPlatforms: Array.isArray(influencer.promotionPlatforms)
          ? influencer.promotionPlatforms.map((entry) => ({
              platform: entry?.platform || "",
              username: entry?.username || "",
            }))
          : [],
      });
    } else {
      setEditingInfluencer(null);
      setFormData({
        name: "",
        email: "",
        phone: "",
        code: "",
        discountType: "PERCENT",
        discountValue: "",
        maxDiscountAmount: "",
        minOrderAmount: "",
        commissionType: "PERCENT",
        commissionValue: "",
        expiresAt: "",
        isActive: true,
        notes: "",
        promotionPlatforms: [],
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingInfluencer(null);
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleAddPromotionPlatform = () => {
    setFormData((prev) => ({
      ...prev,
      promotionPlatforms: [
        ...(prev.promotionPlatforms || []),
        { platform: "Instagram", username: "" },
      ],
    }));
  };

  const handlePromotionPlatformChange = (index, field, value) => {
    setFormData((prev) => {
      const next = [...(prev.promotionPlatforms || [])];
      next[index] = { ...next[index], [field]: value };
      return {
        ...prev,
        promotionPlatforms: next,
      };
    });
  };

  const handleRemovePromotionPlatform = (index) => {
    setFormData((prev) => ({
      ...prev,
      promotionPlatforms: (prev.promotionPlatforms || []).filter(
        (_, i) => i !== index,
      ),
    }));
  };

  const togglePlatformRow = (influencerId) => {
    setExpandedPlatformRows((prev) => ({
      ...prev,
      [influencerId]: !prev[influencerId],
    }));
  };

  const generateCode = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code = "";
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormData((prev) => ({ ...prev, code }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error("Please enter influencer name");
      return;
    }
    if (!formData.code.trim()) {
      toast.error("Please enter or generate a referral code");
      return;
    }
    if (!formData.discountValue || Number(formData.discountValue) <= 0) {
      toast.error("Please enter a valid discount value");
      return;
    }
    if (!formData.commissionValue || Number(formData.commissionValue) <= 0) {
      toast.error("Please enter a valid commission value");
      return;
    }

    try {
      const payload = {
        name: formData.name.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        code: formData.code.toUpperCase().trim(),
        discountType: formData.discountType,
        discountValue: Number(formData.discountValue),
        maxDiscountAmount: formData.maxDiscountAmount
          ? Number(formData.maxDiscountAmount)
          : null,
        minOrderAmount: formData.minOrderAmount
          ? Number(formData.minOrderAmount)
          : 0,
        commissionType: formData.commissionType,
        commissionValue: Number(formData.commissionValue),
        expiresAt: formData.expiresAt || null,
        isActive: formData.isActive,
        notes: formData.notes,
        promotionPlatforms: (formData.promotionPlatforms || [])
          .map((entry) => ({
            platform: String(entry?.platform || "").trim(),
            username: String(entry?.username || "")
              .replace(/^@+/, "")
              .trim(),
          }))
          .filter((entry) => entry.platform && entry.username),
      };

      let response;
      if (editingInfluencer) {
        response = await putData(
          `/api/influencers/admin/${editingInfluencer._id}`,
          payload,
          token,
        );
      } else {
        response = await postData("/api/influencers/admin", payload, token);
      }

      if (response.success) {
        toast.success(
          editingInfluencer
            ? "Influencer updated successfully!"
            : "Influencer created successfully!",
        );
        handleCloseDialog();
        fetchInfluencers();
      } else {
        toast.error(response.message || "Failed to save influencer");
      }
    } catch (error) {
      console.error("Error saving influencer:", error);
      toast.error("Failed to save influencer");
    }
  };

  const handleDelete = async (influencerId) => {
    if (!confirm("Are you sure you want to delete this influencer?"))
      return;

    try {
      const response = await deleteData(
        `/api/influencers/admin/${influencerId}`,
        token,
      );
      if (response.success) {
        toast.success(response.message || "Influencer removed successfully!");
        fetchInfluencers();
      } else {
        toast.error(response.message || "Failed to delete influencer");
      }
    } catch (error) {
      console.error("Error deleting influencer:", error);
      toast.error("Failed to delete influencer");
    }
  };

  const handleViewStats = async (influencer) => {
    setSelectedInfluencer(influencer);
    setOpenStatsDialog(true);
    try {
      const response = await getData(
        `/api/influencers/admin/${influencer._id}/stats`,
        token,
      );
      if (response.success) {
        setInfluencerStats(response.data);
      } else {
        toast.error("Failed to load statistics");
      }
    } catch (error) {
      console.error("Error fetching stats:", error);
      toast.error("Failed to load statistics");
    }
  };

  const normalizeBaseUrl = (raw) => {
    const value = String(raw || "").trim().replace(/^["']|["']$/g, "");
    if (!value) return "";
    const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    return withProtocol.replace(/\/+$/, "");
  };

  const getFallbackReferralUrl = (codeValue) => {
    const code = String(codeValue || "").trim().toUpperCase();
    if (!code) return "";

    const configuredBase =
      normalizeBaseUrl(process.env.NEXT_PUBLIC_CLIENT_URL) ||
      normalizeBaseUrl(process.env.NEXT_PUBLIC_SITE_URL);

    if (configuredBase) return `${configuredBase}/?ref=${code}`;

    if (typeof window !== "undefined") {
      const { protocol, hostname, port } = window.location;
      const mappedPort = port === "3001" ? "3000" : port;
      const host = mappedPort ? `${hostname}:${mappedPort}` : hostname;
      return `${protocol}//${host}/?ref=${code}`;
    }

    return `https://healthyonegram.com/?ref=${code}`;
  };

  // Copy referral URL from backend and keep a safe fallback by code
  const copyReferralUrl = async (influencer) => {
    let source = influencer;
    if (typeof influencer === "string") {
      source = influencers.find((item) => item.code === influencer) || {
        code: influencer,
      };
    }

    const url = String(source?.referralUrl || "").trim() || getFallbackReferralUrl(source?.code);
    if (!url) {
      toast.error("Referral URL not available");
      return;
    }

    try {
      await navigator.clipboard.writeText(url);
      toast.success("Referral URL copied to clipboard!");
    } catch (error) {
      toast.error("Failed to copy referral URL");
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount || 0);
  };

  if (loading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="px-5 py-4">
      <div className="bg-white shadow-md rounded-md p-5">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-xl font-semibold text-gray-700">
            Influencer / Referral Management
          </h1>
          <Button
            variant="contained"
            color="primary"
            onClick={() => handleOpenDialog()}
          >
            + Add Influencer
          </Button>
        </div>

        {/* Info Box */}
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-4">
          <p className="text-sm text-purple-800">
            <strong>🎯 How it works:</strong> Create influencers here and share
            their unique referral URL. When customers visit via the referral
            link, they automatically get the discount applied at checkout. You
            earn commission on each successful order!
          </p>
          <p className="text-xs text-purple-600 mt-2">
            <strong>Note:</strong> Click the copy icon next to any code to copy
            the full referral URL.
          </p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-10">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-purple-600"></div>
          </div>
        ) : influencers.length === 0 ? (
          <div className="text-center py-10 text-gray-500">
            <p>No influencers found. Create your first influencer!</p>
          </div>
        ) : (
          <TableContainer>
            <Table>
              <TableHead className="bg-gray-50">
                <TableRow>
                  <TableCell className="font-semibold">Name</TableCell>
                  <TableCell className="font-semibold">Platforms</TableCell>
                  <TableCell className="font-semibold">Code</TableCell>
                  <TableCell className="font-semibold">Discount</TableCell>
                  <TableCell className="font-semibold">Commission</TableCell>
                  <TableCell className="font-semibold">Orders</TableCell>
                  <TableCell className="font-semibold">Revenue</TableCell>
                  <TableCell className="font-semibold">Status</TableCell>
                  <TableCell className="font-semibold text-center">
                    Actions
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {influencers.map((influencer) => {
                  const indexedPlatforms = indexPromotionPlatforms(
                    influencer.promotionPlatforms || [],
                  );
                  const hasPlatforms = indexedPlatforms.length > 0;
                  const isPlatformsOpen = !!expandedPlatformRows[influencer._id];

                  return (
                  <TableRow key={influencer._id} hover>
                    <TableCell>
                      <div>
                        <p className="font-medium">{influencer.name}</p>
                        {influencer.email && (
                          <p className="text-xs text-gray-500">
                            {influencer.email}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="min-w-[220px]">
                      {hasPlatforms ? (
                        <div>
                          <button
                            type="button"
                            onClick={() => togglePlatformRow(influencer._id)}
                            className="w-full flex items-center justify-between rounded-md border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-xs text-gray-700 hover:bg-gray-100"
                            aria-label="Toggle platform details"
                          >
                            <span>
                              {indexedPlatforms.length} Platform
                              {indexedPlatforms.length > 1 ? "s" : ""}
                            </span>
                            <span className="font-semibold">
                              {isPlatformsOpen ? "▲" : "▼"}
                            </span>
                          </button>
                          {isPlatformsOpen && (
                            <div className="mt-2 max-h-28 overflow-y-auto rounded-md border border-gray-200 bg-white px-2.5 py-2 space-y-1">
                              {indexedPlatforms.map((entry, idx) => (
                                <p
                                  key={`${entry.platform}-${entry.username}-${idx}`}
                                  className="text-xs leading-5"
                                >
                                  <span className="font-medium text-gray-700">
                                    {entry.displayPlatform}:
                                  </span>{" "}
                                  <span className="text-blue-700">
                                    @{entry.username}
                                  </span>
                                </p>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">Not set</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <code className="bg-purple-100 text-purple-800 px-2 py-1 rounded font-bold">
                          {influencer.code}
                        </code>
                        <Tooltip title="Copy referral URL">
                          <IconButton
                            size="small"
                            onClick={() => copyReferralUrl(influencer)}
                          >
                            <RiFileCopyLine className="text-gray-500" />
                          </IconButton>
                        </Tooltip>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-green-600 font-medium">
                        {influencer.discountType === "PERCENT"
                          ? `${influencer.discountValue}%`
                          : formatCurrency(influencer.discountValue)}
                      </span>
                      {influencer.maxDiscountAmount && (
                        <span className="text-xs text-gray-500 block">
                          Max: {formatCurrency(influencer.maxDiscountAmount)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-blue-600 font-medium">
                        {influencer.commissionType === "PERCENT"
                          ? `${influencer.commissionValue}%`
                          : formatCurrency(influencer.commissionValue)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">
                        {influencer.totalOrders || 0}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">
                        {formatCurrency(influencer.totalRevenue)}
                      </span>
                    </TableCell>
                    <TableCell>
                      {influencer.isActive ? (
                        <Chip
                          label="Active"
                          size="small"
                          color="success"
                          variant="outlined"
                        />
                      ) : (
                        <Chip
                          label="Inactive"
                          size="small"
                          color="default"
                          variant="outlined"
                        />
                      )}
                      {influencer.expiresAt &&
                        new Date(influencer.expiresAt) < new Date() && (
                          <Chip
                            label="Expired"
                            size="small"
                            color="error"
                            className="ml-1"
                          />
                        )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 justify-center">
                        <Tooltip title="View Statistics">
                          <IconButton
                            size="small"
                            onClick={() => handleViewStats(influencer)}
                            className="text-purple-600 hover:bg-purple-50"
                          >
                            <FaChartLine />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Edit">
                          <IconButton
                            size="small"
                            onClick={() => handleOpenDialog(influencer)}
                            className="text-blue-600 hover:bg-blue-50"
                          >
                            <RiEdit2Line />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton
                            size="small"
                            onClick={() => handleDelete(influencer._id)}
                            className="text-red-600 hover:bg-red-50"
                          >
                            <FaRegTrashAlt />
                          </IconButton>
                        </Tooltip>
                      </div>
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog
        open={openDialog}
        onClose={handleCloseDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {editingInfluencer ? "Edit Influencer" : "Add New Influencer"}
        </DialogTitle>
        <form onSubmit={handleSubmit}>
          <DialogContent className="space-y-4">
            {/* Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <TextField
                label="Name *"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                fullWidth
                required
              />
              <TextField
                label="Email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleInputChange}
                fullWidth
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <TextField
                label="Phone"
                name="phone"
                value={formData.phone}
                onChange={handleInputChange}
                fullWidth
              />
              <div className="flex gap-2">
                <TextField
                  label="Referral Code *"
                  name="code"
                  value={formData.code}
                  onChange={handleInputChange}
                  fullWidth
                  required
                  disabled={!!editingInfluencer}
                  inputProps={{ style: { textTransform: "uppercase" } }}
                  helperText={
                    editingInfluencer
                      ? "Code cannot be changed"
                      : "Unique code for referral link"
                  }
                />
                {!editingInfluencer && (
                  <Button
                    type="button"
                    variant="outlined"
                    onClick={generateCode}
                    className="whitespace-nowrap"
                  >
                    Generate
                  </Button>
                )}
              </div>
            </div>

            {/* Promotion Platforms */}
            <div className="border-t pt-4 mt-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium text-gray-700">
                  Promotion Platforms
                </h3>
                <Button
                  type="button"
                  variant="outlined"
                  size="small"
                  onClick={handleAddPromotionPlatform}
                >
                  + Add Platform
                </Button>
              </div>

              {formData.promotionPlatforms.length === 0 ? (
                <p className="text-xs text-gray-500">
                  Add platforms where this influencer promotes your products
                  (for example Instagram, YouTube).
                </p>
              ) : (
                <div className="space-y-3">
                  {indexPromotionPlatforms(formData.promotionPlatforms).map(
                    (entry, index) => (
                      <div
                        key={`${entry.platform}-${index}`}
                        className="grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-4 items-start md:items-center rounded-lg border border-gray-100 p-3"
                      >
                        <FormControl
                          fullWidth
                          size="small"
                          className="md:col-span-5"
                        >
                          <InputLabel>Platform</InputLabel>
                          <Select
                            value={entry.platform || ""}
                            onChange={(e) =>
                              handlePromotionPlatformChange(
                                index,
                                "platform",
                                e.target.value,
                              )
                            }
                            label="Platform"
                          >
                            {PLATFORM_OPTIONS.map((platform) => (
                              <MenuItem key={platform} value={platform}>
                                {platform}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                        <TextField
                          className="md:col-span-5"
                          label="Username / Handle"
                          value={entry.username || ""}
                          onChange={(e) =>
                            handlePromotionPlatformChange(
                              index,
                              "username",
                              e.target.value,
                            )
                          }
                          placeholder="@username"
                          fullWidth
                          size="small"
                        />
                        <div className="md:col-span-2 flex justify-end md:justify-center md:items-center h-full">
                          <Tooltip title="Remove platform">
                            <IconButton
                              color="error"
                              onClick={() => handleRemovePromotionPlatform(index)}
                            >
                              <FaRegTrashAlt />
                            </IconButton>
                          </Tooltip>
                        </div>
                      </div>
                    ),
                  )}
                </div>
              )}
            </div>

            {/* Discount Settings */}
            <div className="border-t pt-4 mt-4">
              <h3 className="font-medium text-gray-700 mb-3">
                Customer Discount Settings
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormControl fullWidth>
                  <InputLabel>Discount Type</InputLabel>
                  <Select
                    name="discountType"
                    value={formData.discountType}
                    onChange={handleInputChange}
                    label="Discount Type"
                  >
                    <MenuItem value="PERCENT">Percentage (%)</MenuItem>
                    <MenuItem value="FLAT">Flat Amount (₹)</MenuItem>
                  </Select>
                </FormControl>
                <TextField
                  label={
                    formData.discountType === "PERCENT"
                      ? "Discount Percentage *"
                      : "Discount Amount (₹) *"
                  }
                  name="discountValue"
                  type="number"
                  value={formData.discountValue}
                  onChange={handleInputChange}
                  fullWidth
                  required
                  inputProps={{ min: 0, step: 0.01 }}
                />
                <TextField
                  label="Max Discount (₹)"
                  name="maxDiscountAmount"
                  type="number"
                  value={formData.maxDiscountAmount}
                  onChange={handleInputChange}
                  fullWidth
                  inputProps={{ min: 0 }}
                  helperText="Leave empty for no limit"
                />
              </div>
              <div className="mt-3">
                <TextField
                  label="Minimum Order Amount (₹)"
                  name="minOrderAmount"
                  type="number"
                  value={formData.minOrderAmount}
                  onChange={handleInputChange}
                  fullWidth
                  inputProps={{ min: 0 }}
                  helperText="Minimum order value to apply discount"
                />
              </div>
            </div>

            {/* Commission Settings */}
            <div className="border-t pt-4 mt-4">
              <h3 className="font-medium text-gray-700 mb-3">
                Influencer Commission Settings
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormControl fullWidth>
                  <InputLabel>Commission Type</InputLabel>
                  <Select
                    name="commissionType"
                    value={formData.commissionType}
                    onChange={handleInputChange}
                    label="Commission Type"
                  >
                    <MenuItem value="PERCENT">Percentage (%)</MenuItem>
                    <MenuItem value="FLAT">Flat Amount (₹)</MenuItem>
                  </Select>
                </FormControl>
                <TextField
                  label={
                    formData.commissionType === "PERCENT"
                      ? "Commission Percentage *"
                      : "Commission Amount (₹) *"
                  }
                  name="commissionValue"
                  type="number"
                  value={formData.commissionValue}
                  onChange={handleInputChange}
                  fullWidth
                  required
                  inputProps={{ min: 0, step: 0.01 }}
                  helperText="Commission earned per successful order"
                />
              </div>
            </div>

            {/* Other Settings */}
            <div className="border-t pt-4 mt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <TextField
                  label="Expiry Date"
                  name="expiresAt"
                  type="date"
                  value={formData.expiresAt}
                  onChange={handleInputChange}
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                  helperText="Leave empty for no expiry"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.isActive}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          isActive: e.target.checked,
                        }))
                      }
                      color="primary"
                    />
                  }
                  label="Active"
                  className="mt-2"
                />
              </div>
              <TextField
                label="Notes (Internal)"
                name="notes"
                value={formData.notes}
                onChange={handleInputChange}
                fullWidth
                multiline
                rows={2}
                className="mt-4"
                helperText="Internal notes, not shown to customers"
              />
            </div>
          </DialogContent>
          <DialogActions className="px-6 pb-4">
            <Button onClick={handleCloseDialog}>Cancel</Button>
            <Button type="submit" variant="contained" color="primary">
              {editingInfluencer ? "Update" : "Create"} Influencer
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Statistics Dialog */}
      <Dialog
        open={openStatsDialog}
        onClose={() => {
          setOpenStatsDialog(false);
          setInfluencerStats(null);
        }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Statistics: {selectedInfluencer?.name}
          <Chip
            label={selectedInfluencer?.code}
            size="small"
            className="ml-2"
            color="secondary"
          />
        </DialogTitle>
        <DialogContent>
          {influencerStats ? (
            <div className="space-y-6">
              {/* Stats Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-purple-50 p-4 rounded-lg text-center">
                  <p className="text-2xl font-bold text-purple-600">
                    {influencerStats.stats?.totalOrders || 0}
                  </p>
                  <p className="text-sm text-gray-600">Total Orders</p>
                </div>
                <div className="bg-green-50 p-4 rounded-lg text-center">
                  <p className="text-2xl font-bold text-green-600">
                    {formatCurrency(influencerStats.stats?.totalRevenue)}
                  </p>
                  <p className="text-sm text-gray-600">Total Revenue</p>
                </div>
                <div className="bg-blue-50 p-4 rounded-lg text-center">
                  <p className="text-2xl font-bold text-blue-600">
                    {formatCurrency(influencerStats.stats?.totalCommission)}
                  </p>
                  <p className="text-sm text-gray-600">Total Commission</p>
                </div>
                <div className="bg-orange-50 p-4 rounded-lg text-center">
                  <p className="text-2xl font-bold text-orange-600">
                    {formatCurrency(influencerStats.stats?.pendingCommission)}
                  </p>
                  <p className="text-sm text-gray-600">Pending Payout</p>
                </div>
              </div>

              {/* Referral URL */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm font-medium text-gray-700 mb-2">
                  Referral URL
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-white border px-3 py-2 rounded text-sm break-all">
                    {influencerStats.influencer?.referralUrl || "-"}
                  </code>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => copyReferralUrl(influencerStats.influencer)}
                  >
                    Copy
                  </Button>
                </div>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm font-medium text-gray-700 mb-2">
                  Promotion Platforms
                </p>
                {Array.isArray(influencerStats.influencer?.promotionPlatforms) &&
                influencerStats.influencer.promotionPlatforms.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {indexPromotionPlatforms(
                      influencerStats.influencer.promotionPlatforms,
                    ).map((entry, idx) => (
                        <Chip
                          key={`${entry.platform}-${entry.username}-${idx}`}
                          size="small"
                          variant="outlined"
                          label={`${entry.displayPlatform}: @${entry.username}`}
                        />
                      ),
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-gray-500">Not set</p>
                )}
              </div>

              {/* Recent Orders */}
              {influencerStats.recentOrders &&
                influencerStats.recentOrders.length > 0 && (
                  <div>
                    <h3 className="font-medium text-gray-700 mb-3">
                      Recent Orders
                    </h3>
                    <TableContainer className="bg-white rounded border">
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Date</TableCell>
                            <TableCell>Order ID</TableCell>
                            <TableCell>Amount</TableCell>
                            <TableCell>Commission</TableCell>
                            <TableCell>Status</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {influencerStats.recentOrders.map((order) => (
                            <TableRow key={order._id}>
                              <TableCell>
                                {formatDate(order.createdAt)}
                              </TableCell>
                              <TableCell className="font-mono text-xs">
                                {order._id.slice(-8)}
                              </TableCell>
                              <TableCell>
                                {formatCurrency(order.finalAmount)}
                              </TableCell>
                              <TableCell>
                                {formatCurrency(order.influencerCommission)}
                              </TableCell>
                              <TableCell>
                                <Chip
                                  label={
                                    order.commissionPaid ? "Paid" : "Pending"
                                  }
                                  size="small"
                                  color={
                                    order.commissionPaid ? "success" : "warning"
                                  }
                                  variant="outlined"
                                />
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </div>
                )}
            </div>
          ) : (
            <div className="flex justify-center py-10">
              <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-purple-600"></div>
            </div>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setOpenStatsDialog(false);
              setInfluencerStats(null);
            }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default Influencers;
