"use client";
import {
  Button,
  CircularProgress,
  MenuItem,
  TextField,
} from "@mui/material";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import { FiClock, FiMail, FiMapPin, FiPhone, FiSend, FiX } from "react-icons/fi";
import { IoChatboxOutline } from "react-icons/io5";
import {
  createSupportTicket,
  fetchSupportOrderOptions,
} from "@/services/supportApi";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_IMAGES = 5;
const MAX_VIDEOS = 3;
const MAX_IMAGE_FILE_SIZE = 10 * 1024 * 1024;
const MAX_VIDEO_FILE_SIZE = 50 * 1024 * 1024;
const IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const VIDEO_TYPES = [
  "video/mp4",
  "video/quicktime",
  "video/x-msvideo",
  "video/x-matroska",
  "video/webm",
  "video/mpeg",
  "video/3gpp",
  "video/3gpp2",
  "video/x-m4v",
  "video/mp2t",
  "video/h264",
  "video/mjpeg",
  "video/x-motion-jpeg",
];

const defaultFormState = {
  name: "",
  email: "",
  phone: "",
  subject: "",
  message: "",
  orderId: "",
};

const createFileId = (file) =>
  `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`;

const formatFileSize = (bytes) => `${(bytes / (1024 * 1024)).toFixed(2)} MB`;

const Contact = () => {
  const [formData, setFormData] = useState(defaultFormState);
  const [fieldErrors, setFieldErrors] = useState({});
  const [uploadErrors, setUploadErrors] = useState({ images: "", videos: "" });
  const [formError, setFormError] = useState("");
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [imageFiles, setImageFiles] = useState([]);
  const [videoFiles, setVideoFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const previewUrlsRef = useRef(new Set());
  const submitInProgressRef = useRef(false);
  const lastSubmitRef = useRef({ signature: "", submittedAt: 0 });

  useEffect(() => {
    let isActive = true;

    const loadOrders = async () => {
      setOrdersLoading(true);
      try {
        const orderOptions = await fetchSupportOrderOptions();
        if (isActive) {
          setOrders(orderOptions);
        }
      } catch (error) {
        if (isActive) {
          setOrders([]);
        }
      } finally {
        if (isActive) {
          setOrdersLoading(false);
        }
      }
    };

    loadOrders();

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(
    () => () => {
      previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      previewUrlsRef.current.clear();
    },
    [],
  );

  const registerPreviewUrl = (url) => {
    previewUrlsRef.current.add(url);
  };

  const revokePreviewUrl = (url) => {
    if (!url) return;
    URL.revokeObjectURL(url);
    previewUrlsRef.current.delete(url);
  };

  const clearUploads = () => {
    imageFiles.forEach((file) => revokePreviewUrl(file.previewUrl));
    videoFiles.forEach((file) => revokePreviewUrl(file.previewUrl));
    setImageFiles([]);
    setVideoFiles([]);
  };

  const buildPreviewItem = (file) => {
    const previewUrl = URL.createObjectURL(file);
    registerPreviewUrl(previewUrl);
    return {
      id: createFileId(file),
      file,
      previewUrl,
    };
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setFieldErrors((prev) => ({ ...prev, [name]: "" }));
    setFormError("");
  };

  const removeFile = (type, id) => {
    if (type === "images") {
      setImageFiles((prev) => {
        const target = prev.find((item) => item.id === id);
        if (target) revokePreviewUrl(target.previewUrl);
        return prev.filter((item) => item.id !== id);
      });
      setUploadErrors((prev) => ({ ...prev, images: "" }));
      return;
    }

    setVideoFiles((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target) revokePreviewUrl(target.previewUrl);
      return prev.filter((item) => item.id !== id);
    });
    setUploadErrors((prev) => ({ ...prev, videos: "" }));
  };

  const appendFiles = (event, type) => {
    const selected = Array.from(event.target.files || []);
    if (selected.length === 0) return;

    const isImage = type === "images";
    const allowedTypes = isImage ? IMAGE_TYPES : VIDEO_TYPES;
    const maxCount = isImage ? MAX_IMAGES : MAX_VIDEOS;
    const existingFiles = isImage ? imageFiles : videoFiles;

    if (existingFiles.length + selected.length > maxCount) {
      setUploadErrors((prev) => ({
        ...prev,
        [type]: `You can upload up to ${maxCount} ${isImage ? "images" : "videos"}.`,
      }));
      event.target.value = "";
      return;
    }

    const invalidType = selected.find((file) => !allowedTypes.includes(file.type));
    if (invalidType) {
      setUploadErrors((prev) => ({
        ...prev,
        [type]: `Unsupported file type: ${invalidType.name}`,
      }));
      event.target.value = "";
      return;
    }

    const maxSize = isImage ? MAX_IMAGE_FILE_SIZE : MAX_VIDEO_FILE_SIZE;
    const oversizedFile = selected.find((file) => file.size > maxSize);
    if (oversizedFile) {
      setUploadErrors((prev) => ({
        ...prev,
        [type]: `File too large: ${oversizedFile.name}. Max size is ${isImage ? "10MB" : "50MB"} per file.`,
      }));
      event.target.value = "";
      return;
    }

    const nextItems = selected.map(buildPreviewItem);

    if (isImage) {
      setImageFiles((prev) => [...prev, ...nextItems]);
      setUploadErrors((prev) => ({ ...prev, images: "" }));
    } else {
      setVideoFiles((prev) => [...prev, ...nextItems]);
      setUploadErrors((prev) => ({ ...prev, videos: "" }));
    }

    event.target.value = "";
  };

  const validateForm = () => {
    const errors = {};
    const nextUploadErrors = { images: "", videos: "" };
    const trimmedName = formData.name.trim();
    const trimmedEmail = formData.email.trim();
    const trimmedPhone = formData.phone.trim();
    const trimmedSubject = formData.subject.trim();
    const trimmedMessage = formData.message.trim();

    if (!trimmedName || trimmedName.length < 2) {
      errors.name = "Name must be at least 2 characters.";
    }

    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      errors.email = "Please provide a valid email.";
    }

    if (trimmedPhone && !/^[0-9+\-() ]{7,20}$/.test(trimmedPhone)) {
      errors.phone = "Phone must be 7 to 20 characters.";
    }

    if (!trimmedSubject || trimmedSubject.length < 3) {
      errors.subject = "Subject must be at least 3 characters.";
    }

    if (!trimmedMessage || trimmedMessage.length < 10) {
      errors.message = "Message must be at least 10 characters.";
    }

    if (imageFiles.length > MAX_IMAGES) {
      nextUploadErrors.images = `You can upload up to ${MAX_IMAGES} images.`;
    }

    if (videoFiles.length > MAX_VIDEOS) {
      nextUploadErrors.videos = `You can upload up to ${MAX_VIDEOS} videos.`;
    }

    setFieldErrors(errors);
    setUploadErrors(nextUploadErrors);
    return (
      Object.keys(errors).length === 0 &&
      !nextUploadErrors.images &&
      !nextUploadErrors.videos
    );
  };

  const buildSubmissionSignature = () =>
    JSON.stringify({
      name: formData.name.trim(),
      email: formData.email.trim().toLowerCase(),
      phone: formData.phone.trim(),
      subject: formData.subject.trim(),
      message: formData.message.trim(),
      orderId: formData.orderId || "",
      images: imageFiles.map((item) => `${item.file.name}:${item.file.size}`),
      videos: videoFiles.map((item) => `${item.file.name}:${item.file.size}`),
    });

  const resetForm = () => {
    setFormData(defaultFormState);
    setFieldErrors({});
    setUploadErrors({ images: "", videos: "" });
    setFormError("");
    clearUploads();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (submitInProgressRef.current || loading) return;
    setSuccess(false);
    setFormError("");

    if (!validateForm()) {
      toast.error("Please fix validation errors before submitting.");
      return;
    }

    const signature = buildSubmissionSignature();
    if (
      lastSubmitRef.current.signature === signature &&
      Date.now() - lastSubmitRef.current.submittedAt < 10000
    ) {
      toast.error("Duplicate submission blocked. Please wait a few seconds.");
      return;
    }

    const payload = new FormData();
    payload.append("name", formData.name.trim());
    payload.append("email", formData.email.trim());
    payload.append("phone", formData.phone.trim());
    payload.append("subject", formData.subject.trim());
    payload.append("message", formData.message.trim());
    if (formData.orderId) {
      payload.append("orderId", formData.orderId);
    }

    imageFiles.forEach((item) => payload.append("images", item.file));
    videoFiles.forEach((item) => payload.append("videos", item.file));

    submitInProgressRef.current = true;
    setLoading(true);

    try {
      const response = await createSupportTicket(payload);
      if (!response?.success) {
        const serverErrors = response?.data?.errors || {};
        const nextFieldErrors = {
          name: serverErrors.name || "",
          email: serverErrors.email || "",
          phone: serverErrors.phone || "",
          subject: serverErrors.subject || "",
          message: serverErrors.message || "",
          orderId: serverErrors.orderId || "",
        };

        setFieldErrors((prev) => ({ ...prev, ...nextFieldErrors }));
        setUploadErrors((prev) => ({
          images: serverErrors.images || prev.images,
          videos: serverErrors.videos || prev.videos,
        }));
        setFormError(response?.message || "Failed to submit support request.");
        toast.error(response?.message || "Failed to submit support request.");
        return;
      }

      lastSubmitRef.current = { signature, submittedAt: Date.now() };
      setSuccess(true);
      toast.success("Support ticket created successfully.");
      resetForm();
      setTimeout(() => setSuccess(false), 5000);
    } catch (error) {
      const fallbackMessage = "Network error. Please try again.";
      setFormError(fallbackMessage);
      toast.error(fallbackMessage);
    } finally {
      submitInProgressRef.current = false;
      setLoading(false);
    }
  };

  return (
    <section className="bg-gray-50 min-h-screen">
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f3460] text-white py-16">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Contact Us</h1>
          <p className="text-gray-300 text-lg max-w-2xl mx-auto">
            Have questions? We&apos;d love to hear from you. Send us a message and
            we&apos;ll respond as soon as possible.
          </p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Contact Info Cards */}
          <div className="lg:col-span-1 space-y-6">
            {/* Address Card */}
            <div className="bg-white rounded-xl p-6 shadow-md hover:shadow-lg transition-shadow">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-[var(--flavor-glass)] rounded-full flex items-center justify-center shrink-0">
                  <FiMapPin className="text-primary text-xl" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-800 mb-2">Our Address</h3>
                  <p className="text-gray-600 text-sm leading-relaxed">
                    Healthy One Gram – Mega Health Store
                    <br />
                    Rajasthan Centre of Advanced Technology (R-CAT)
                    <br />
                    Jaipur, Rajasthan, India
                  </p>
                </div>
              </div>
            </div>

            {/* Phone Card */}
            <div className="bg-white rounded-xl p-6 shadow-md hover:shadow-lg transition-shadow">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-[var(--flavor-glass)] rounded-full flex items-center justify-center shrink-0">
                  <FiPhone className="text-primary text-xl" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-800 mb-2">Phone Number</h3>
                  <a
                    href="tel:+918619641968"
                    className="text-primary font-semibold hover:underline"
                  >
                    (+91) 8619-641-968
                  </a>
                  <p className="text-gray-500 text-sm mt-1">
                    Mon - Sat: 9:00 AM - 6:00 PM
                  </p>
                </div>
              </div>
            </div>

            {/* Email Card */}
            <div className="bg-white rounded-xl p-6 shadow-md hover:shadow-lg transition-shadow">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-[var(--flavor-glass)] rounded-full flex items-center justify-center shrink-0">
                  <FiMail className="text-primary text-xl" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-800 mb-2">
                    Email Address
                  </h3>
                  <a
                    href="mailto:support@healthyonegram.com"
                    className="text-primary font-semibold hover:underline"
                  >
                    support@healthyonegram.com
                  </a>
                  <p className="text-gray-500 text-sm mt-1">
                    We reply within 24 hours
                  </p>
                </div>
              </div>
            </div>

            {/* WhatsApp Card */}
            <Link
              href="https://wa.me/918619641968?text=Hello%20Healthy%20One%20Gram,%20I%20need%20help%20with..."
              target="_blank"
              className="block bg-gradient-to-r from-green-500 to-green-600 rounded-xl p-6 shadow-md hover:shadow-lg transition-all hover:-translate-y-1"
            >
              <div className="flex items-center gap-4 text-white">
                <IoChatboxOutline className="text-4xl" />
                <div>
                  <h3 className="font-bold mb-1">Chat on WhatsApp</h3>
                  <p className="text-green-100 text-sm">Get instant support</p>
                </div>
              </div>
            </Link>

            {/* Business Hours */}
            <div className="bg-white rounded-xl p-6 shadow-md">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-[var(--flavor-glass)] rounded-full flex items-center justify-center shrink-0">
                  <FiClock className="text-primary text-xl" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-800 mb-3">
                    Business Hours
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Monday - Friday</span>
                      <span className="text-gray-800 font-medium">
                        9:00 AM - 6:00 PM
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Saturday</span>
                      <span className="text-gray-800 font-medium">
                        10:00 AM - 4:00 PM
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Sunday</span>
                      <span className="text-red-500 font-medium">Closed</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Contact Form */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl p-8 shadow-md">
              <h2 className="text-2xl font-bold text-gray-800 mb-2">
                Send us a Message
              </h2>
              <p className="text-gray-500 mb-8">
                Fill out the form below and we&apos;ll get back to you shortly.
              </p>

              {success && (
                <div className="mb-6 p-4 bg-[var(--flavor-card-bg)] border border-primary rounded-lg text-primary">
                  Ticket created successfully. Our customer care team will get back
                  to you soon.
                </div>
              )}

              {formError && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                  {formError}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <TextField
                    label="Your Name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    fullWidth
                    variant="outlined"
                    error={Boolean(fieldErrors.name)}
                    helperText={fieldErrors.name || " "}
                  />
                  <TextField
                    label="Email Address"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    fullWidth
                    variant="outlined"
                    error={Boolean(fieldErrors.email)}
                    helperText={fieldErrors.email || " "}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <TextField
                    label="Phone Number"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    fullWidth
                    variant="outlined"
                    error={Boolean(fieldErrors.phone)}
                    helperText={fieldErrors.phone || " "}
                  />
                  <TextField
                    label="Subject"
                    name="subject"
                    value={formData.subject}
                    onChange={handleChange}
                    required
                    fullWidth
                    variant="outlined"
                    error={Boolean(fieldErrors.subject)}
                    helperText={fieldErrors.subject || " "}
                  />
                </div>

                <TextField
                  select
                  label="Related Order (Optional)"
                  name="orderId"
                  value={formData.orderId}
                  onChange={handleChange}
                  fullWidth
                  variant="outlined"
                  error={Boolean(fieldErrors.orderId)}
                  helperText={
                    fieldErrors.orderId ||
                    (ordersLoading
                      ? "Loading your orders..."
                      : orders.length > 0
                        ? "Select an order if this issue is order-related."
                        : "Login and place an order to see available order IDs.")
                  }
                >
                  <MenuItem value="">No order selected</MenuItem>
                  {orders.map((order) => (
                    <MenuItem key={order.id} value={order.id}>
                      #{String(order.displayId || order.id || "")
                        .slice(-8)
                        .toUpperCase()} -{" "}
                      {order.createdAt || "Unknown date"}
                    </MenuItem>
                  ))}
                </TextField>

                <TextField
                  label="Your Message"
                  name="message"
                  value={formData.message}
                  onChange={handleChange}
                  required
                  fullWidth
                  multiline
                  rows={6}
                  variant="outlined"
                  error={Boolean(fieldErrors.message)}
                  helperText={fieldErrors.message || " "}
                />

                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Upload Images (JPG, JPEG, PNG, WEBP) - Max {MAX_IMAGES} (10MB each)
                    </label>
                    <input
                      type="file"
                      multiple
                      accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                      onChange={(event) => appendFiles(event, "images")}
                      className="block w-full text-sm text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-[var(--flavor-card-bg)] file:text-primary hover:file:bg-[var(--flavor-glass)]"
                    />
                    {uploadErrors.images && (
                      <p className="mt-2 text-sm text-red-600">{uploadErrors.images}</p>
                    )}
                    {imageFiles.length > 0 && (
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-3">
                        {imageFiles.map((item) => (
                          <div
                            key={item.id}
                            className="relative border border-gray-200 rounded-lg p-2 bg-gray-50"
                          >
                            <button
                              type="button"
                              onClick={() => removeFile("images", item.id)}
                              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                              aria-label="Remove image"
                            >
                              <FiX size={14} />
                            </button>
                            <img
                              src={item.previewUrl}
                              alt={item.file.name}
                              className="w-full h-24 object-cover rounded-md"
                              loading="lazy"
                            />
                            <p className="text-xs text-gray-600 mt-2 truncate">
                              {item.file.name}
                            </p>
                            <p className="text-[11px] text-gray-500">
                              {formatFileSize(item.file.size)}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Upload Videos (MP4 H.264, MOV, AVI, MKV, WEBM, MPEG, 3GP, M4V) - Max {MAX_VIDEOS} (50MB each)
                    </label>
                    <input
                      type="file"
                      multiple
                      accept=".mp4,.mov,.avi,.mkv,.webm,.mpeg,.mpg,.3gp,.m4v,.h264,video/mp4,video/quicktime,video/x-msvideo,video/x-matroska,video/webm,video/mpeg,video/3gpp,video/x-m4v,video/h264"
                      onChange={(event) => appendFiles(event, "videos")}
                      className="block w-full text-sm text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-[var(--flavor-card-bg)] file:text-primary hover:file:bg-[var(--flavor-glass)]"
                    />
                    {uploadErrors.videos && (
                      <p className="mt-2 text-sm text-red-600">{uploadErrors.videos}</p>
                    )}
                    {videoFiles.length > 0 && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                        {videoFiles.map((item) => (
                          <div
                            key={item.id}
                            className="relative border border-gray-200 rounded-lg p-2 bg-gray-50"
                          >
                            <button
                              type="button"
                              onClick={() => removeFile("videos", item.id)}
                              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                              aria-label="Remove video"
                            >
                              <FiX size={14} />
                            </button>
                            <video
                              src={item.previewUrl}
                              controls
                              preload="metadata"
                              className="w-full h-36 object-cover rounded-md bg-black"
                            />
                            <p className="text-xs text-gray-600 mt-2 truncate">
                              {item.file.name}
                            </p>
                            <p className="text-[11px] text-gray-500">
                              {formatFileSize(item.file.size)}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  sx={{
                    backgroundColor: "var(--primary)",
                    color: "white",
                    textTransform: "none",
                    fontWeight: 600,
                    padding: "14px 32px",
                    borderRadius: "8px",
                    fontSize: "16px",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    "&:hover": {
                      backgroundColor: "#a04a17",
                    },
                    "&:disabled": {
                      backgroundColor: "#ccc",
                    },
                  }}
                >
                  {loading ? (
                    <>
                      <CircularProgress size={18} color="inherit" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <FiSend /> Send Message
                    </>
                  )}
                </Button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Contact;
