"use client";

import { useAdmin } from "@/context/AdminContext";
import { getData, postData } from "@/utils/api";
import {
  Button,
  CircularProgress,
  TextField,
  FormControlLabel,
  Switch,
} from "@mui/material";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { MdNotificationsActive } from "react-icons/md";

const NotificationsPage = () => {
  const { token, isAuthenticated, loading } = useAdmin();
  const router = useRouter();

  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [sending, setSending] = useState(false);
  const [sendingPromoEmail, setSendingPromoEmail] = useState(false);
  const [form, setForm] = useState({
    title: "",
    body: "",
    couponCode: "",
    discountValue: "10",
    includeUsers: true,
  });
  const [promoEmail, setPromoEmail] = useState({
    subject: "",
    headline: "",
    message: "",
    couponCode: "",
    discountText: "",
    ctaLabel: "Shop now",
    ctaUrl: "",
    validUntil: "",
  });

  const fetchStats = useCallback(async () => {
    setLoadingStats(true);
    try {
      const response = await getData("/api/notifications/admin/stats", token);
      if (response.success) {
        setStats(response.data);
      } else {
        setStats(null);
      }
    } catch (error) {
      console.error("Failed to fetch notification stats:", error);
      setStats(null);
    } finally {
      setLoadingStats(false);
    }
  }, [token]);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, loading, router]);

  useEffect(() => {
    if (isAuthenticated && token) {
      fetchStats();
    }
  }, [isAuthenticated, token, fetchStats]);

  const handleChange = (e) => {
    const { name, value, checked, type } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handlePromoEmailChange = (e) => {
    const { name, value } = e.target;
    setPromoEmail((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSend = async () => {
    if (!form.title.trim() || !form.body.trim()) {
      toast.error("Title and message are required");
      return;
    }

    setSending(true);
    try {
      const payload = {
        title: form.title.trim(),
        body: form.body.trim(),
        includeUsers: form.includeUsers,
        data: {
          couponCode: form.couponCode.trim().toUpperCase(),
          discountValue: Number(form.discountValue || 10),
        },
      };

      const response = await postData(
        "/api/notifications/admin/send-offer",
        payload,
        token,
      );

      if (response.success) {
        const sent = response.data?.sent ?? 0;
        const failed = response.data?.failed ?? 0;
        const totalTokens = response.data?.totalTokens ?? sent + failed;
        const liveDelivered = response.data?.liveDelivered ?? 0;
        const failureCodes = response.data?.failureCodes || {};
        const codeEntries = Object.entries(failureCodes);
        const codesLabel =
          codeEntries.length > 0
            ? ` (${codeEntries
                .slice(0, 2)
                .map(([code, count]) => `${code}:${count}`)
                .join(", ")}${codeEntries.length > 2 ? ", ..." : ""})`
            : "";

        if (sent === 0 && failed > 0 && liveDelivered === 0) {
          toast.error(
            `No devices received the notification (${failed} failed)${codesLabel}`,
          );
        } else {
          const liveLabel =
            liveDelivered > 0 ? `, live ${liveDelivered} active` : "";
          toast.success(
            `Notification sent (${sent}/${totalTokens} delivered${
              failed ? `, ${failed} failed` : ""
            }${liveLabel})${codesLabel}`,
          );
        }
        fetchStats();
      } else {
        toast.error(response.message || "Failed to send notification");
      }
    } catch (error) {
      toast.error("Failed to send notification");
    } finally {
      setSending(false);
    }
  };

  const handleSendPromoEmail = async () => {
    if (!promoEmail.subject.trim() || !promoEmail.message.trim()) {
      toast.error("Subject and message are required");
      return;
    }

    setSendingPromoEmail(true);
    try {
      const payload = {
        subject: promoEmail.subject.trim(),
        headline: promoEmail.headline.trim(),
        message: promoEmail.message.trim(),
        couponCode: promoEmail.couponCode.trim().toUpperCase(),
        discountText: promoEmail.discountText.trim(),
        ctaLabel: promoEmail.ctaLabel.trim(),
        ctaUrl: promoEmail.ctaUrl.trim(),
        validUntil: promoEmail.validUntil.trim(),
      };

      const response = await postData(
        "/api/notifications/admin/send-promotional-email",
        payload,
        token,
      );

      if (response.success) {
        const sent = response.data?.sent ?? 0;
        const failed = response.data?.failed ?? 0;
        const total = response.data?.total ?? sent + failed;
        toast.success(
          `Promotional email sent (${sent}/${total}${
            failed ? `, ${failed} failed` : ""
          })`,
        );
      } else {
        toast.error(response.message || "Failed to send promotional email");
      }
    } catch (error) {
      toast.error("Failed to send promotional email");
    } finally {
      setSendingPromoEmail(false);
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
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Notifications</h1>
          <p className="text-gray-500">
            Monitor notification tokens and send manual offer blasts
          </p>
        </div>
        <Button variant="outlined" onClick={fetchStats}>
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-xl shadow-sm p-5">
          <div className="flex items-center gap-2 mb-3">
            <MdNotificationsActive className="text-xl text-orange-500" />
            <h2 className="font-semibold text-gray-800">Token Summary</h2>
          </div>
          {loadingStats ? (
            <CircularProgress size={24} />
          ) : (
            <div className="space-y-2 text-sm text-gray-600">
              <p>
                Firebase:{" "}
                <span className="font-medium">
                  {stats?.firebaseReady ? "Configured" : "Not configured"}
                </span>
              </p>
              <p>Total Active: {stats?.totalActive || 0}</p>
              <p>Guest Tokens: {stats?.guestTokens || 0}</p>
              <p>User Tokens: {stats?.userTokens || 0}</p>
              <p>Inactive Tokens: {stats?.inactiveTokens || 0}</p>
              <p>Live Guests: {stats?.liveGuestConnections || 0}</p>
              <p>Live Users: {stats?.liveUserConnections || 0}</p>
              <p>Live Total: {stats?.liveAllConnections || 0}</p>

              {(stats?.totalActive || 0) === 0 && (
                <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800">
                  <p className="font-semibold">No devices registered</p>
                  <p className="text-[13px]">
                    Open the client site → Settings → enable Push Notifications
                    and allow browser permission, then click Send again.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm p-5 lg:col-span-2">
          <div className="flex items-center gap-2 mb-3">
            <MdNotificationsActive className="text-xl text-blue-500" />
            <h2 className="font-semibold text-gray-800">Send Offer</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <TextField
              label="Title"
              name="title"
              value={form.title}
              onChange={handleChange}
              size="small"
              fullWidth
            />
            <TextField
              label="Coupon Code"
              name="couponCode"
              value={form.couponCode}
              onChange={handleChange}
              size="small"
              fullWidth
            />
            <TextField
              label="Message"
              name="body"
              value={form.body}
              onChange={handleChange}
              size="small"
              fullWidth
              multiline
              rows={3}
              className="md:col-span-2"
            />
            <TextField
              label="Discount Value"
              name="discountValue"
              value={form.discountValue}
              onChange={handleChange}
              size="small"
              fullWidth
            />
            <FormControlLabel
              control={
                <Switch
                  checked={form.includeUsers}
                  onChange={handleChange}
                  name="includeUsers"
                  color="warning"
                />
              }
              label="Include logged-in users"
            />
          </div>
          <Button
            variant="contained"
            sx={{ mt: 3, bgcolor: "#059669", "&:hover": { bgcolor: "#047857" } }}
            onClick={handleSend}
            disabled={sending}
          >
            {sending ? <CircularProgress size={20} color="inherit" /> : "Send"}
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-5">
        <div className="flex items-center gap-2 mb-3">
          <MdNotificationsActive className="text-xl text-emerald-500" />
          <h2 className="font-semibold text-gray-800">Send Promotional Email</h2>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          Sends an email to all users who opted in to promotional emails.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <TextField
            label="Subject"
            name="subject"
            value={promoEmail.subject}
            onChange={handlePromoEmailChange}
            size="small"
            fullWidth
          />
          <TextField
            label="Headline (optional)"
            name="headline"
            value={promoEmail.headline}
            onChange={handlePromoEmailChange}
            size="small"
            fullWidth
          />
          <TextField
            label="Message"
            name="message"
            value={promoEmail.message}
            onChange={handlePromoEmailChange}
            size="small"
            fullWidth
            multiline
            rows={3}
            className="md:col-span-2"
          />
          <TextField
            label="Coupon Code (optional)"
            name="couponCode"
            value={promoEmail.couponCode}
            onChange={handlePromoEmailChange}
            size="small"
            fullWidth
          />
          <TextField
            label="Discount Text (optional)"
            name="discountText"
            value={promoEmail.discountText}
            onChange={handlePromoEmailChange}
            size="small"
            fullWidth
          />
          <TextField
            label="CTA Label"
            name="ctaLabel"
            value={promoEmail.ctaLabel}
            onChange={handlePromoEmailChange}
            size="small"
            fullWidth
          />
          <TextField
            label="CTA URL (optional)"
            name="ctaUrl"
            value={promoEmail.ctaUrl}
            onChange={handlePromoEmailChange}
            size="small"
            fullWidth
          />
          <TextField
            label="Valid Until (optional)"
            name="validUntil"
            value={promoEmail.validUntil}
            onChange={handlePromoEmailChange}
            size="small"
            fullWidth
            placeholder="e.g., 31 Mar 2026"
          />
        </div>
        <Button
          variant="contained"
          sx={{ mt: 3, bgcolor: "#2563eb", "&:hover": { bgcolor: "#1d4ed8" } }}
          onClick={handleSendPromoEmail}
          disabled={sendingPromoEmail}
        >
          {sendingPromoEmail ? (
            <CircularProgress size={20} color="inherit" />
          ) : (
            "Send Promotional Email"
          )}
        </Button>
      </div>
    </div>
  );
};

export default NotificationsPage;
