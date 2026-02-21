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
  if (status === "OPEN") return "bg-red-100 text-red-700";
  if (status === "IN_PROGRESS") return "bg-amber-100 text-amber-700";
  if (status === "RESOLVED") return "bg-emerald-100 text-emerald-700";
  return "bg-gray-100 text-gray-700";
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
      setAdminReply(nextTicket.adminReply || "");
    } catch (error) {
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

  const handleSave = async () => {
    if (!ticket?.ticketId) return;

    const payload = {};
    if (status !== ticket.status) payload.status = status;
    if (adminReply.trim() !== String(ticket.adminReply || "").trim()) {
      payload.adminReply = adminReply.trim();
    }

    if (!Object.keys(payload).length) {
      toast.error("No changes to save.");
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
    } catch (error) {
      toast.error("Failed to update ticket.");
    } finally {
      setIsSaving(false);
    }
  };

  if (loading || !isAuthenticated || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!ticket) {
    return null;
  }

  return (
    <section className="w-full p-5">
      <div className="bg-white rounded-lg shadow-md p-5 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-[22px] font-[600] text-gray-800">Ticket Detail</h1>
            <p className="text-sm text-gray-500">{ticket.ticketId}</p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold ${statusBadgeClass(ticket.status)}`}
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="border border-gray-100 rounded-lg p-4">
            <h2 className="text-[16px] font-semibold text-gray-800 mb-3">User Details</h2>
            <div className="space-y-2 text-sm text-gray-700">
              <p>
                <span className="font-semibold">Name:</span> {ticket.name || "N/A"}
              </p>
              <p>
                <span className="font-semibold">Email:</span> {ticket.email || "N/A"}
              </p>
              <p>
                <span className="font-semibold">Phone:</span> {ticket.phone || "N/A"}
              </p>
              <p>
                <span className="font-semibold">User ID:</span>{" "}
                {ticket.userId?._id || ticket.userId || "Guest"}
              </p>
              <p>
                <span className="font-semibold">Created:</span>{" "}
                {ticket.createdAt
                  ? new Date(ticket.createdAt).toLocaleString("en-IN")
                  : "N/A"}
              </p>
            </div>
          </div>

          <div className="border border-gray-100 rounded-lg p-4">
            <h2 className="text-[16px] font-semibold text-gray-800 mb-3">Order Details</h2>
            {normalizedOrder ? (
              <div className="space-y-2 text-sm text-gray-700">
                <p>
                  <span className="font-semibold">Order ID:</span>{" "}
                  {normalizedOrder.displayOrderId
                    ? `#${normalizedOrder.displayOrderId}`
                    : String(normalizedOrder._id || "")}
                </p>
                <p>
                  <span className="font-semibold">Order Status:</span>{" "}
                  {normalizedOrder.order_status || "N/A"}
                </p>
                <p>
                  <span className="font-semibold">Payment Status:</span>{" "}
                  {normalizedOrder.payment_status || "N/A"}
                </p>
                <p>
                  <span className="font-semibold">Total:</span> ₹
                  {Number(
                    normalizedOrder.displayTotal ??
                      normalizedOrder.finalAmount ??
                      normalizedOrder.totalAmt ??
                      0,
                  ).toLocaleString("en-IN", {
                    minimumFractionDigits: 2,
                  })}
                </p>
                <p>
                  <span className="font-semibold">Order Date:</span>{" "}
                  {normalizedOrder.createdAt
                    ? new Date(normalizedOrder.createdAt).toLocaleString("en-IN")
                    : "N/A"}
                </p>
              </div>
            ) : (
              <p className="text-sm text-gray-500">No order linked to this ticket.</p>
            )}
          </div>
        </div>

        {normalizedOrder?.products?.length > 0 && (
          <div className="border border-gray-100 rounded-lg p-4">
            <h2 className="text-[16px] font-semibold text-gray-800 mb-3">Order Items</h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px]">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-3 py-2 text-sm font-semibold text-gray-700">
                      Product
                    </th>
                    <th className="text-left px-3 py-2 text-sm font-semibold text-gray-700">
                      Qty
                    </th>
                    <th className="text-left px-3 py-2 text-sm font-semibold text-gray-700">
                      Price
                    </th>
                    <th className="text-left px-3 py-2 text-sm font-semibold text-gray-700">
                      Subtotal
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {normalizedOrder.products.map((item, index) => (
                    <tr key={`${item.productId}-${index}`} className="border-b border-gray-100">
                      <td className="px-3 py-2 text-sm text-gray-700">
                        {item.productTitle || "Product"}
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-700">
                        {item.quantity || 0}
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-700">
                        ₹{Number(item.price || 0).toFixed(2)}
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-700">
                        ₹{Number(item.subTotal || 0).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="border border-gray-100 rounded-lg p-4">
          <h2 className="text-[16px] font-semibold text-gray-800 mb-2">Customer Message</h2>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">
            {ticket.message || "No message provided."}
          </p>
        </div>

        <div className="border border-gray-100 rounded-lg p-4">
          <h2 className="text-[16px] font-semibold text-gray-800 mb-3">Images</h2>
          {!ticket.images?.length ? (
            <p className="text-sm text-gray-500">No images uploaded.</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {ticket.images.map((imageUrl) => (
                <button
                  key={imageUrl}
                  type="button"
                  className="rounded-md overflow-hidden border border-gray-200 bg-gray-100"
                  onClick={() => setSelectedImage(imageUrl)}
                >
                  <img
                    src={imageUrl}
                    alt="Ticket attachment"
                    className="w-full h-28 object-cover"
                    loading="lazy"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="border border-gray-100 rounded-lg p-4">
          <h2 className="text-[16px] font-semibold text-gray-800 mb-3">Videos</h2>
          {!ticket.videos?.length ? (
            <p className="text-sm text-gray-500">No videos uploaded.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {ticket.videos.map((videoUrl) => (
                <video
                  key={videoUrl}
                  src={videoUrl}
                  controls
                  preload="metadata"
                  className="w-full rounded-md border border-gray-200 bg-black"
                />
              ))}
            </div>
          )}
        </div>

        <div className="border border-gray-100 rounded-lg p-4">
          <h2 className="text-[16px] font-semibold text-gray-800 mb-3">
            Admin Resolution
          </h2>
          <div className="space-y-4">
            <TextField
              select
              fullWidth
              label="Status"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <MenuItem value="OPEN">OPEN</MenuItem>
              <MenuItem value="IN_PROGRESS">IN_PROGRESS</MenuItem>
              <MenuItem value="RESOLVED">RESOLVED</MenuItem>
            </TextField>

            <TextField
              label="Admin Reply"
              value={adminReply}
              onChange={(event) => setAdminReply(event.target.value)}
              fullWidth
              multiline
              rows={5}
              placeholder="Write resolution notes for the customer..."
            />

            <Button
              variant="contained"
              onClick={handleSave}
              disabled={isSaving}
              sx={{ textTransform: "none" }}
            >
              {isSaving ? "Saving..." : "Save"}
            </Button>
          </div>
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
