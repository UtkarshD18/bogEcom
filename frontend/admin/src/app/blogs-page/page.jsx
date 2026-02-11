"use client";

import { useAdmin } from "@/context/AdminContext";
import { getData, putData } from "@/utils/api";
import {
  Alert,
  Button,
  CircularProgress,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Snackbar,
  Switch,
  TextField,
} from "@mui/material";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { MdSave } from "react-icons/md";

const DEFAULT_CONTENT = {
  theme: { style: "mint", layout: "magazine" },
  sections: { hero: true, featured: true, grid: true, newsletter: true },
  hero: {
    badge: "Health & Wellness Insights",
    title: "The Journal",
    description:
      "Expert insights on nutrition, wellness, and the science behind healthy living. No fluff, just evidence-backed guidance.",
  },
  newsletter: {
    title: "Don't Miss Our Latest Articles",
    description:
      "Subscribe to get weekly insights, wellness tips, and exclusive health recommendations delivered to your inbox.",
    inputPlaceholder: "Enter your email address",
    buttonText: "Subscribe",
    note: "We respect your privacy. Unsubscribe at any time.",
  },
};

export default function BlogsPageEditor() {
  const { token, isAuthenticated, loading } = useAdmin();
  const router = useRouter();

  const [content, setContent] = useState(DEFAULT_CONTENT);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success",
  });

  const canFetch = useMemo(
    () => Boolean(isAuthenticated && token && typeof token === "string"),
    [isAuthenticated, token],
  );

  const fetchContent = useCallback(async () => {
    if (!canFetch) return;
    setIsLoading(true);
    try {
      const response = await getData("/api/blogs/page/admin", token);
      if (response?.success && response?.data) {
        setContent({
          ...DEFAULT_CONTENT,
          ...response.data,
          theme: { ...DEFAULT_CONTENT.theme, ...(response.data.theme || {}) },
          sections: {
            ...DEFAULT_CONTENT.sections,
            ...(response.data.sections || {}),
          },
          hero: { ...DEFAULT_CONTENT.hero, ...(response.data.hero || {}) },
          newsletter: {
            ...DEFAULT_CONTENT.newsletter,
            ...(response.data.newsletter || {}),
          },
        });
      } else {
        setSnackbar({
          open: true,
          message: response?.message || "Failed to load blogs page content",
          severity: "error",
        });
      }
    } catch (error) {
      console.error("BlogsPageEditor fetch error:", error);
      setSnackbar({
        open: true,
        message: "Failed to load blogs page content",
        severity: "error",
      });
    } finally {
      setIsLoading(false);
    }
  }, [canFetch, token]);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, loading, router]);

  useEffect(() => {
    fetchContent();
  }, [fetchContent]);

  const handleSave = async () => {
    if (!canFetch) {
      setSnackbar({
        open: true,
        message: "Admin token missing. Please login again.",
        severity: "error",
      });
      return;
    }

    setIsSaving(true);
    try {
      const response = await putData("/api/blogs/page/admin", content, token);
      if (response?.success) {
        setSnackbar({
          open: true,
          message: "Blogs page saved successfully",
          severity: "success",
        });
      } else {
        setSnackbar({
          open: true,
          message: response?.message || "Failed to save blogs page",
          severity: "error",
        });
      }
    } catch (error) {
      console.error("BlogsPageEditor save error:", error);
      setSnackbar({
        open: true,
        message: "Failed to save blogs page",
        severity: "error",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (loading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <CircularProgress />
      </div>
    );
  }

  return (
    <section className="w-full py-3 px-5">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h2 className="text-[18px] text-gray-700 font-[600] mb-1">
            Blogs Page
          </h2>
          <p className="text-sm text-gray-500">
            Theme, layout, and section visibility for the public Blogs page
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/blogs">
            <Button variant="outlined" sx={{ textTransform: "none" }}>
              Back to Blogs
            </Button>
          </Link>
          <Button
            onClick={handleSave}
            disabled={isSaving}
            startIcon={isSaving ? <CircularProgress size={16} /> : <MdSave />}
            className="!bg-blue-600 !text-white !px-4 !py-2 !rounded-md hover:!bg-blue-700 disabled:!bg-gray-300"
          >
            {isSaving ? "Saving..." : "Save Page"}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <CircularProgress />
        </div>
      ) : (
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="font-semibold text-gray-800 mb-4">Theme</h3>
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
                  renderValue={(selected) => (
                    <div className="flex items-center gap-2 capitalize">
                      {selected}
                    </div>
                  )}
                >
                  <MenuItem value="mint">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full bg-emerald-500 shadow-sm" />
                      Mint
                    </div>
                  </MenuItem>
                  <MenuItem value="sky">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full bg-sky-500 shadow-sm" />
                      Sky
                    </div>
                  </MenuItem>
                  <MenuItem value="aurora">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full bg-lime-500 shadow-sm" />
                      Aurora
                    </div>
                  </MenuItem>
                  <MenuItem value="lavender">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full bg-indigo-500 shadow-sm" />
                      Lavender
                    </div>
                  </MenuItem>
                  <MenuItem value="sunset">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full bg-orange-500 shadow-sm" />
                      Sunset
                    </div>
                  </MenuItem>
                  <MenuItem value="midnight">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full bg-slate-800 shadow-sm" />
                      Midnight
                    </div>
                  </MenuItem>
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
                  <MenuItem value="magazine">Magazine</MenuItem>
                  <MenuItem value="minimal">Minimal</MenuItem>
                </Select>
              </FormControl>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="font-semibold text-gray-800 mb-4">
              Section Visibility
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
              <FormControlLabel
                control={
                  <Switch
                    checked={!!content.sections.hero}
                    onChange={(e) =>
                      setContent({
                        ...content,
                        sections: { ...content.sections, hero: e.target.checked },
                      })
                    }
                  />
                }
                label="Hero"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={!!content.sections.featured}
                    onChange={(e) =>
                      setContent({
                        ...content,
                        sections: {
                          ...content.sections,
                          featured: e.target.checked,
                        },
                      })
                    }
                  />
                }
                label="Featured"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={!!content.sections.grid}
                    onChange={(e) =>
                      setContent({
                        ...content,
                        sections: { ...content.sections, grid: e.target.checked },
                      })
                    }
                  />
                }
                label="Grid"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={!!content.sections.newsletter}
                    onChange={(e) =>
                      setContent({
                        ...content,
                        sections: {
                          ...content.sections,
                          newsletter: e.target.checked,
                        },
                      })
                    }
                  />
                }
                label="Newsletter"
              />
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="font-semibold text-gray-800 mb-4">Hero</h3>
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

          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="font-semibold text-gray-800 mb-4">Newsletter</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <TextField
                label="Title"
                value={content.newsletter.title}
                onChange={(e) =>
                  setContent({
                    ...content,
                    newsletter: { ...content.newsletter, title: e.target.value },
                  })
                }
                fullWidth
                size="small"
              />
              <TextField
                label="Button Text"
                value={content.newsletter.buttonText}
                onChange={(e) =>
                  setContent({
                    ...content,
                    newsletter: {
                      ...content.newsletter,
                      buttonText: e.target.value,
                    },
                  })
                }
                fullWidth
                size="small"
              />
              <TextField
                label="Description"
                value={content.newsletter.description}
                onChange={(e) =>
                  setContent({
                    ...content,
                    newsletter: {
                      ...content.newsletter,
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
                label="Input Placeholder"
                value={content.newsletter.inputPlaceholder}
                onChange={(e) =>
                  setContent({
                    ...content,
                    newsletter: {
                      ...content.newsletter,
                      inputPlaceholder: e.target.value,
                    },
                  })
                }
                fullWidth
                size="small"
              />
              <TextField
                label="Footer Note"
                value={content.newsletter.note}
                onChange={(e) =>
                  setContent({
                    ...content,
                    newsletter: { ...content.newsletter, note: e.target.value },
                  })
                }
                fullWidth
                size="small"
              />
            </div>
          </div>
        </div>
      )}

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3500}
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
    </section>
  );
}

