"use client";

import { useAdmin } from "@/context/AdminContext";
import {
  Alert,
  Button,
  CircularProgress,
  Divider,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Snackbar,
  Switch,
  TextField,
} from "@mui/material";
import { useEffect, useState } from "react";
import { MdAdd, MdDelete, MdInfo, MdRefresh, MdSave } from "react-icons/md";

const normalizeApiBaseUrl = (raw) => {
  const cleaned = String(raw || "")
    .trim()
    .replace(/^\"|\"$/g, "")
    .replace(/\/+$/, "");
  if (!cleaned) return "";
  return cleaned.endsWith("/api") ? cleaned.slice(0, -4) : cleaned;
};

const API_BASE_URL = normalizeApiBaseUrl(
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_APP_API_URL ||
  "http://localhost:8000",
);

const buildApiUrl = (path) => {
  const safePath = String(path || "").startsWith("/") ? path : `/${path}`;
  if (!API_BASE_URL) return safePath;
  return `${API_BASE_URL}${safePath}`;
};

const getAdminToken = (tokenFromContext) => {
  if (tokenFromContext) return tokenFromContext;
  if (typeof window === "undefined") return null;
  return localStorage.getItem("adminToken");
};

const readResponseBody = async (response) => {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return response.json();
  }
  const text = await response.text();
  return text ? { message: text } : {};
};

const apiFetch = async ({ path, method = "GET", token, body }) => {
  const url = buildApiUrl(path);
  if (!url) {
    throw new Error("Missing NEXT_PUBLIC_API_URL");
  }

  try {
    const response = await fetch(url, {
      method,
      headers: {
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      credentials: "include",
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await readResponseBody(response);
    if (!response.ok) {
      const message =
        data?.message ||
        data?.error ||
        response.statusText ||
        "Request failed";
      throw new Error(`[${response.status}] ${message}`);
    }

    return data;
  } catch (error) {
    const message = String(error?.message || "");
    if (message.includes("Failed to fetch")) {
      throw new Error(
        `Network error calling ${url}. Check API URL, backend, and CORS.`,
      );
    }
    throw error;
  }
};

/**
 * About Page Editor
 * Admin panel for managing the About Us page content
 */
const AboutPageEditor = () => {
  const { token } = useAdmin();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success",
  });

  // Content State
  const [content, setContent] = useState({
    theme: { style: "mint", layout: "glass" },
    sections: {
      hero: true,
      standard: true,
      whyUs: true,
      values: true,
      cta: true,
    },
    hero: {
      badge: "About Us",
      title: "",
      titleHighlight: "",
      description: "",
      image: "",
    },
    standard: {
      subtitle: "",
      title: "",
      description: "",
      image: "",
      stats: [],
    },
    whyUs: {
      subtitle: "",
      title: "",
      features: [],
    },
    values: {
      subtitle: "",
      title: "",
      items: [],
    },
    cta: {
      title: "",
      description: "",
      buttonText: "",
      buttonLink: "",
    },
  });

  // Fetch content on mount
  useEffect(() => {
    fetchContent();
  }, [token]);

  const fetchContent = async () => {
    setLoading(true);
    try {
      const adminToken = getAdminToken(token);
      if (!adminToken) {
        throw new Error("Admin token missing. Please login again.");
      }

      const data = await apiFetch({
        path: "/api/about/admin",
        token: adminToken,
      });

      if (data.success && data.data) {
        setContent({
          theme: { ...content.theme, ...(data.data.theme || {}) },
          sections: { ...content.sections, ...(data.data.sections || {}) },
          hero: { ...content.hero, ...(data.data.hero || {}) },
          standard: { ...content.standard, ...(data.data.standard || {}) },
          whyUs: { ...content.whyUs, ...(data.data.whyUs || {}) },
          values: { ...content.values, ...(data.data.values || {}) },
          cta: { ...content.cta, ...(data.data.cta || {}) },
        });
      }
    } catch (error) {
      console.error("AboutPageEditor fetchContent error:", error);
      setSnackbar({
        open: true,
        message:
          error?.message || "Failed to load about page content. Try again.",
        severity: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const adminToken = getAdminToken(token);
      if (!adminToken) {
        throw new Error("Admin token missing. Please login again.");
      }

      const data = await apiFetch({
        path: "/api/about/admin",
        method: "PUT",
        token: adminToken,
        body: content,
      });

      if (data.success) {
        setSnackbar({
          open: true,
          message: "About page saved successfully!",
          severity: "success",
        });
      } else {
        throw new Error(data.message);
      }
    } catch (error) {
      console.error("AboutPageEditor handleSave error:", error);
      setSnackbar({
        open: true,
        message: error?.message || "Failed to save about page. Try again.",
        severity: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!confirm("Are you sure you want to reset to default content?")) return;

    try {
      const adminToken = getAdminToken(token);
      if (!adminToken) {
        throw new Error("Admin token missing. Please login again.");
      }

      const data = await apiFetch({
        path: "/api/about/admin/reset",
        method: "POST",
        token: adminToken,
      });

      if (data.success) {
        setContent({
          hero: data.data.hero,
          standard: data.data.standard,
          whyUs: data.data.whyUs,
          values: data.data.values,
          cta: data.data.cta,
        });
        setSnackbar({
          open: true,
          message: "About page reset to defaults",
          severity: "success",
        });
      }
    } catch (error) {
      console.error("AboutPageEditor handleReset error:", error);
      setSnackbar({
        open: true,
        message: error?.message || "Failed to reset about page. Try again.",
        severity: "error",
      });
    }
  };

  // Helper to add stat
  const addStat = () => {
    setContent({
      ...content,
      standard: {
        ...content.standard,
        stats: [...content.standard.stats, { value: "", label: "" }],
      },
    });
  };

  // Helper to remove stat
  const removeStat = (index) => {
    setContent({
      ...content,
      standard: {
        ...content.standard,
        stats: content.standard.stats.filter((_, i) => i !== index),
      },
    });
  };

  // Helper to update stat
  const updateStat = (index, field, value) => {
    const newStats = [...content.standard.stats];
    newStats[index] = { ...newStats[index], [field]: value };
    setContent({
      ...content,
      standard: { ...content.standard, stats: newStats },
    });
  };

  // Helper to add feature
  const addFeature = () => {
    setContent({
      ...content,
      whyUs: {
        ...content.whyUs,
        features: [
          ...content.whyUs.features,
          { icon: "🔹", title: "", description: "" },
        ],
      },
    });
  };

  // Helper to remove feature
  const removeFeature = (index) => {
    setContent({
      ...content,
      whyUs: {
        ...content.whyUs,
        features: content.whyUs.features.filter((_, i) => i !== index),
      },
    });
  };

  // Helper to update feature
  const updateFeature = (index, field, value) => {
    const newFeatures = [...content.whyUs.features];
    newFeatures[index] = { ...newFeatures[index], [field]: value };
    setContent({
      ...content,
      whyUs: { ...content.whyUs, features: newFeatures },
    });
  };

  // Helper to add value item
  const addValueItem = () => {
    setContent({
      ...content,
      values: {
        ...content.values,
        items: [...content.values.items, { title: "", description: "" }],
      },
    });
  };

  // Helper to remove value item
  const removeValueItem = (index) => {
    setContent({
      ...content,
      values: {
        ...content.values,
        items: content.values.items.filter((_, i) => i !== index),
      },
    });
  };

  // Helper to update value item
  const updateValueItem = (index, field, value) => {
    const newItems = [...content.values.items];
    newItems[index] = { ...newItems[index], [field]: value };
    setContent({
      ...content,
      values: { ...content.values, items: newItems },
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <CircularProgress />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">
            About Page Editor
          </h1>
          <p className="text-gray-500">Edit the About Us page content</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outlined"
            startIcon={<MdRefresh />}
            onClick={handleReset}
          >
            Reset
          </Button>
          <Button
            variant="contained"
            startIcon={saving ? <CircularProgress size={20} /> : <MdSave />}
            onClick={handleSave}
            disabled={saving}
            sx={{
              backgroundColor: "#c1591c",
              "&:hover": { backgroundColor: "#a04a17" },
            }}
          >
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>

      <div className="space-y-8">
        {/* Theme & Layout */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">
            Page Theme
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormControl fullWidth size="small">
              <InputLabel>Theme</InputLabel>
              <Select
                label="Theme"
                value={content.theme.style}
                onChange={(e) =>
                  setContent({
                    ...content,
                    theme: { ...content.theme, style: e.target.value },
                  })
                }
              >
                <MenuItem value="mint">Mint</MenuItem>
                <MenuItem value="sky">Sky</MenuItem>
                <MenuItem value="aurora">Aurora</MenuItem>
                <MenuItem value="lavender">Lavender</MenuItem>
                <MenuItem value="sunset">Sunset</MenuItem>
                <MenuItem value="midnight">Midnight</MenuItem>
              </Select>
            </FormControl>

            <FormControl fullWidth size="small">
              <InputLabel>Layout</InputLabel>
              <Select
                label="Layout"
                value={content.theme.layout}
                onChange={(e) =>
                  setContent({
                    ...content,
                    theme: { ...content.theme, layout: e.target.value },
                  })
                }
              >
                <MenuItem value="glass">Liquid Glass</MenuItem>
                <MenuItem value="minimal">Minimal</MenuItem>
              </Select>
            </FormControl>
          </div>
        </div>

        {/* Section Visibility */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">
            Section Visibility
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            <FormControlLabel
              control={
                <Switch
                  checked={!!content.sections.hero}
                  onChange={(e) =>
                    setContent({
                      ...content,
                      sections: {
                        ...content.sections,
                        hero: e.target.checked,
                      },
                    })
                  }
                />
              }
              label="Hero"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={!!content.sections.standard}
                  onChange={(e) =>
                    setContent({
                      ...content,
                      sections: {
                        ...content.sections,
                        standard: e.target.checked,
                      },
                    })
                  }
                />
              }
              label="Our Standard"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={!!content.sections.whyUs}
                  onChange={(e) =>
                    setContent({
                      ...content,
                      sections: {
                        ...content.sections,
                        whyUs: e.target.checked,
                      },
                    })
                  }
                />
              }
              label="Why Us"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={!!content.sections.values}
                  onChange={(e) =>
                    setContent({
                      ...content,
                      sections: {
                        ...content.sections,
                        values: e.target.checked,
                      },
                    })
                  }
                />
              }
              label="Values"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={!!content.sections.cta}
                  onChange={(e) =>
                    setContent({
                      ...content,
                      sections: {
                        ...content.sections,
                        cta: e.target.checked,
                      },
                    })
                  }
                />
              }
              label="CTA"
            />
          </div>
        </div>

        {/* Hero Section */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <MdInfo className="text-blue-500" />
            Hero Section
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <TextField
              label="Badge"
              value={content.hero.badge}
              onChange={(e) =>
                setContent({
                  ...content,
                  hero: { ...content.hero, badge: e.target.value },
                })
              }
              fullWidth
              size="small"
            />
            <TextField
              label="Title"
              value={content.hero.title}
              onChange={(e) =>
                setContent({
                  ...content,
                  hero: { ...content.hero, title: e.target.value },
                })
              }
              fullWidth
              size="small"
            />
            <TextField
              label="Title Highlight (colored text)"
              value={content.hero.titleHighlight}
              onChange={(e) =>
                setContent({
                  ...content,
                  hero: { ...content.hero, titleHighlight: e.target.value },
                })
              }
              fullWidth
              size="small"
            />
            <TextField
              label="Hero Image URL (optional)"
              value={content.hero.image}
              onChange={(e) =>
                setContent({
                  ...content,
                  hero: { ...content.hero, image: e.target.value },
                })
              }
              fullWidth
              size="small"
            />
            <TextField
              label="Description"
              value={content.hero.description}
              onChange={(e) =>
                setContent({
                  ...content,
                  hero: { ...content.hero, description: e.target.value },
                })
              }
              fullWidth
              multiline
              rows={3}
              className="md:col-span-2"
            />
          </div>
        </div>

        {/* Our Standard Section */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">
            Our Standard Section
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <TextField
              label="Subtitle"
              value={content.standard.subtitle}
              onChange={(e) =>
                setContent({
                  ...content,
                  standard: { ...content.standard, subtitle: e.target.value },
                })
              }
              fullWidth
              size="small"
            />
            <TextField
              label="Title"
              value={content.standard.title}
              onChange={(e) =>
                setContent({
                  ...content,
                  standard: { ...content.standard, title: e.target.value },
                })
              }
              fullWidth
              size="small"
            />
            <TextField
              label="Description"
              value={content.standard.description}
              onChange={(e) =>
                setContent({
                  ...content,
                  standard: {
                    ...content.standard,
                    description: e.target.value,
                  },
                })
              }
              fullWidth
              multiline
              rows={3}
              className="md:col-span-2"
            />
            <TextField
              label="Image URL (optional)"
              value={content.standard.image}
              onChange={(e) =>
                setContent({
                  ...content,
                  standard: { ...content.standard, image: e.target.value },
                })
              }
              fullWidth
              size="small"
              className="md:col-span-2"
            />
          </div>

          <Divider className="my-4" />

          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium text-gray-700">Stats Grid</h3>
            <Button size="small" startIcon={<MdAdd />} onClick={addStat}>
              Add Stat
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {content.standard.stats?.map((stat, index) => (
              <div
                key={index}
                className="flex gap-2 items-center bg-gray-50 p-3 rounded-lg"
              >
                <TextField
                  label="Value"
                  value={stat.value}
                  onChange={(e) => updateStat(index, "value", e.target.value)}
                  size="small"
                  sx={{ width: 100 }}
                />
                <TextField
                  label="Label"
                  value={stat.label}
                  onChange={(e) => updateStat(index, "label", e.target.value)}
                  size="small"
                  fullWidth
                />
                <IconButton color="error" onClick={() => removeStat(index)}>
                  <MdDelete />
                </IconButton>
              </div>
            ))}
          </div>
        </div>

        {/* Why Us Section */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">
            Why Choose Us Section
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <TextField
              label="Subtitle"
              value={content.whyUs.subtitle}
              onChange={(e) =>
                setContent({
                  ...content,
                  whyUs: { ...content.whyUs, subtitle: e.target.value },
                })
              }
              fullWidth
              size="small"
            />
            <TextField
              label="Title"
              value={content.whyUs.title}
              onChange={(e) =>
                setContent({
                  ...content,
                  whyUs: { ...content.whyUs, title: e.target.value },
                })
              }
              fullWidth
              size="small"
            />
          </div>

          <Divider className="my-4" />

          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium text-gray-700">Features</h3>
            <Button size="small" startIcon={<MdAdd />} onClick={addFeature}>
              Add Feature
            </Button>
          </div>
          <div className="space-y-3">
            {content.whyUs.features?.map((feature, index) => (
              <div
                key={index}
                className="flex gap-2 items-start bg-gray-50 p-3 rounded-lg"
              >
                <TextField
                  label="Icon (emoji)"
                  value={feature.icon}
                  onChange={(e) => updateFeature(index, "icon", e.target.value)}
                  size="small"
                  sx={{ width: 80 }}
                />
                <TextField
                  label="Title"
                  value={feature.title}
                  onChange={(e) =>
                    updateFeature(index, "title", e.target.value)
                  }
                  size="small"
                  sx={{ width: 150 }}
                />
                <TextField
                  label="Description"
                  value={feature.description}
                  onChange={(e) =>
                    updateFeature(index, "description", e.target.value)
                  }
                  size="small"
                  fullWidth
                />
                <IconButton color="error" onClick={() => removeFeature(index)}>
                  <MdDelete />
                </IconButton>
              </div>
            ))}
          </div>
        </div>

        {/* Values Section */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">
            Values Section
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <TextField
              label="Subtitle"
              value={content.values.subtitle}
              onChange={(e) =>
                setContent({
                  ...content,
                  values: { ...content.values, subtitle: e.target.value },
                })
              }
              fullWidth
              size="small"
            />
            <TextField
              label="Title"
              value={content.values.title}
              onChange={(e) =>
                setContent({
                  ...content,
                  values: { ...content.values, title: e.target.value },
                })
              }
              fullWidth
              size="small"
            />
          </div>

          <Divider className="my-4" />

          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium text-gray-700">Value Items</h3>
            <Button size="small" startIcon={<MdAdd />} onClick={addValueItem}>
              Add Value
            </Button>
          </div>
          <div className="space-y-3">
            {content.values.items?.map((item, index) => (
              <div
                key={index}
                className="flex gap-2 items-start bg-gray-50 p-3 rounded-lg"
              >
                <TextField
                  label="Title"
                  value={item.title}
                  onChange={(e) =>
                    updateValueItem(index, "title", e.target.value)
                  }
                  size="small"
                  sx={{ width: 150 }}
                />
                <TextField
                  label="Description"
                  value={item.description}
                  onChange={(e) =>
                    updateValueItem(index, "description", e.target.value)
                  }
                  size="small"
                  fullWidth
                />
                <IconButton
                  color="error"
                  onClick={() => removeValueItem(index)}
                >
                  <MdDelete />
                </IconButton>
              </div>
            ))}
          </div>
        </div>

        {/* CTA Section */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">
            Call to Action Section
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <TextField
              label="Title"
              value={content.cta.title}
              onChange={(e) =>
                setContent({
                  ...content,
                  cta: { ...content.cta, title: e.target.value },
                })
              }
              fullWidth
              size="small"
            />
            <TextField
              label="Description"
              value={content.cta.description}
              onChange={(e) =>
                setContent({
                  ...content,
                  cta: { ...content.cta, description: e.target.value },
                })
              }
              fullWidth
              size="small"
            />
            <TextField
              label="Button Text"
              value={content.cta.buttonText}
              onChange={(e) =>
                setContent({
                  ...content,
                  cta: { ...content.cta, buttonText: e.target.value },
                })
              }
              fullWidth
              size="small"
            />
            <TextField
              label="Button Link"
              value={content.cta.buttonLink}
              onChange={(e) =>
                setContent({
                  ...content,
                  cta: { ...content.cta, buttonLink: e.target.value },
                })
              }
              fullWidth
              size="small"
            />
          </div>
        </div>
      </div>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          severity={snackbar.severity}
          onClose={() => setSnackbar({ ...snackbar, open: false })}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </div>
  );
};

export default AboutPageEditor;
