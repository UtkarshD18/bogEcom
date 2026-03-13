"use client";

import { useAdmin } from "@/context/AdminContext";
import { deleteData, getData, patchData, postData, putData } from "@/utils/api";
import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
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
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { FaRegTrashAlt } from "react-icons/fa";
import { MdInfoOutline } from "react-icons/md";
import { RiEdit2Line, RiFileCopyLine } from "react-icons/ri";

const COMBO_TYPES = [
  { value: "fixed_bundle", label: "Fixed Bundle" },
  { value: "mix_match", label: "Mix & Match" },
  { value: "dynamic", label: "Dynamic Bundle" },
  { value: "frequently_bought_together", label: "Frequently Bought Together" },
  { value: "admin_curated", label: "Admin Curated" },
  { value: "ai_suggested", label: "AI Suggested" },
];

const PRICING_TYPES = [
  { value: "fixed_price", label: "Fixed Price" },
  { value: "percent_discount", label: "Percentage Discount" },
  { value: "fixed_discount", label: "Fixed Discount Amount" },
];

const SEGMENT_OPTIONS = [
  { value: "new", label: "New Customers" },
  { value: "returning", label: "Returning Customers" },
  { value: "high_value", label: "High Value Customers" },
];

const defaultFormData = {
  name: "",
  slug: "",
  description: "",
  image: "",
  thumbnail: "",
  comboType: "fixed_bundle",
  pricingType: "fixed_price",
  pricingValue: "",
  tags: "",
  priority: 0,
  isActive: true,
  isVisible: true,
  startDate: "",
  endDate: "",
  stockMode: "auto",
  stockQuantity: "",
  minOrderQuantity: 1,
  maxPerOrder: 0,
  segments: [],
  segmentCategories: "",
  geoTargets: "",
};

const defaultItem = { productId: "", quantity: 1, variantId: "", variantName: "" };

const round2 = (value) =>
  Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

const toSafeNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeDateValue = (value) => {
  if (!value) return "";
  const candidate = new Date(value);
  if (Number.isNaN(candidate.getTime())) return "";
  return candidate.toISOString().split("T")[0];
};

const buildItemsPreview = (items = []) => {
  const names = items
    .map((item) => item?.productTitle || item?.name)
    .filter(Boolean);
  const preview = names.slice(0, 3).join(", ");
  if (names.length > 3) {
    return `${preview} + ${names.length - 3} more`;
  }
  return preview;
};

const resolveSuggestionImage = (suggestion) => {
  if (!suggestion) return "/placeholder.png";
  const items = Array.isArray(suggestion.items) ? suggestion.items : [];
  return (
    suggestion.thumbnail ||
    suggestion.image ||
    items.find((item) => item?.image)?.image ||
    "/placeholder.png"
  );
};

const resolveComboTypeLabel = (value) => {
  const match = COMBO_TYPES.find((option) => option.value === value);
  if (match) return match.label;
  return String(value || "fixed_bundle").replace(/_/g, " ");
};

const HELP_SECTIONS = [
  {
    title: "Toolbar Buttons",
    items: [
      {
        label: "Search",
        description: "Filter combos by name or slug. Press Enter or click Search.",
      },
      {
        label: "AI Suggestions",
        description:
          "Previews draft combos from frequently-bought-together data. Created combos stay disabled until you activate them.",
      },
      {
        label: "Create Combo",
        description: "Opens the combo form. Save to create a new bundle.",
      },
    ],
  },
  {
    title: "Combo Basics",
    items: [
      { label: "Combo Name", description: "Primary title shown on storefront." },
      { label: "Combo Slug", description: "URL-friendly ID. Auto-generated if blank." },
      { label: "Description", description: "Short description for listings and SEO." },
      { label: "Banner Image URL", description: "Large hero image for combo pages." },
      { label: "Thumbnail URL", description: "Small card image used in grids." },
      { label: "Tags", description: "Comma-separated labels for badges and filters." },
      { label: "Priority", description: "Higher numbers rank the combo first." },
    ],
  },
  {
    title: "Pricing",
    items: [
      {
        label: "Pricing Type",
        description:
          "Fixed Price sets final price. Percent Discount applies % off. Fixed Discount subtracts ₹.",
      },
      {
        label: "Pricing Value",
        description: "Enter the number for the chosen pricing type.",
      },
      {
        label: "Pricing Preview",
        description: "Auto-calculated totals from selected items.",
      },
    ],
  },
  {
    title: "Schedule & Visibility",
    items: [
      { label: "Active", description: "Controls whether the combo can be used." },
      { label: "Visible", description: "Controls whether it appears on storefront." },
      {
        label: "Start/End Date",
        description: "Schedule combo availability. Leave blank for always on.",
      },
    ],
  },
  {
    title: "Stock & Limits",
    items: [
      {
        label: "Stock Mode",
        description:
          "Auto = uses lowest product inventory. Manual = use stock quantity below.",
      },
      {
        label: "Stock Quantity",
        description: "Only used for Manual stock mode.",
      },
      { label: "Min Order Quantity", description: "Minimum combos per order." },
      { label: "Max Per Order", description: "0 means no cap per order." },
    ],
  },
  {
    title: "Targeting",
    items: [
      {
        label: "Segments",
        description: "Target new, returning, or high value customers.",
      },
      {
        label: "Segment Categories",
        description: "Category IDs to restrict which products can see this combo.",
      },
      {
        label: "Geo Targets",
        description:
          "Comma-separated country/state/city or pincodes to limit availability.",
      },
    ],
  },
  {
    title: "Combo Items",
    items: [
      { label: "Product", description: "Select the product to include." },
      { label: "Variant", description: "Optional variant for that product." },
      { label: "Quantity", description: "Quantity of the product per combo." },
    ],
  },
  {
    title: "Row Actions",
    items: [
      { label: "Edit", description: "Modify combo details." },
      { label: "Duplicate", description: "Clone the combo as a draft copy." },
      { label: "Delete", description: "Permanently remove the combo." },
      { label: "Active Toggle", description: "Enable or disable the combo." },
    ],
  },
];

const formatGeoTarget = (target) => {
  if (!target) return "";
  if (typeof target === "string") return target.trim();
  const pincode = String(target.pincode || "").trim();
  if (pincode) return pincode;
  const city = String(target.city || "").trim();
  const state = String(target.state || "").trim();
  const country = String(target.country || "").trim();
  return [city, state, country].filter(Boolean).join("/");
};

const formatGeoTargets = (targets) =>
  Array.isArray(targets)
    ? targets
        .map(formatGeoTarget)
        .filter(Boolean)
        .join(", ")
    : "";

export default function ComboManagementPage() {
  const { token, isAuthenticated, loading } = useAdmin();
  const router = useRouter();

  const [combos, setCombos] = useState([]);
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionsError, setSuggestionsError] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [suggestionsMeta, setSuggestionsMeta] = useState(null);
  const [editingCombo, setEditingCombo] = useState(null);
  const [formData, setFormData] = useState(defaultFormData);
  const [comboItems, setComboItems] = useState([defaultItem]);

  const productMap = useMemo(
    () =>
      new Map(
        products.map((product) => [String(product._id || product.id), product]),
      ),
    [products],
  );

  const fetchCombos = useCallback(async () => {
    setIsLoading(true);
    try {
      const query = search ? `?search=${encodeURIComponent(search)}` : "";
      const response = await getData(`/api/combos/admin/all${query}`, token);
      if (response?.success) {
        setCombos(response.data?.items || response.data || []);
      } else {
        setCombos([]);
      }
    } catch (error) {
      setCombos([]);
    } finally {
      setIsLoading(false);
    }
  }, [search, token]);

  const fetchProducts = useCallback(async () => {
    try {
      const query = search ? `&search=${encodeURIComponent(search)}` : "";
      const response = await getData(`/api/products?limit=100${query}`, token);
      if (response?.success) {
        setProducts(response.data || response.products || []);
      }
    } catch (error) {
      // ignore
    }
  }, [search, token]);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, loading, router]);

  useEffect(() => {
    if (isAuthenticated && token) {
      fetchCombos();
      fetchProducts();
    }
  }, [isAuthenticated, token, fetchCombos, fetchProducts]);

  const pricingPreview = useMemo(() => {
    const itemTotals = comboItems.map((item) => {
      const product = productMap.get(String(item.productId || ""));
      if (!product) return 0;
      const variant = product?.variants?.find(
        (variantItem) => String(variantItem._id) === String(item.variantId),
      );
      const price = toSafeNumber(variant?.price ?? product.price, 0);
      const quantity = Math.max(toSafeNumber(item.quantity, 1), 1);
      return price * quantity;
    });
    const originalTotal = round2(itemTotals.reduce((sum, value) => sum + value, 0));
    const pricingValue = toSafeNumber(formData.pricingValue, 0);
    let comboPrice = originalTotal;

    if (formData.pricingType === "fixed_price" && pricingValue > 0) {
      comboPrice = pricingValue;
    }
    if (formData.pricingType === "percent_discount") {
      comboPrice = round2(originalTotal * (1 - pricingValue / 100));
    }
    if (formData.pricingType === "fixed_discount") {
      comboPrice = round2(originalTotal - pricingValue);
    }

    comboPrice = Math.max(comboPrice, 0);
    if (comboPrice > originalTotal) comboPrice = originalTotal;
    const savings = round2(Math.max(originalTotal - comboPrice, 0));
    const discountPercent = originalTotal > 0 ? round2((savings / originalTotal) * 100) : 0;

    return { originalTotal, comboPrice, savings, discountPercent };
  }, [comboItems, formData.pricingType, formData.pricingValue, productMap]);

  const suggestionStats = useMemo(() => {
    const scores = suggestions
      .map((suggestion) => Number(suggestion?.aiScore || 0))
      .filter((score) => Number.isFinite(score));
    const avgScore = scores.length
      ? round2(scores.reduce((sum, score) => sum + score, 0) / scores.length)
      : 0;
    return { avgScore };
  }, [suggestions]);

  const resetForm = () => {
    setFormData(defaultFormData);
    setComboItems([defaultItem]);
    setEditingCombo(null);
  };

  const handleOpenDialog = (combo = null) => {
    if (combo) {
      setEditingCombo(combo);
      setFormData({
        name: combo.name || "",
        slug: combo.slug || "",
        description: combo.description || "",
        image: combo.image || "",
        thumbnail: combo.thumbnail || "",
        comboType: combo.comboType || "fixed_bundle",
        pricingType: combo.pricing?.type || combo.pricingType || "fixed_price",
        pricingValue: combo.pricing?.value ?? combo.pricingValue ?? "",
        tags: Array.isArray(combo.tags) ? combo.tags.join(", ") : "",
        priority: combo.priority || 0,
        isActive: combo.isActive !== false,
        isVisible: combo.isVisible !== false,
        startDate: normalizeDateValue(combo.startDate),
        endDate: normalizeDateValue(combo.endDate),
        stockMode: combo.stockMode || "auto",
        stockQuantity: combo.stockQuantity || "",
        minOrderQuantity: combo.minOrderQuantity || 1,
        maxPerOrder: combo.maxPerOrder || 0,
        segments: combo.segmentTargets?.segments || [],
        segmentCategories: Array.isArray(combo.segmentTargets?.categories)
          ? combo.segmentTargets.categories.join(", ")
          : "",
        geoTargets: formatGeoTargets(combo.geoTargets),
      });
      setComboItems(
        Array.isArray(combo.items) && combo.items.length > 0
          ? combo.items.map((item) => ({
              productId: String(item.productId || ""),
              quantity: item.quantity || 1,
              variantId: item.variantId || "",
              variantName: item.variantName || "",
            }))
          : [defaultItem],
      );
    } else {
      resetForm();
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    resetForm();
  };

  const handleItemChange = (index, field, value) => {
    setComboItems((prev) => {
      const next = [...prev];
      const updated = { ...next[index], [field]: value };
      if (field === "productId") {
        updated.variantId = "";
        updated.variantName = "";
      }
      if (field === "variantId") {
        const product = productMap.get(String(updated.productId || ""));
        const variant = product?.variants?.find(
          (variantItem) => String(variantItem._id) === String(value),
        );
        updated.variantName = variant?.name || "";
      }
      next[index] = updated;
      return next;
    });
  };

  const handleAddItem = () => {
    setComboItems((prev) => [...prev, { ...defaultItem }]);
  };

  const handleRemoveItem = (index) => {
    setComboItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const buildPayload = () => {
    const payload = {
      name: formData.name.trim(),
      slug: formData.slug.trim() || undefined,
      description: formData.description.trim(),
      image: formData.image.trim(),
      thumbnail: formData.thumbnail.trim(),
      comboType: formData.comboType,
      pricingType: formData.pricingType,
      pricingValue: toSafeNumber(formData.pricingValue, 0),
      tags: formData.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      priority: toSafeNumber(formData.priority, 0),
      isActive: Boolean(formData.isActive),
      isVisible: Boolean(formData.isVisible),
      startDate: formData.startDate || null,
      endDate: formData.endDate || null,
      stockMode: formData.stockMode,
      stockQuantity:
        formData.stockMode === "manual" ? toSafeNumber(formData.stockQuantity, 0) : 0,
      minOrderQuantity: Math.max(toSafeNumber(formData.minOrderQuantity, 1), 1),
      maxPerOrder: Math.max(toSafeNumber(formData.maxPerOrder, 0), 0),
      segments: formData.segments,
      segmentCategories: formData.segmentCategories
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
      geoTargets: formData.geoTargets
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
      items: comboItems
        .map((item) => ({
          productId: item.productId,
          quantity: Math.max(toSafeNumber(item.quantity, 1), 1),
          variantId: item.variantId || undefined,
          variantName: item.variantName || undefined,
        }))
        .filter((item) => item.productId),
    };

    return payload;
  };

  const handleSaveCombo = async () => {
    if (!formData.name.trim()) {
      toast.error("Combo name is required");
      return;
    }

    if (!comboItems.some((item) => item.productId)) {
      toast.error("Select at least one product for the combo");
      return;
    }

    const payload = buildPayload();

    try {
      const response = editingCombo
        ? await putData(`/api/combos/admin/${editingCombo._id}`, payload, token)
        : await postData("/api/combos/admin/create", payload, token);

      if (response?.success) {
        toast.success(editingCombo ? "Combo updated" : "Combo created");
        handleCloseDialog();
        fetchCombos();
      } else {
        toast.error(response?.message || "Failed to save combo");
      }
    } catch (error) {
      toast.error("Failed to save combo");
    }
  };

  const handleDeleteCombo = async (comboId) => {
    if (!confirm("Are you sure you want to delete this combo?")) return;
    try {
      const response = await deleteData(`/api/combos/admin/${comboId}`, token);
      if (response?.success) {
        toast.success("Combo deleted");
        fetchCombos();
      } else {
        toast.error(response?.message || "Failed to delete combo");
      }
    } catch (error) {
      toast.error("Failed to delete combo");
    }
  };

  const handleDuplicateCombo = async (comboId) => {
    try {
      const response = await postData(`/api/combos/admin/${comboId}/duplicate`, {}, token);
      if (response?.success) {
        toast.success("Combo duplicated");
        fetchCombos();
      } else {
        toast.error(response?.message || "Failed to duplicate combo");
      }
    } catch (error) {
      toast.error("Failed to duplicate combo");
    }
  };

  const handleToggleCombo = async (combo) => {
    try {
      const response = await patchData(
        `/api/combos/admin/${combo._id}/toggle`,
        { isActive: !combo.isActive },
        token,
      );
      if (response?.success) {
        toast.success("Combo updated");
        fetchCombos();
      } else {
        toast.error(response?.message || "Failed to update combo");
      }
    } catch (error) {
      toast.error("Failed to update combo");
    }
  };

  const handleGenerateSuggestions = async () => {
    setSuggestionsOpen(true);
    setSuggestionsLoading(true);
    setSuggestionsError("");
    setSuggestions([]);
    setSuggestionsMeta(null);
    try {
      const response = await postData(
        "/api/combos/admin/suggestions",
        { limit: 6, previewOnly: true },
        token,
      );
      if (response?.success) {
        const previewSuggestions = Array.isArray(response?.data?.suggestions)
          ? response.data.suggestions
          : [];
        setSuggestions(previewSuggestions);
        setSuggestionsMeta(response?.data || null);
        if (previewSuggestions.length === 0) {
          setSuggestionsError(
            response?.message ||
              "No AI suggestions yet. Place a few orders to build pairings.",
          );
        }
      } else {
        setSuggestionsError(response?.message || "Failed to load AI suggestions");
      }
    } catch (error) {
      setSuggestionsError("Failed to load AI suggestions");
    } finally {
      setSuggestionsLoading(false);
    }
  };

  const handleCreateSuggestions = async () => {
    const createCount = suggestions.length || 6;
    if (createCount <= 0) {
      toast("No AI suggestions to create yet.");
      return;
    }
    setSuggestionsLoading(true);
    setSuggestionsError("");
    try {
      const response = await postData(
        "/api/combos/admin/suggestions",
        { limit: createCount },
        token,
      );
      if (response?.success) {
        const created = Array.isArray(response?.data?.suggestions)
          ? response.data.suggestions.length
          : Number(response?.data?.generated || 0);
        toast.success(
          `${created} AI combo suggestion${created === 1 ? "" : "s"} created`,
        );
        setSuggestionsOpen(false);
        setSuggestions([]);
        setSuggestionsMeta(null);
        fetchCombos();
      } else {
        setSuggestionsError(response?.message || "Failed to create AI combos");
      }
    } catch (error) {
      setSuggestionsError("Failed to create AI combos");
    } finally {
      setSuggestionsLoading(false);
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
    <section className="w-full py-3 px-5">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-[18px] text-gray-700 font-[600]">Combo Management</h2>
          <p className="text-xs text-gray-500">
            Create, schedule, and monitor bundle performance.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <TextField
            size="small"
            placeholder="Search combos"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && fetchCombos()}
          />
          <Tooltip title="Filter combos by name or slug">
            <span>
              <Button
                variant="outlined"
                onClick={() => fetchCombos()}
                className="!border-blue-600 !text-blue-600"
              >
                Search
              </Button>
            </span>
          </Tooltip>
          <Tooltip title="Preview AI combos from order pairings">
            <span>
              <Button variant="outlined" onClick={handleGenerateSuggestions}>
                AI Suggestions
              </Button>
            </span>
          </Tooltip>
          <Tooltip title="Create a new combo bundle">
            <span>
              <Button
                variant="contained"
                className="!bg-blue-600"
                onClick={() => handleOpenDialog()}
              >
                Create Combo
              </Button>
            </span>
          </Tooltip>
          <Tooltip title="How combo management works">
            <IconButton onClick={() => setHelpOpen(true)} size="small">
              <MdInfoOutline />
            </IconButton>
          </Tooltip>
        </div>
      </div>

      <TableContainer className="border border-gray-100 rounded-lg">
        <Table stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell>Combo</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Price</TableCell>
              <TableCell>Discount</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {combos.map((combo) => (
              <TableRow key={combo._id || combo.slug}>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-semibold text-gray-800">{combo.name}</span>
                    <span className="text-xs text-gray-500">{combo.slug}</span>
                  </div>
                </TableCell>
                <TableCell>{combo.comboType || "fixed_bundle"}</TableCell>
                <TableCell>₹{round2(combo.comboPrice || 0)}</TableCell>
                <TableCell>{round2(combo.discountPercentage || 0)}%</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Tooltip title="Enable or disable this combo">
                      <span>
                        <Switch
                          checked={combo.isActive !== false}
                          onChange={() => handleToggleCombo(combo)}
                          size="small"
                        />
                      </span>
                    </Tooltip>
                    <span className="text-xs text-gray-500">
                      {combo.isActive !== false ? "Active" : "Disabled"}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Tooltip title="Edit combo">
                      <span>
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => handleOpenDialog(combo)}
                        >
                          <RiEdit2Line />
                        </Button>
                      </span>
                    </Tooltip>
                    <Tooltip title="Duplicate combo">
                      <span>
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => handleDuplicateCombo(combo._id)}
                        >
                          <RiFileCopyLine />
                        </Button>
                      </span>
                    </Tooltip>
                    <Tooltip title="Delete combo">
                      <span>
                        <Button
                          size="small"
                          variant="outlined"
                          color="error"
                          onClick={() => handleDeleteCombo(combo._id)}
                        >
                          <FaRegTrashAlt />
                        </Button>
                      </span>
                    </Tooltip>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {combos.length === 0 && !isLoading && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-gray-500">
                  No combos found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="lg" fullWidth>
        <DialogTitle>
          <div className="flex items-center justify-between gap-2">
            <span>{editingCombo ? "Edit Combo" : "Create Combo"}</span>
            <Tooltip title="Combo field guide">
              <IconButton onClick={() => setHelpOpen(true)} size="small">
                <MdInfoOutline />
              </IconButton>
            </Tooltip>
          </div>
        </DialogTitle>
        <DialogContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <TextField
              label="Combo Name"
              value={formData.name}
              onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              helperText="Shown on storefront cards and analytics."
              fullWidth
            />
            <TextField
              label="Combo Slug"
              value={formData.slug}
              onChange={(e) => setFormData((prev) => ({ ...prev, slug: e.target.value }))}
              helperText="Leave blank to auto-generate from the name."
              fullWidth
            />
            <TextField
              label="Description"
              value={formData.description}
              onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
              helperText="Short summary displayed on combo detail views."
              fullWidth
            />
            <TextField
              label="Banner Image URL"
              value={formData.image}
              onChange={(e) => setFormData((prev) => ({ ...prev, image: e.target.value }))}
              helperText="Large hero image (optional)."
              fullWidth
            />
            <TextField
              label="Thumbnail URL"
              value={formData.thumbnail}
              onChange={(e) => setFormData((prev) => ({ ...prev, thumbnail: e.target.value }))}
              helperText="Square card image for grids."
              fullWidth
            />
            <TextField
              label="Tags (comma separated)"
              value={formData.tags}
              onChange={(e) => setFormData((prev) => ({ ...prev, tags: e.target.value }))}
              helperText="Comma-separated badges like best_seller, festival_deal."
              fullWidth
            />
            <TextField
              label="Priority"
              type="number"
              value={formData.priority}
              onChange={(e) => setFormData((prev) => ({ ...prev, priority: e.target.value }))}
              helperText="Higher number ranks this combo first."
              fullWidth
            />
            <div className="flex flex-col gap-2">
              <label className="text-xs text-gray-500">Combo Type</label>
              <Select
                value={formData.comboType}
                onChange={(e) => setFormData((prev) => ({ ...prev, comboType: e.target.value }))}
              >
                {COMBO_TYPES.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
              <p className="text-[11px] text-gray-500">
                Used for analytics and storefront labeling.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs text-gray-500">Pricing Type</label>
              <Select
                value={formData.pricingType}
                onChange={(e) => setFormData((prev) => ({ ...prev, pricingType: e.target.value }))}
              >
                {PRICING_TYPES.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
              <p className="text-[11px] text-gray-500">
                Fixed price or discount rule applied to totals.
              </p>
            </div>
            <TextField
              label="Pricing Value"
              type="number"
              value={formData.pricingValue}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, pricingValue: e.target.value }))
              }
              helperText="Enter ₹ amount or % depending on pricing type."
              fullWidth
            />
            <TextField
              label="Start Date"
              type="date"
              InputLabelProps={{ shrink: true }}
              value={formData.startDate}
              onChange={(e) => setFormData((prev) => ({ ...prev, startDate: e.target.value }))}
              helperText="Optional start date for scheduling."
              fullWidth
            />
            <TextField
              label="End Date"
              type="date"
              InputLabelProps={{ shrink: true }}
              value={formData.endDate}
              onChange={(e) => setFormData((prev) => ({ ...prev, endDate: e.target.value }))}
              helperText="Optional end date for scheduling."
              fullWidth
            />
            <div className="flex flex-col gap-2">
              <label className="text-xs text-gray-500">Stock Mode</label>
              <Select
                value={formData.stockMode}
                onChange={(e) => setFormData((prev) => ({ ...prev, stockMode: e.target.value }))}
              >
                <MenuItem value="auto">Auto</MenuItem>
                <MenuItem value="manual">Manual</MenuItem>
              </Select>
              <p className="text-[11px] text-gray-500">
                Auto uses lowest product stock; Manual uses stock quantity.
              </p>
            </div>
            <TextField
              label="Stock Quantity"
              type="number"
              value={formData.stockQuantity}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, stockQuantity: e.target.value }))
              }
              helperText="Only used when Stock Mode is Manual."
              fullWidth
              disabled={formData.stockMode !== "manual"}
            />
            <TextField
              label="Min Order Quantity"
              type="number"
              value={formData.minOrderQuantity}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, minOrderQuantity: e.target.value }))
              }
              helperText="Minimum bundles per order."
              fullWidth
            />
            <TextField
              label="Max Per Order"
              type="number"
              value={formData.maxPerOrder}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, maxPerOrder: e.target.value }))
              }
              helperText="0 means no per-order limit."
              fullWidth
            />
            <div className="flex flex-col gap-2">
              <label className="text-xs text-gray-500">Segments</label>
              <Select
                multiple
                value={formData.segments}
                onChange={(e) => setFormData((prev) => ({ ...prev, segments: e.target.value }))}
              >
                {SEGMENT_OPTIONS.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
              <p className="text-[11px] text-gray-500">
                Target specific customer segments (optional).
              </p>
            </div>
            <TextField
              label="Segment Categories (IDs, comma separated)"
              value={formData.segmentCategories}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, segmentCategories: e.target.value }))
              }
              helperText="Restrict combo visibility to category IDs."
              fullWidth
            />
            <TextField
              label="Geo Targets (comma separated)"
              value={formData.geoTargets}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, geoTargets: e.target.value }))
              }
              helperText="Add country/state/city or pincodes to target locations."
              fullWidth
            />
          </div>

          <div className="flex flex-wrap gap-6">
            <div className="flex flex-col">
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.isActive}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, isActive: e.target.checked }))
                    }
                  />
                }
                label="Active"
              />
              <p className="text-[11px] text-gray-500 ml-3">
                Disable to stop this combo from being purchasable.
              </p>
            </div>
            <div className="flex flex-col">
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.isVisible}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, isVisible: e.target.checked }))
                    }
                  />
                }
                label="Visible"
              />
              <p className="text-[11px] text-gray-500 ml-3">
                Hide from storefront listings without disabling it.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-700">Combo Items</h3>
            <p className="text-[11px] text-gray-500">
              Product = item included, Variant = optional, Quantity = per combo.
            </p>
            {comboItems.map((item, index) => {
              const product = productMap.get(String(item.productId || ""));
              const variants = Array.isArray(product?.variants) ? product.variants : [];
              return (
                <div key={index} className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div className="flex flex-col gap-1">
                    <Select
                      value={item.productId}
                      onChange={(e) => handleItemChange(index, "productId", e.target.value)}
                      displayEmpty
                    >
                      <MenuItem value="">Select Product</MenuItem>
                      {products.map((productItem) => (
                        <MenuItem key={productItem._id || productItem.id} value={productItem._id || productItem.id}>
                          {productItem.name}
                        </MenuItem>
                      ))}
                    </Select>
                    <p className="text-[10px] text-gray-500">
                      Product included in the combo.
                    </p>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Select
                      value={item.variantId || ""}
                      onChange={(e) => handleItemChange(index, "variantId", e.target.value)}
                      displayEmpty
                      disabled={!variants.length}
                    >
                      <MenuItem value="">Default Variant</MenuItem>
                      {variants.map((variant) => (
                        <MenuItem key={variant._id} value={variant._id}>
                          {variant.name || variant.sku}
                        </MenuItem>
                      ))}
                    </Select>
                    <p className="text-[10px] text-gray-500">
                      Optional variant for this product.
                    </p>
                  </div>
                  <TextField
                    label="Quantity"
                    type="number"
                    value={item.quantity}
                    onChange={(e) => handleItemChange(index, "quantity", e.target.value)}
                    helperText="Quantity per combo."
                  />
                  <Tooltip title="Remove this product from the combo">
                    <span>
                      <Button
                        variant="outlined"
                        color="error"
                        onClick={() => handleRemoveItem(index)}
                      >
                        Remove
                      </Button>
                    </span>
                  </Tooltip>
                </div>
              );
            })}
            <Tooltip title="Add another product to this combo">
              <span>
                <Button variant="outlined" onClick={handleAddItem}>
                  Add Product
                </Button>
              </span>
            </Tooltip>
          </div>

          <div className="rounded-lg bg-gray-50 p-4 text-sm text-gray-700">
            <p className="text-[11px] text-gray-500 mb-2">
              Preview updates automatically based on items and pricing.
            </p>
            <p>Original Total: ₹{pricingPreview.originalTotal}</p>
            <p>Combo Price: ₹{pricingPreview.comboPrice}</p>
            <p>Savings: ₹{pricingPreview.savings}</p>
            <p>Discount: {pricingPreview.discountPercent}%</p>
          </div>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleSaveCombo} variant="contained" className="!bg-blue-600">
            {editingCombo ? "Update Combo" : "Create Combo"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={suggestionsOpen}
        onClose={() => setSuggestionsOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-lg font-semibold text-gray-900">
                AI Combo Suggestions Preview
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Review AI-generated bundle drafts before saving them.
              </p>
            </div>
            <span className="text-[10px] uppercase tracking-widest text-blue-700 bg-blue-50 px-2 py-1 rounded-full">
              Preview Mode
            </span>
          </div>
        </DialogTitle>
        <DialogContent className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
              <p className="text-[10px] uppercase tracking-wider text-gray-500">
                Pairs Evaluated
              </p>
              <p className="text-lg font-semibold text-gray-900">
                {suggestionsMeta?.pairsEvaluated || 0}
              </p>
            </div>
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
              <p className="text-[10px] uppercase tracking-wider text-gray-500">
                Drafts Ready
              </p>
              <p className="text-lg font-semibold text-gray-900">
                {suggestionsMeta?.generated ?? (suggestions.length || 0)}
              </p>
            </div>
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
              <p className="text-[10px] uppercase tracking-wider text-gray-500">
                Avg AI Score
              </p>
              <p className="text-lg font-semibold text-gray-900">
                {suggestionStats.avgScore}
              </p>
            </div>
          </div>
          {suggestionsLoading && (
            <div className="flex items-center gap-3 rounded-xl border border-dashed border-blue-100 bg-blue-50/40 p-4 text-sm text-blue-700">
              <CircularProgress size={18} />
              <div>
                <p className="font-semibold">Scanning order pairings...</p>
                <p className="text-xs text-blue-600">
                  Building AI bundle previews from recent orders.
                </p>
              </div>
            </div>
          )}
          {!suggestionsLoading && suggestionsError && (
            <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-600">
              {suggestionsError}
            </div>
          )}
          {!suggestionsLoading && !suggestionsError && suggestions.length === 0 && (
            <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
              No AI suggestions yet. Place a few paid orders to build pairings.
            </div>
          )}
          {!suggestionsLoading && suggestions.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {suggestions.map((suggestion) => {
                const originalTotal = round2(Number(suggestion.originalTotal || 0));
                const comboPrice = round2(Number(suggestion.comboPrice || 0));
                const savings = round2(
                  Number(suggestion.totalSavings || originalTotal - comboPrice || 0),
                );
                const discountPercent =
                  originalTotal > 0
                    ? round2(((originalTotal - comboPrice) / originalTotal) * 100)
                    : round2(Number(suggestion.discountPercentage || 0));
                const tags = Array.isArray(suggestion.tags) ? suggestion.tags : [];
                const itemsPreview = buildItemsPreview(suggestion.items || []);
                const aiScore = round2(Number(suggestion.aiScore || 0));
                const comboTypeLabel = resolveComboTypeLabel(suggestion.comboType);
                return (
                  <div
                    key={suggestion.slug || suggestion.name}
                    className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm hover:shadow-md transition"
                  >
                    <div className="flex gap-4">
                      <div className="w-16 h-16 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center p-2 shrink-0">
                        <img
                          src={resolveSuggestionImage(suggestion)}
                          alt={suggestion.name || "Combo preview"}
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="text-sm font-semibold text-gray-900 line-clamp-1">
                            {suggestion.name}
                          </h4>
                          <div className="flex items-center gap-2">
                            {discountPercent > 0 && (
                              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                                {discountPercent}% off
                              </span>
                            )}
                            <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">
                              AI {aiScore}
                            </span>
                          </div>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          {itemsPreview || "Combo bundle preview"}
                        </p>
                        {tags.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {tags.slice(0, 3).map((tag) => (
                              <span
                                key={tag}
                                className="text-[9px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700"
                              >
                                {String(tag || "").replace(/_/g, " ")}
                              </span>
                            ))}
                          </div>
                        )}
                        <div className="mt-2 flex items-center gap-2 text-xs">
                          {originalTotal > comboPrice && (
                            <span className="text-gray-400 line-through">
                              ₹{originalTotal}
                            </span>
                          )}
                          <span className="text-gray-900 font-semibold">
                            ₹{comboPrice}
                          </span>
                          {savings > 0 && (
                            <span className="text-emerald-600">
                              Save ₹{savings}
                            </span>
                          )}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-gray-500">
                          <span className="rounded-full border border-gray-100 bg-gray-50 px-2 py-0.5">
                            {comboTypeLabel}
                          </span>
                          <span className="rounded-full border border-gray-100 bg-gray-50 px-2 py-0.5">
                            Source: {suggestion.generatedFrom || "AI"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleGenerateSuggestions} disabled={suggestionsLoading}>
            Refresh Preview
          </Button>
          <Button
            variant="contained"
            className="!bg-blue-600"
            onClick={handleCreateSuggestions}
            disabled={suggestionsLoading || suggestions.length === 0}
          >
            Create Draft Combos
          </Button>
          <Button onClick={() => setSuggestionsOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={helpOpen} onClose={() => setHelpOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Combo Management Help</DialogTitle>
        <DialogContent className="space-y-4">
          <p className="text-sm text-gray-600">
            Use this guide to understand each control and section while creating combos.
          </p>
          {HELP_SECTIONS.map((section) => (
            <div key={section.title} className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-800">
                {section.title}
              </h3>
              <ul className="list-disc pl-5 text-sm text-gray-600 space-y-1">
                {section.items.map((item) => (
                  <li key={`${section.title}-${item.label}`}>
                    <span className="font-semibold text-gray-700">
                      {item.label}:
                    </span>{" "}
                    {item.description}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setHelpOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </section>
  );
}
