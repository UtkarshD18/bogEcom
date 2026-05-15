"use client";

import { useAdmin } from "@/context/AdminContext";
import {
  fetchSupportTicketById,
  updateSupportTicket,
} from "@/services/supportApi";
import {
  Button,
  Dialog,
  DialogContent,
  MenuItem,
  TextField,
} from "@mui/material";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";

const statusBadgeClass = (status) => {
  if (status === "OPEN") return "bg-red-50 text-red-700 border-red-100";
  if (status === "PENDING" || status === "IN_PROGRESS") {
    return "bg-amber-50 text-amber-700 border-amber-100";
  }
  if (status === "RESOLVED") {
    return "bg-emerald-50 text-emerald-700 border-emerald-100";
  }
  return "bg-gray-50 text-gray-700 border-gray-100";
};

const formatIstDateTime = (value) => {
  if (!value) return "N/A";
  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) return String(value || "N/A");

  const formatted = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(parsedDate);

  return formatted.replace(/\s(AM|PM)$/i, (meridiem) => meridiem.toLowerCase());
};

const DetailRow = ({ label, value }) => (
  <div className="rounded-lg bg-gray-50 px-3 py-2">
    <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
      {label}
    </p>
    <p className="mt-1 break-words text-sm font-medium text-gray-900">
      {value || "N/A"}
    </p>
  </div>
);

const MessageBubble = ({ message, onPreviewImage }) => {
  const isAdmin = message?.authorType === "admin";
  const isSystem = message?.authorType === "system";

  if (isSystem) {
    return (
      <div className="flex justify-center">
        <div className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-500">
          {message.message}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex ${isAdmin ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[78%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
          isAdmin
            ? "bg-blue-600 text-white"
            : "border border-gray-200 bg-white text-gray-900"
        }`}
      >
        <div className="mb-1 flex items-center justify-between gap-3">
          <p className="text-[11px] font-bold uppercase tracking-wide opacity-75">
            {isAdmin ? "Admin" : message?.authorName || "Customer"}
          </p>
          <p className="text-[10px] opacity-65">{message.created_at || ""}</p>
        </div>
        <p className="whitespace-pre-wrap leading-6">{message.message}</p>

        {Array.isArray(message.images) && message.images.length > 0 ? (
          <div className="mt-3 grid grid-cols-2 gap-2">
            {message.images.map((imageUrl) => (
              <button
                key={imageUrl}
                type="button"
                onClick={() => onPreviewImage(imageUrl)}
                className="overflow-hidden rounded-xl border border-black/10 bg-white/20"
              >
                <img
                  src={imageUrl}
                  alt="Support attachment"
                  className="h-28 w-full object-cover"
                  loading="lazy"
                />
              </button>
            ))}
          </div>
        ) : null}

        {Array.isArray(message.videos) && message.videos.length > 0 ? (
          <div className="mt-3 space-y-2">
            {message.videos.map((videoUrl) => (
              <video
                key={videoUrl}
                src={videoUrl}
                controls
                preload="metadata"
                className="max-h-56 w-full rounded-xl bg-black"
              />
            ))}
          </div>
        ) : null}

        {Array.isArray(message.attachments) &&
        message.attachments.length > 0 ? (
          <div className="mt-3 space-y-1">
            {message.attachments.map((attachmentUrl) => (
              <a
                key={attachmentUrl}
                href={attachmentUrl}
                target="_blank"
                rel="noreferrer"
                className="block break-all text-xs font-semibold underline"
              >
                Attachment
              </a>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
};

const CustomerCareDetailPage = () => {
  const { token, isAuthenticated, loading } = useAdmin();
  const router = useRouter();
  const params = useParams();
  const ticketId = params?.ticketId ? String(params.ticketId) : "";

  const [ticket, setTicket] = useState(null);
  const [status, setStatus] = useState("OPEN");
  const [adminReply, setAdminReply] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedImage, setSelectedImage] = useState("");

  const loadTicket = useCallback(async () => {
    if (!ticketId) return;
    setIsLoading(true);
    try {
      const response = await fetchSupportTicketById(ticketId, token);
      if (!response?.success || !response?.data?.ticket) {
        toast.error(response?.message || "Ticket not found.");
        router.push("/customer-care");
        return;
      }

      const nextTicket = response.data.ticket;
      setTicket(nextTicket);
      setStatus(nextTicket.status || "OPEN");
      setAdminReply("");
    } catch {
      toast.error("Failed to load ticket details.");
      router.push("/customer-care");
    } finally {
      setIsLoading(false);
    }
  }, [ticketId, token, router]);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, loading, router]);

  useEffect(() => {
    if (isAuthenticated && token && ticketId) {
      loadTicket();
    }
  }, [isAuthenticated, token, ticketId, loadTicket]);

  const normalizedOrder = useMemo(() => {
    if (!ticket?.orderId || typeof ticket.orderId !== "object") return null;
    return ticket.orderId;
  }, [ticket]);

  const ticketMessages = useMemo(
    () => (Array.isArray(ticket?.messages) ? ticket.messages : []),
    [ticket],
  );

  const latestCustomerMessage = useMemo(
    () =>
      [...ticketMessages]
        .reverse()
        .find((message) => message?.authorType === "customer") || null,
    [ticketMessages],
  );

  const handleSave = async () => {
    if (!ticket?.ticketId) return;

    const payload = {};
    if (status !== ticket.status) payload.status = status;
    if (adminReply.trim()) {
      payload.adminReply = adminReply.trim();
    }

    if (!Object.keys(payload).length) {
      toast.error("Write a reply or change status before saving.");
      return;
    }

    setIsSaving(true);
    try {
      const response = await updateSupportTicket(ticket.ticketId, payload, token);
      if (!response?.success) {
        toast.error(response?.message || "Failed to update ticket.");
        return;
      }

      toast.success(response?.message || "Ticket updated.");
      await loadTicket();
    } catch {
      toast.error("Failed to update ticket.");
    } finally {
      setIsSaving(false);
    }
  };

  if (loading || !isAuthenticated || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!ticket) return null;

  return (
    <section className="w-full bg-gray-50 p-5">
      <div className="mx-auto max-w-[1600px] space-y-5">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">
                Customer Care
              </p>
              <h1 className="mt-1 text-2xl font-bold text-gray-900">
                {ticket.subject || "Support Ticket"}
              </h1>
              <p className="mt-1 text-sm text-gray-500">{ticket.ticketId}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${statusBadgeClass(ticket.status)}`}
              >
                {ticket.status}
              </span>
              <Button
                variant="outlined"
                size="small"
                sx={{ textTransform: "none" }}
                onClick={() => router.push("/customer-care")}
              >
                Back to List
              </Button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-100 px-5 py-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">
                    Conversation
                  </h2>
                  <p className="text-sm text-gray-500">
                    Customer messages, admin replies, screenshots, and videos.
                  </p>
                </div>
                <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
                  {ticketMessages.length} message
                  {ticketMessages.length === 1 ? "" : "s"}
                </span>
              </div>
            </div>

            <div className="min-h-[560px] space-y-4 bg-[#f8fafc] p-5">
              {ticketMessages.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">
                  No conversation messages yet.
                </div>
              ) : (
                ticketMessages.map((message, index) => (
                  <MessageBubble
                    key={`${message?.created_at_ts || index}-${index}`}
                    message={message}
                    onPreviewImage={setSelectedImage}
                  />
                ))
              )}
            </div>
          </div>

          <aside className="space-y-5">
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="text-base font-bold text-gray-900">Reply</h2>
              <p className="mt-1 text-sm text-gray-500">
                Send a clear customer-facing response and update ticket status.
              </p>
              <div className="mt-4 space-y-4">
                <TextField
                  select
                  fullWidth
                  label="Status"
                  size="small"
                  value={status}
                  onChange={(event) => setStatus(event.target.value)}
                >
                  <MenuItem value="OPEN">OPEN</MenuItem>
                  <MenuItem value="PENDING">PENDING</MenuItem>
                  <MenuItem value="RESOLVED">RESOLVED</MenuItem>
                </TextField>

                <TextField
                  label="Reply to Customer"
                  value={adminReply}
                  onChange={(event) => setAdminReply(event.target.value)}
                  fullWidth
                  multiline
                  rows={6}
                  placeholder="Write the next reply. The customer will see it in My Support."
                />

                <Button
                  fullWidth
                  variant="contained"
                  onClick={handleSave}
                  disabled={isSaving}
                  sx={{ textTransform: "none", fontWeight: 700 }}
                >
                  {isSaving ? "Saving..." : "Send Reply / Save Status"}
                </Button>
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="text-base font-bold text-gray-900">
                Customer Snapshot
              </h2>
              <div className="mt-4 grid gap-3">
                <DetailRow label="Name" value={ticket.name} />
                <DetailRow label="Email" value={ticket.email} />
                <DetailRow label="Phone" value={ticket.phone} />
                <DetailRow
                  label="User ID"
                  value={ticket.userId?._id || ticket.userId || "Guest"}
                />
                <DetailRow label="Created" value={ticket.created_at} />
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="text-base font-bold text-gray-900">
                Order Snapshot
              </h2>
              {normalizedOrder ? (
                <div className="mt-4 grid gap-3">
                  <DetailRow
                    label="Order ID"
                    value={
                      normalizedOrder.displayOrderId
                        ? `#${normalizedOrder.displayOrderId}`
                        : String(normalizedOrder._id || "")
                    }
                  />
                  <DetailRow
                    label="Order Status"
                    value={normalizedOrder.order_status}
                  />
                  <DetailRow
                    label="Payment Status"
                    value={normalizedOrder.payment_status}
                  />
                  <DetailRow
                    label="Total"
                    value={`Rs ${Number(
                      normalizedOrder.displayTotal ??
                        normalizedOrder.finalAmount ??
                        normalizedOrder.totalAmt ??
                        0,
                    ).toFixed(2)}`}
                  />
                  <DetailRow
                    label="Order Date"
                    value={formatIstDateTime(normalizedOrder.createdAt)}
                  />
                </div>
              ) : (
                <p className="mt-3 text-sm text-gray-500">
                  No order linked to this ticket.
                </p>
              )}
            </div>

            {normalizedOrder?.products?.length > 0 ? (
              <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <h2 className="text-base font-bold text-gray-900">
                  Order Items
                </h2>
                <div className="mt-3 space-y-2">
                  {normalizedOrder.products.map((item, index) => (
                    <div
                      key={`${item.productId || "item"}-${index}`}
                      className="rounded-lg border border-gray-100 bg-gray-50 p-3"
                    >
                      <p className="text-sm font-semibold text-gray-900">
                        {item.productTitle || "Product"}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        Qty {item.quantity || 0} x Rs{" "}
                        {Number(item.price || 0).toFixed(2)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {latestCustomerMessage ? (
              <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <h2 className="text-base font-bold text-gray-900">
                  Latest Customer Note
                </h2>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-gray-700">
                  {latestCustomerMessage.message}
                </p>
              </div>
            ) : null}
          </aside>
        </div>
      </div>

      <Dialog
        open={Boolean(selectedImage)}
        onClose={() => setSelectedImage("")}
        maxWidth="lg"
      >
        <DialogContent>
          {selectedImage ? (
            <img
              src={selectedImage}
              alt="Ticket attachment preview"
              className="max-h-[80vh] w-auto"
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  );
};

export default CustomerCareDetailPage;
