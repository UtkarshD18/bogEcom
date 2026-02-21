"use client";

import { useAdmin } from "@/context/AdminContext";
import { deleteData, getData, postData, putData } from "@/utils/api";
import {
  Button,
  CircularProgress,
  FormControlLabel,
  Switch,
  TextField,
} from "@mui/material";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { FaEdit, FaHome, FaPlus, FaStar, FaTrash } from "react-icons/fa";

const PAGE_THEMES = [
  { key: "mint", label: "Mint Glass" },
  { key: "sky", label: "Sky Glass" },
  { key: "aurora", label: "Aurora Glass" },
  { key: "lavender", label: "Lavender Glass" },
  { key: "sunset", label: "Sunset Glass" },
  { key: "midnight", label: "Midnight Glass" },
];

const DEFAULT_HOME_CONTENT = {
  title: "Join Our Buy One Gram Club",
  subtitle:
    "Unlock premium benefits, exclusive savings, and prioritize your health journey with us.",
  benefits: [
    {
      emoji: "💰",
      title: "Save ₹2000+",
      description: "Annually with discounts",
    },
    { emoji: "📦", title: "Free Shipping", description: "On all your orders" },
    {
      emoji: "🎧",
      title: "24/7 Support",
      description: "Dedicated member hotline",
    },
    {
      emoji: "🚀",
      title: "Early Access",
      description: "To new product launches",
    },
  ],
  checkItems: [
    { text: "15% discount on all orders" },
    { text: "Free shipping on every purchase" },
    { text: "Exclusive member-only products" },
    { text: "Priority customer support" },
    { text: "Monthly wellness tips & guides" },
  ],
  ctaButtonText: "Explore Plans",
  ctaButtonLink: "/membership",
};

const DEFAULT_PAGE_CONTENT = {
  theme: { style: "mint" },
  hero: {
    badge: "Premium Membership",
    title: "Buy One Gram Club",
    titleHighlight: "Premium",
    description:
      "Join our exclusive community and unlock premium benefits designed for your wellness journey.",
    note: "Limited member slots refreshed monthly",
  },
  benefits: {
    title: "Unlock Exclusive Benefits",
    subtitle:
      "Start earning rewards today and take your health journey to the next level with premium perks.",
    items: [
      {
        icon: "⭐",
        title: "Earn Points",
        description:
          "Get 1 point for every ₹1 spent. Redeem points for discounts and exclusive products.",
      },
    ],
  },
  pricing: {
    title: "Simple, honest pricing",
    subtitle: "One plan. All benefits. Cancel anytime.",
    ctaText: "Join Membership",
    note: "Instant access after checkout.",
  },
  cta: {
    title: "Ready to upgrade your daily nutrition?",
    description:
      "Members get early access, exclusive drops, and a smoother checkout experience.",
    buttonText: "Explore Plans",
    buttonLink: "/membership",
  },
};

export default function MembershipPage() {
  const { token } = useAdmin();
  const router = useRouter();
  const [plans, setPlans] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("plans");

  const [pageLoading, setPageLoading] = useState(false);
  const [pageSaving, setPageSaving] = useState(false);
  const [pageContent, setPageContent] = useState(DEFAULT_PAGE_CONTENT);

  // Home Membership Content state
  const [homeContentLoading, setHomeContentLoading] = useState(false);
  const [homeContentSaving, setHomeContentSaving] = useState(false);
  const [homeContent, setHomeContent] = useState(DEFAULT_HOME_CONTENT);
  const [showForm, setShowForm] = useState(false);
  const authFailureHandledRef = useRef(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: "",
    discountPercentage: "0",
    originalPrice: "",
    durationDays: "365",
    durationUnit: "days",
    benefits: "",
    active: false,
  });

  const handleAdminAuthFailure = useCallback(
    (message) => {
      const normalized = String(message || "").toLowerCase();
      const isAuthFailure =
        normalized.includes("admin access required") ||
        normalized.includes("authentication required") ||
        normalized.includes("please provide token") ||
        normalized.includes("invalid token") ||
        normalized.includes("token expired") ||
        normalized.includes("unauthorized");

      if (!isAuthFailure) return false;
      if (authFailureHandledRef.current) return true;

      authFailureHandledRef.current = true;
      if (typeof window !== "undefined") {
        localStorage.removeItem("adminToken");
        localStorage.removeItem("adminUser");
      }
      toast.error("Admin session expired. Please login again.");
      router.replace("/login");
      return true;
    },
    [router],
  );

  const fetchPlans = useCallback(async () => {
    const res = await getData("/api/membership/admin/plans", token);
    if (res.success) {
      setPlans(res.data);
    } else if (!handleAdminAuthFailure(res.message)) {
      console.warn("Failed to fetch plans:", res.message);
    } else {
      setPlans([]);
    }
  }, [token, handleAdminAuthFailure]);

  const fetchPageContent = useCallback(async () => {
    setPageLoading(true);
    const res = await getData("/api/membership/page/admin", token);
    if (res.success && res.data) {
      setPageContent({
        ...DEFAULT_PAGE_CONTENT,
        ...res.data,
        hero: { ...DEFAULT_PAGE_CONTENT.hero, ...(res.data.hero || {}) },
        benefits: {
          ...DEFAULT_PAGE_CONTENT.benefits,
          ...(res.data.benefits || {}),
        },
        pricing: {
          ...DEFAULT_PAGE_CONTENT.pricing,
          ...(res.data.pricing || {}),
        },
        cta: { ...DEFAULT_PAGE_CONTENT.cta, ...(res.data.cta || {}) },
        theme: { ...DEFAULT_PAGE_CONTENT.theme, ...(res.data.theme || {}) },
      });
    } else if (!handleAdminAuthFailure(res.message)) {
      console.warn("Failed to fetch membership page content:", res.message);
    }
    setPageLoading(false);
  }, [token, handleAdminAuthFailure]);

  const fetchHomeContent = useCallback(async () => {
    setHomeContentLoading(true);
    const res = await getData("/api/membership/home-content/admin", token);
    if (res.success && res.data) {
      setHomeContent({
        ...DEFAULT_HOME_CONTENT,
        ...res.data,
        benefits: res.data.benefits?.length
          ? res.data.benefits
          : DEFAULT_HOME_CONTENT.benefits,
        checkItems: res.data.checkItems?.length
          ? res.data.checkItems
          : DEFAULT_HOME_CONTENT.checkItems,
      });
    } else if (!handleAdminAuthFailure(res.message)) {
      console.warn("Failed to fetch home membership content:", res.message);
    }
    setHomeContentLoading(false);
  }, [token, handleAdminAuthFailure]);

  const fetchHomeContent = useCallback(async () => {
    setHomeContentLoading(true);
    const res = await getData("/api/membership/home-content/admin", token);
    if (res.success && res.data) {
      setHomeContent({
        ...DEFAULT_HOME_CONTENT,
        ...res.data,
        benefits: res.data.benefits?.length
          ? res.data.benefits
          : DEFAULT_HOME_CONTENT.benefits,
        checkItems: res.data.checkItems?.length
          ? res.data.checkItems
          : DEFAULT_HOME_CONTENT.checkItems,
      });
    }
    setHomeContentLoading(false);
  }, [token]);

  const fetchStats = useCallback(async () => {
    const res = await getData("/api/membership/admin/stats", token);
    if (res.success) {
      setStats(res.data);
    } else if (!handleAdminAuthFailure(res.message)) {
      console.warn("Failed to fetch membership stats:", res.message);
    }
  }, [token, handleAdminAuthFailure]);

  useEffect(() => {
    // Wait for token to be available from AdminContext
    if (!token) return;

    const init = async () => {
      await Promise.all([
        fetchPlans(),
        fetchStats(),
        fetchPageContent(),
        fetchHomeContent(),
      ]);
      setLoading(false);
    };
    init();
  }, [token, fetchPlans, fetchStats, fetchPageContent, fetchHomeContent]);

  const addBenefit = () => {
    setPageContent((prev) => ({
      ...prev,
      benefits: {
        ...prev.benefits,
        items: [
          ...(prev.benefits?.items || []),
          { icon: "✨", title: "", description: "" },
        ],
      },
    }));
  };

  const removeBenefit = (index) => {
    setPageContent((prev) => ({
      ...prev,
      benefits: {
        ...prev.benefits,
        items: prev.benefits.items.filter((_, i) => i !== index),
      },
    }));
  };

  const updateBenefit = (index, field, value) => {
    setPageContent((prev) => {
      const items = [...(prev.benefits?.items || [])];
      items[index] = { ...items[index], [field]: value };
      return {
        ...prev,
        benefits: { ...prev.benefits, items },
      };
    });
  };

  const savePageContent = async () => {
    setPageSaving(true);
    const res = await putData("/api/membership/page/admin", pageContent, token);
    if (res.success) {
      toast.success("Membership page updated");
      fetchPageContent();
    } else {
      toast.error(res.message || "Failed to save membership page");
    }
    setPageSaving(false);
  };

  // ---- Home Content CRUD ----
  const addHomeBenefit = () => {
    setHomeContent((prev) => ({
      ...prev,
      benefits: [
        ...(prev.benefits || []),
        { emoji: "✨", title: "", description: "" },
      ],
    }));
  };

  const removeHomeBenefit = (index) => {
    setHomeContent((prev) => ({
      ...prev,
      benefits: prev.benefits.filter((_, i) => i !== index),
    }));
  };

  const updateHomeBenefit = (index, field, value) => {
    setHomeContent((prev) => {
      const items = [...(prev.benefits || [])];
      items[index] = { ...items[index], [field]: value };
      return { ...prev, benefits: items };
    });
  };

  const addHomeCheckItem = () => {
    setHomeContent((prev) => ({
      ...prev,
      checkItems: [...(prev.checkItems || []), { text: "" }],
    }));
  };

  const removeHomeCheckItem = (index) => {
    setHomeContent((prev) => ({
      ...prev,
      checkItems: prev.checkItems.filter((_, i) => i !== index),
    }));
  };

  const updateHomeCheckItem = (index, value) => {
    setHomeContent((prev) => {
      const items = [...(prev.checkItems || [])];
      items[index] = { ...items[index], text: value };
      return { ...prev, checkItems: items };
    });
  };

  const saveHomeContent = async () => {
    setHomeContentSaving(true);
    const res = await putData(
      "/api/membership/home-content/admin",
      homeContent,
      token,
    );
    if (res.success) {
      toast.success("Home membership content updated");
      fetchHomeContent();
    } else {
      toast.error(res.message || "Failed to save home membership content");
    }
    setHomeContentSaving(false);
  };

  const resetHomeContent = async () => {
    if (!confirm("Reset home membership content to defaults?")) return;
    const res = await postData(
      "/api/membership/home-content/admin/reset",
      {},
      token,
    );
    if (res.success && res.data) {
      setHomeContent({
        ...DEFAULT_HOME_CONTENT,
        ...res.data,
        benefits: res.data.benefits?.length
          ? res.data.benefits
          : DEFAULT_HOME_CONTENT.benefits,
        checkItems: res.data.checkItems?.length
          ? res.data.checkItems
          : DEFAULT_HOME_CONTENT.checkItems,
      });
      toast.success("Home membership content reset");
    } else {
      toast.error(res.message || "Failed to reset home membership content");
    }
  };

  const resetPageContent = async () => {
    if (!confirm("Reset membership page to defaults?")) return;
    const res = await postData("/api/membership/page/admin/reset", {}, token);
    if (res.success && res.data) {
      setPageContent({
        ...DEFAULT_PAGE_CONTENT,
        ...res.data,
        hero: { ...DEFAULT_PAGE_CONTENT.hero, ...(res.data.hero || {}) },
        benefits: {
          ...DEFAULT_PAGE_CONTENT.benefits,
          ...(res.data.benefits || {}),
        },
        pricing: {
          ...DEFAULT_PAGE_CONTENT.pricing,
          ...(res.data.pricing || {}),
        },
        cta: { ...DEFAULT_PAGE_CONTENT.cta, ...(res.data.cta || {}) },
        theme: { ...DEFAULT_PAGE_CONTENT.theme, ...(res.data.theme || {}) },
      });
      toast.success("Membership page reset");
    } else {
      toast.error(res.message || "Failed to reset membership page");
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      price: "",
      discountPercentage: "0",
      originalPrice: "",
      durationDays: "365",
      durationUnit: "days",
      benefits: "",
      active: false,
    });
    setEditingPlan(null);
    setShowForm(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const payload = {
      ...formData,
      price: Number(formData.price),
      discountPercentage: Number(formData.discountPercentage || 0),
      originalPrice: Number(formData.originalPrice) || 0,
      durationDays: Number(formData.durationDays),
      duration: Number(formData.durationDays),
      active: Boolean(formData.active),
      isActive: Boolean(formData.active),
      benefits: formData.benefits.split("\n").filter((b) => b.trim()),
    };

    let res;
    if (editingPlan) {
      res = await putData(
        `/api/membership/admin/plans/${editingPlan._id}`,
        payload,
        token,
      );
    } else {
      res = await postData("/api/membership/admin/plans", payload, token);
    }

    if (res.success) {
      toast.success(editingPlan ? "Plan updated" : "Plan created");
      resetForm();
      fetchPlans();
    } else {
      toast.error(res.message || "Operation failed");
    }
  };

  const handleEdit = (plan) => {
    setEditingPlan(plan);
    setFormData({
      name: plan.name,
      description: plan.description || "",
      price: plan.price.toString(),
      discountPercentage: String(
        plan.discountPercentage ?? plan.discountPercent ?? 0,
      ),
      originalPrice: plan.originalPrice?.toString() || "",
      durationDays: String(plan.durationDays || plan.duration || 365),
      durationUnit: plan.durationUnit,
      benefits: plan.benefits?.join("\n") || "",
      active: Boolean(plan.active ?? plan.isActive),
    });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this plan?")) return;
    const res = await deleteData(`/api/membership/admin/plans/${id}`, token);
    if (res.success) {
      toast.success("Plan deleted");
      fetchPlans();
    } else {
      toast.error("Failed to delete plan");
    }
  };

  const handleActivate = async (id) => {
    const res = await putData(
      `/api/membership/admin/plans/${id}/activate`,
      {},
      token,
    );
    if (res.success) {
      toast.success("Plan activated");
      fetchPlans();
    } else {
      toast.error("Failed to activate plan");
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <CircularProgress />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Membership</h1>
          <p className="text-gray-500 text-sm">
            Manage plans and the membership landing page.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={activeTab === "plans" ? "contained" : "outlined"}
            onClick={() => setActiveTab("plans")}
          >
            Plans
          </Button>
          <Button
            variant={activeTab === "page" ? "contained" : "outlined"}
            onClick={() => setActiveTab("page")}
          >
            Page Content
          </Button>
          <Button
            variant={activeTab === "homeContent" ? "contained" : "outlined"}
            onClick={() => setActiveTab("homeContent")}
            startIcon={<FaHome />}
          >
            Home Membership Content
          </Button>
          {activeTab === "plans" && (
            <Button
              variant="contained"
              startIcon={<FaPlus />}
              onClick={() => setShowForm(true)}
              sx={{
                backgroundColor: "#c1591c",
                "&:hover": { backgroundColor: "#a04a17" },
              }}
            >
              Add Plan
            </Button>
          )}
          {activeTab === "page" && (
            <>
              <Button variant="outlined" onClick={resetPageContent}>
                Reset
              </Button>
              <Button
                variant="contained"
                onClick={savePageContent}
                disabled={pageSaving}
                sx={{
                  backgroundColor: "#c1591c",
                  "&:hover": { backgroundColor: "#a04a17" },
                }}
              >
                {pageSaving ? "Saving..." : "Save Page"}
              </Button>
            </>
          )}
          {activeTab === "homeContent" && (
            <>
              <Button variant="outlined" onClick={resetHomeContent}>
                Reset
              </Button>
              <Button
                variant="contained"
                onClick={saveHomeContent}
                disabled={homeContentSaving}
                sx={{
                  backgroundColor: "#c1591c",
                  "&:hover": { backgroundColor: "#a04a17" },
                }}
              >
                {homeContentSaving ? "Saving..." : "Save Home Content"}
              </Button>
            </>
          )}
        </div>
      </div>

      {activeTab === "plans" && (
        <>
          {/* Stats */}
          {stats && (
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-white p-4 rounded-lg shadow">
                <p className="text-gray-500 text-sm">Total Members</p>
                <p className="text-2xl font-bold text-gray-800">
                  {stats.totalMembers}
                </p>
              </div>
              <div className="bg-white p-4 rounded-lg shadow">
                <p className="text-gray-500 text-sm">Active Members</p>
                <p className="text-2xl font-bold text-green-600">
                  {stats.activeMembers}
                </p>
              </div>
              <div className="bg-white p-4 rounded-lg shadow">
                <p className="text-gray-500 text-sm">Expired Members</p>
                <p className="text-2xl font-bold text-red-500">
                  {stats.expiredMembers}
                </p>
              </div>
            </div>
          )}
        </>
      )}

      {activeTab === "page" && (
        <div className="space-y-6">
          {pageLoading ? (
            <div className="flex items-center justify-center h-40">
              <CircularProgress />
            </div>
          ) : (
            <>
              <div className="bg-white rounded-xl shadow p-5">
                <h2 className="text-lg font-semibold text-gray-800 mb-4">
                  Page Theme
                </h2>
                <Select
                  value={pageContent?.theme?.style || "mint"}
                  onChange={(e) =>
                    setPageContent((prev) => ({
                      ...prev,
                      theme: { ...(prev.theme || {}), style: e.target.value },
                    }))
                  }
                  size="small"
                >
                  {PAGE_THEMES.map((theme) => (
                    <MenuItem key={theme.key} value={theme.key}>
                      {theme.label}
                    </MenuItem>
                  ))}
                </Select>
              </div>

              <div className="bg-white rounded-xl shadow p-5">
                <h2 className="text-lg font-semibold text-gray-800 mb-4">
                  Hero Section
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <TextField
                    label="Badge"
                    value={pageContent.hero.badge}
                    onChange={(e) =>
                      setPageContent((prev) => ({
                        ...prev,
                        hero: { ...prev.hero, badge: e.target.value },
                      }))
                    }
                    size="small"
                    fullWidth
                  />
                  <TextField
                    label="Title"
                    value={pageContent.hero.title}
                    onChange={(e) =>
                      setPageContent((prev) => ({
                        ...prev,
                        hero: { ...prev.hero, title: e.target.value },
                      }))
                    }
                    size="small"
                    fullWidth
                  />
                  <TextField
                    label="Title Highlight"
                    value={pageContent.hero.titleHighlight}
                    onChange={(e) =>
                      setPageContent((prev) => ({
                        ...prev,
                        hero: { ...prev.hero, titleHighlight: e.target.value },
                      }))
                    }
                    size="small"
                    fullWidth
                  />
                  <TextField
                    label="Note"
                    value={pageContent.hero.note}
                    onChange={(e) =>
                      setPageContent((prev) => ({
                        ...prev,
                        hero: { ...prev.hero, note: e.target.value },
                      }))
                    }
                    size="small"
                    fullWidth
                  />
                  <TextField
                    label="Description"
                    value={pageContent.hero.description}
                    onChange={(e) =>
                      setPageContent((prev) => ({
                        ...prev,
                        hero: { ...prev.hero, description: e.target.value },
                      }))
                    }
                    size="small"
                    fullWidth
                    multiline
                    rows={3}
                    className="md:col-span-2"
                  />
                </div>
              </div>

              <div className="bg-white rounded-xl shadow p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-800">
                    Benefits Section
                  </h2>
                  <Button
                    size="small"
                    onClick={addBenefit}
                    startIcon={<FaPlus />}
                  >
                    Add Benefit
                  </Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <TextField
                    label="Title"
                    value={pageContent.benefits.title}
                    onChange={(e) =>
                      setPageContent((prev) => ({
                        ...prev,
                        benefits: { ...prev.benefits, title: e.target.value },
                      }))
                    }
                    size="small"
                    fullWidth
                  />
                  <TextField
                    label="Subtitle"
                    value={pageContent.benefits.subtitle}
                    onChange={(e) =>
                      setPageContent((prev) => ({
                        ...prev,
                        benefits: {
                          ...prev.benefits,
                          subtitle: e.target.value,
                        },
                      }))
                    }
                    size="small"
                    fullWidth
                  />
                </div>
                <div className="space-y-3">
                  {pageContent.benefits.items.map((item, index) => (
                    <div
                      key={index}
                      className="bg-gray-50 rounded-lg p-3 flex gap-2 items-start"
                    >
                      <TextField
                        label="Icon"
                        value={item.icon}
                        onChange={(e) =>
                          updateBenefit(index, "icon", e.target.value)
                        }
                        size="small"
                        sx={{ width: 80 }}
                      />
                      <TextField
                        label="Title"
                        value={item.title}
                        onChange={(e) =>
                          updateBenefit(index, "title", e.target.value)
                        }
                        size="small"
                        sx={{ width: 160 }}
                      />
                      <TextField
                        label="Description"
                        value={item.description}
                        onChange={(e) =>
                          updateBenefit(index, "description", e.target.value)
                        }
                        size="small"
                        fullWidth
                      />
                      <Button
                        size="small"
                        color="error"
                        onClick={() => removeBenefit(index)}
                      >
                        <FaTrash />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-xl shadow p-5">
                <h2 className="text-lg font-semibold text-gray-800 mb-4">
                  Pricing Section
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <TextField
                    label="Title"
                    value={pageContent.pricing.title}
                    onChange={(e) =>
                      setPageContent((prev) => ({
                        ...prev,
                        pricing: { ...prev.pricing, title: e.target.value },
                      }))
                    }
                    size="small"
                    fullWidth
                  />
                  <TextField
                    label="Subtitle"
                    value={pageContent.pricing.subtitle}
                    onChange={(e) =>
                      setPageContent((prev) => ({
                        ...prev,
                        pricing: { ...prev.pricing, subtitle: e.target.value },
                      }))
                    }
                    size="small"
                    fullWidth
                  />
                  <TextField
                    label="CTA Text"
                    value={pageContent.pricing.ctaText}
                    onChange={(e) =>
                      setPageContent((prev) => ({
                        ...prev,
                        pricing: { ...prev.pricing, ctaText: e.target.value },
                      }))
                    }
                    size="small"
                    fullWidth
                  />
                  <TextField
                    label="Note"
                    value={pageContent.pricing.note}
                    onChange={(e) =>
                      setPageContent((prev) => ({
                        ...prev,
                        pricing: { ...prev.pricing, note: e.target.value },
                      }))
                    }
                    size="small"
                    fullWidth
                  />
                </div>
              </div>

              <div className="bg-white rounded-xl shadow p-5">
                <h2 className="text-lg font-semibold text-gray-800 mb-4">
                  CTA Section
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <TextField
                    label="Title"
                    value={pageContent.cta.title}
                    onChange={(e) =>
                      setPageContent((prev) => ({
                        ...prev,
                        cta: { ...prev.cta, title: e.target.value },
                      }))
                    }
                    size="small"
                    fullWidth
                  />
                  <TextField
                    label="Button Text"
                    value={pageContent.cta.buttonText}
                    onChange={(e) =>
                      setPageContent((prev) => ({
                        ...prev,
                        cta: { ...prev.cta, buttonText: e.target.value },
                      }))
                    }
                    size="small"
                    fullWidth
                  />
                  <TextField
                    label="Button Link"
                    value={pageContent.cta.buttonLink}
                    onChange={(e) =>
                      setPageContent((prev) => ({
                        ...prev,
                        cta: { ...prev.cta, buttonLink: e.target.value },
                      }))
                    }
                    size="small"
                    fullWidth
                  />
                  <TextField
                    label="Description"
                    value={pageContent.cta.description}
                    onChange={(e) =>
                      setPageContent((prev) => ({
                        ...prev,
                        cta: { ...prev.cta, description: e.target.value },
                      }))
                    }
                    size="small"
                    fullWidth
                    multiline
                    rows={2}
                    className="md:col-span-2"
                  />
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ==================== HOME MEMBERSHIP CONTENT TAB ==================== */}
      {activeTab === "homeContent" && (
        <div className="space-y-6">
          {homeContentLoading ? (
            <div className="flex items-center justify-center h-40">
              <CircularProgress />
            </div>
          ) : (
            <>
              {/* Title & Subtitle */}
              <div className="bg-white rounded-xl shadow p-5">
                <h2 className="text-lg font-semibold text-gray-800 mb-4">
                  Title & Subtitle
                </h2>
                <div className="grid grid-cols-1 gap-4">
                  <TextField
                    label="Title"
                    value={homeContent.title}
                    onChange={(e) =>
                      setHomeContent((prev) => ({
                        ...prev,
                        title: e.target.value,
                      }))
                    }
                    size="small"
                    fullWidth
                    placeholder="e.g. Join Our Buy One Gram Club"
                  />
                  <TextField
                    label="Subtitle / Description"
                    value={homeContent.subtitle}
                    onChange={(e) =>
                      setHomeContent((prev) => ({
                        ...prev,
                        subtitle: e.target.value,
                      }))
                    }
                    size="small"
                    fullWidth
                    multiline
                    rows={3}
                  />
                </div>
              </div>

              {/* Benefit Cards (right-side grid on Home) */}
              <div className="bg-white rounded-xl shadow p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-800">
                    Benefit Cards
                  </h2>
                  <Button
                    size="small"
                    onClick={addHomeBenefit}
                    startIcon={<FaPlus />}
                  >
                    Add Card
                  </Button>
                </div>
                <p className="text-gray-400 text-xs mb-3">
                  These are the 4 cards shown on the right side of the home
                  membership section.
                </p>
                <div className="space-y-3">
                  {(homeContent.benefits || []).map((item, index) => (
                    <div
                      key={index}
                      className="bg-gray-50 rounded-lg p-3 flex gap-2 items-start"
                    >
                      <TextField
                        label="Emoji"
                        value={item.emoji}
                        onChange={(e) =>
                          updateHomeBenefit(index, "emoji", e.target.value)
                        }
                        size="small"
                        sx={{ width: 80 }}
                      />
                      <TextField
                        label="Title"
                        value={item.title}
                        onChange={(e) =>
                          updateHomeBenefit(index, "title", e.target.value)
                        }
                        size="small"
                        sx={{ width: 180 }}
                      />
                      <TextField
                        label="Description"
                        value={item.description}
                        onChange={(e) =>
                          updateHomeBenefit(
                            index,
                            "description",
                            e.target.value,
                          )
                        }
                        size="small"
                        fullWidth
                      />
                      <Button
                        size="small"
                        color="error"
                        onClick={() => removeHomeBenefit(index)}
                      >
                        <FaTrash />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Check Items (bullet points on left) */}
              <div className="bg-white rounded-xl shadow p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-800">
                    Check-list Items
                  </h2>
                  <Button
                    size="small"
                    onClick={addHomeCheckItem}
                    startIcon={<FaPlus />}
                  >
                    Add Item
                  </Button>
                </div>
                <p className="text-gray-400 text-xs mb-3">
                  These appear as green-check bullet points on the left side.
                </p>
                <div className="space-y-3">
                  {(homeContent.checkItems || []).map((item, index) => (
                    <div
                      key={index}
                      className="bg-gray-50 rounded-lg p-3 flex gap-2 items-center"
                    >
                      <TextField
                        label={`Item ${index + 1}`}
                        value={item.text}
                        onChange={(e) =>
                          updateHomeCheckItem(index, e.target.value)
                        }
                        size="small"
                        fullWidth
                      />
                      <Button
                        size="small"
                        color="error"
                        onClick={() => removeHomeCheckItem(index)}
                      >
                        <FaTrash />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              {/* CTA Button */}
              <div className="bg-white rounded-xl shadow p-5">
                <h2 className="text-lg font-semibold text-gray-800 mb-4">
                  CTA Button
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <TextField
                    label="Button Text"
                    value={homeContent.ctaButtonText}
                    onChange={(e) =>
                      setHomeContent((prev) => ({
                        ...prev,
                        ctaButtonText: e.target.value,
                      }))
                    }
                    size="small"
                    fullWidth
                  />
                  <TextField
                    label="Button Link"
                    value={homeContent.ctaButtonLink}
                    onChange={(e) =>
                      setHomeContent((prev) => ({
                        ...prev,
                        ctaButtonLink: e.target.value,
                      }))
                    }
                    size="small"
                    fullWidth
                  />
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Form Modal */}
      {activeTab === "plans" && showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">
              {editingPlan ? "Edit Plan" : "Create Plan"}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <TextField
                label="Plan Name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                fullWidth
                required
              />
              <TextField
                label="Description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                fullWidth
                multiline
                rows={2}
              />
              <div className="grid grid-cols-2 gap-4">
                <TextField
                  label="Price (₹)"
                  type="number"
                  value={formData.price}
                  onChange={(e) =>
                    setFormData({ ...formData, price: e.target.value })
                  }
                  required
                />
                <TextField
                  label="Discount %"
                  type="number"
                  value={formData.discountPercentage}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      discountPercentage: e.target.value,
                    })
                  }
                  required
                />
                <TextField
                  label="Original Price (₹)"
                  type="number"
                  value={formData.originalPrice}
                  onChange={(e) =>
                    setFormData({ ...formData, originalPrice: e.target.value })
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <TextField
                  label="Duration (Days)"
                  type="number"
                  value={formData.durationDays}
                  onChange={(e) =>
                    setFormData({ ...formData, durationDays: e.target.value })
                  }
                  required
                />
                <select
                  value={formData.durationUnit}
                  onChange={(e) =>
                    setFormData({ ...formData, durationUnit: e.target.value })
                  }
                  className="border rounded px-3 py-2"
                >
                  <option value="days">Days</option>
                  <option value="months">Months</option>
                  <option value="years">Years</option>
                </select>
              </div>
              <TextField
                label="Benefits (one per line)"
                value={formData.benefits}
                onChange={(e) =>
                  setFormData({ ...formData, benefits: e.target.value })
                }
                fullWidth
                multiline
                rows={4}
                placeholder="Earn 2x points&#10;Free shipping&#10;Exclusive discounts"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.active}
                    onChange={(e) =>
                      setFormData({ ...formData, active: e.target.checked })
                    }
                  />
                }
                label="Set as Active Plan"
              />
              <div className="flex gap-2 pt-4">
                <Button type="submit" variant="contained" fullWidth>
                  {editingPlan ? "Update" : "Create"}
                </Button>
                <Button variant="outlined" onClick={resetForm} fullWidth>
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {activeTab === "plans" && (
        <div className="grid gap-4">
          {plans.length === 0 ? (
            <div className="text-center py-10 text-gray-500">
              No membership plans yet. Create one to get started.
            </div>
          ) : (
            plans.map((plan) => (
              <div
                key={plan._id}
                className={`bg-white rounded-lg shadow p-4 border-2 ${
                  plan.isActive ? "border-green-500" : "border-transparent"
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-bold text-gray-800">
                        {plan.name}
                      </h3>
                      {plan.isActive && (
                        <span className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full flex items-center gap-1">
                          <FaStar size={10} /> Active
                        </span>
                      )}
                    </div>
                    <p className="text-gray-500 text-sm mt-1">
                      {plan.description}
                    </p>
                    <p className="text-xl font-bold text-[#c1591c] mt-2">
                      ₹{plan.price}
                      {plan.originalPrice > plan.price && (
                        <span className="text-sm text-gray-400 line-through ml-2">
                          ₹{plan.originalPrice}
                        </span>
                      )}
                      <span className="text-sm text-gray-500 font-normal ml-2">
                        / {plan.durationDays || plan.duration || 365} days
                      </span>
                    </p>
                    <p className="text-sm text-emerald-600 mt-1">
                      Discount:{" "}
                      {plan.discountPercentage ?? plan.discountPercent ?? 0}%
                    </p>
                    {plan.benefits?.length > 0 && (
                      <ul className="mt-2 text-sm text-gray-600">
                        {plan.benefits.slice(0, 3).map((b, i) => (
                          <li key={i}>• {b}</li>
                        ))}
                        {plan.benefits.length > 3 && (
                          <li className="text-gray-400">
                            +{plan.benefits.length - 3} more
                          </li>
                        )}
                      </ul>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {!plan.isActive && (
                      <Button
                        size="small"
                        variant="outlined"
                        color="success"
                        onClick={() => handleActivate(plan._id)}
                      >
                        Activate
                      </Button>
                    )}
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => handleEdit(plan)}
                    >
                      <FaEdit />
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      color="error"
                      onClick={() => handleDelete(plan._id)}
                    >
                      <FaTrash />
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
