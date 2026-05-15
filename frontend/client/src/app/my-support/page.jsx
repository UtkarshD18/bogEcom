"use client";

import AccountSidebar from "@/components/AccountSiderbar";
import {
  closeMySupportTicket,
  fetchMySupportTicketById,
  fetchMySupportTickets,
  replyToMySupportTicket,
} from "@/services/supportApi";
import { getStoredAccessToken } from "@/utils/api";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import { FiCheckCircle, FiRefreshCw, FiSend } from "react-icons/fi";

const statusClass = (status) => {
  if (status === "RESOLVED") return "bg-emerald-50 text-emerald-700";
  if (status === "PENDING" || status === "IN_PROGRESS") {
    return "bg-amber-50 text-amber-700";
  }
  return "bg-blue-50 text-blue-700";
};

const SupportMessage = ({ message }) => {
  const isCustomer = message?.authorType === "customer";
  const isSystem = message?.authorType === "system";

  if (isSystem) {
    return (
      <div className="text-center text-xs font-medium text-gray-500">
        {message.message}
      </div>
    );
  }

  return (
    <div className={`flex ${isCustomer ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
          isCustomer
            ? "bg-[var(--primary)] text-white"
            : "bg-white border border-gray-200 text-gray-800"
        }`}
      >
        <div className="mb-1 text-[11px] font-semibold opacity-75">
          {isCustomer ? "You" : message?.authorName || "Customer Care"}
        </div>
        <p className="whitespace-pre-wrap leading-6">{message.message}</p>
        <div className="mt-2 text-[10px] opacity-70">
          {message.created_at || ""}
        </div>
      </div>
    </div>
  );
};

export default function MySupportPage() {
  const router = useRouter();
  const [tickets, setTickets] = useState([]);
  const [selectedTicketId, setSelectedTicketId] = useState("");
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [ticketLoading, setTicketLoading] = useState(false);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);

  const selectedMessages = useMemo(
    () => (Array.isArray(selectedTicket?.messages) ? selectedTicket.messages : []),
    [selectedTicket],
  );
  const isResolved = selectedTicket?.status === "RESOLVED";

  const loadTickets = async () => {
    setLoading(true);
    try {
      const response = await fetchMySupportTickets();
      if (!response?.success) {
        throw new Error(response?.message || "Failed to load support tickets.");
      }
      const nextTickets = Array.isArray(response?.data?.tickets)
        ? response.data.tickets
        : [];
      setTickets(nextTickets);
      setSelectedTicketId((current) => current || nextTickets[0]?.ticketId || "");
    } catch (error) {
      toast.error(error?.message || "Failed to load support tickets.");
    } finally {
      setLoading(false);
    }
  };

  const loadSelectedTicket = async (ticketId) => {
    if (!ticketId) {
      setSelectedTicket(null);
      return;
    }
    setTicketLoading(true);
    try {
      const response = await fetchMySupportTicketById(ticketId);
      if (!response?.success || !response?.data?.ticket) {
        throw new Error(response?.message || "Failed to load ticket.");
      }
      setSelectedTicket(response.data.ticket);
    } catch (error) {
      toast.error(error?.message || "Failed to load ticket.");
    } finally {
      setTicketLoading(false);
    }
  };

  useEffect(() => {
    if (!getStoredAccessToken()) {
      router.push("/login?redirect=/my-support");
      return;
    }
    void loadTickets();
  }, [router]);

  useEffect(() => {
    void loadSelectedTicket(selectedTicketId);
  }, [selectedTicketId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [selectedMessages.length, selectedTicketId]);

  const sendReply = async () => {
    const message = reply.trim();
    if (!selectedTicketId || !message) return;

    setSending(true);
    try {
      const response = await replyToMySupportTicket(selectedTicketId, message);
      if (!response?.success) {
        throw new Error(response?.message || "Failed to send reply.");
      }
      setReply("");
      await loadSelectedTicket(selectedTicketId);
      await loadTickets();
    } catch (error) {
      toast.error(error?.message || "Failed to send reply.");
    } finally {
      setSending(false);
    }
  };

  const closeTicket = async () => {
    if (!selectedTicketId) return;
    setSending(true);
    try {
      const response = await closeMySupportTicket(selectedTicketId);
      if (!response?.success) {
        throw new Error(response?.message || "Failed to close ticket.");
      }
      toast.success("Ticket marked as resolved.");
      await loadSelectedTicket(selectedTicketId);
      await loadTickets();
    } catch (error) {
      toast.error(error?.message || "Failed to close ticket.");
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="bg-gray-50 min-h-screen py-8">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)] gap-6">
          <AccountSidebar />

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 px-5 py-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">My Support</h1>
                <p className="text-sm text-gray-500">
                  Track replies and continue support conversations.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={loadTickets}
                  className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  <FiRefreshCw /> Refresh
                </button>
                <Link
                  href="/contact#support-form"
                  className="rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white"
                >
                  New Concern
                </Link>
              </div>
            </div>

            <div className="grid min-h-[640px] grid-cols-1 lg:grid-cols-[340px_minmax(0,1fr)]">
              <aside className="border-b border-gray-100 lg:border-b-0 lg:border-r">
                {loading ? (
                  <div className="p-5 text-sm text-gray-500">Loading tickets...</div>
                ) : tickets.length === 0 ? (
                  <div className="p-5 text-sm text-gray-500">
                    No support tickets yet.
                  </div>
                ) : (
                  <div className="max-h-[640px] overflow-y-auto">
                    {tickets.map((ticket) => (
                      <button
                        key={ticket.ticketId}
                        type="button"
                        onClick={() => setSelectedTicketId(ticket.ticketId)}
                        className={`w-full border-b border-gray-100 p-4 text-left transition hover:bg-gray-50 ${
                          selectedTicketId === ticket.ticketId ? "bg-orange-50/60" : ""
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-semibold text-gray-900">
                            {ticket.ticketId}
                          </p>
                          <span
                            className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${statusClass(ticket.status)}`}
                          >
                            {ticket.status}
                          </span>
                        </div>
                        <p className="mt-2 line-clamp-2 text-sm text-gray-600">
                          {ticket.lastMessage || "No messages yet."}
                        </p>
                        <p className="mt-2 text-xs text-gray-400">
                          Updated {ticket.updated_at || ticket.created_at || ""}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </aside>

              <main className="flex min-h-[640px] flex-col bg-[#fbf8f5]">
                {!selectedTicket ? (
                  <div className="flex flex-1 items-center justify-center p-8 text-center text-gray-500">
                    {ticketLoading ? "Loading conversation..." : "Select a ticket to view conversation."}
                  </div>
                ) : (
                  <>
                    <div className="border-b border-gray-100 bg-white px-5 py-4">
                      <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                        <div>
                          <h2 className="text-lg font-bold text-gray-900">
                            {selectedTicket.subject}
                          </h2>
                          <p className="text-sm text-gray-500">
                            {selectedTicket.ticketId}
                            {selectedTicket.orderDisplayId
                              ? ` · Order #${selectedTicket.orderDisplayId}`
                              : ""}
                          </p>
                        </div>
                        <span
                          className={`w-fit rounded-full px-3 py-1 text-xs font-bold ${statusClass(selectedTicket.status)}`}
                        >
                          {selectedTicket.status}
                        </span>
                      </div>
                    </div>

                    <div className="flex-1 space-y-4 overflow-y-auto p-5">
                      {selectedMessages.map((message, index) => (
                        <SupportMessage
                          key={`${message.created_at_ts || index}-${index}`}
                          message={message}
                        />
                      ))}
                      <div ref={messagesEndRef} />
                    </div>

                    <div className="border-t border-gray-100 bg-white p-4">
                      {isResolved ? (
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                          <span>This issue is marked resolved.</span>
                          <button
                            type="button"
                            onClick={() => setReply("I still need help with this issue.")}
                            className="font-semibold underline"
                          >
                            Ask for more help
                          </button>
                        </div>
                      ) : null}
                      <div className="mt-3 flex flex-col gap-3 md:flex-row">
                        <textarea
                          value={reply}
                          onChange={(event) => setReply(event.target.value)}
                          rows={3}
                          placeholder="Write your reply..."
                          className="min-h-[86px] flex-1 rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[var(--primary)]"
                        />
                        <div className="flex md:w-44 flex-row md:flex-col gap-2">
                          <button
                            type="button"
                            onClick={sendReply}
                            disabled={sending || !reply.trim()}
                            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
                          >
                            <FiSend /> Send
                          </button>
                          {!isResolved ? (
                            <button
                              type="button"
                              onClick={closeTicket}
                              disabled={sending}
                              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 disabled:opacity-60"
                            >
                              <FiCheckCircle /> Resolved
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </main>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
