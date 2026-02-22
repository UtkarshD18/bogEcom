"use client";

import { useAdmin } from "@/context/AdminContext";
import { fetchSupportTickets } from "@/services/supportApi";
import { Button, MenuItem, Pagination, TextField } from "@mui/material";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "react-hot-toast";

const statusBadgeClass = (status) => {
  if (status === "OPEN") return "bg-red-100 text-red-700";
  if (status === "PENDING" || status === "IN_PROGRESS")
    return "bg-amber-100 text-amber-700";
  if (status === "RESOLVED") return "bg-emerald-100 text-emerald-700";
  return "bg-gray-100 text-gray-700";
};

const CustomerCarePage = () => {
  const { token, isAuthenticated, loading } = useAdmin();
  const router = useRouter();

  const [tickets, setTickets] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filters, setFilters] = useState({
    status: "",
    email: "",
    orderId: "",
    dateFrom: "",
    dateTo: "",
  });

  const loadTickets = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetchSupportTickets(
        {
          page,
          limit: 20,
          filters,
        },
        token,
      );

      if (response?.success) {
        setTickets(Array.isArray(response.data?.tickets) ? response.data.tickets : []);
        setTotalPages(Math.max(Number(response.data?.pagination?.totalPages || 1), 1));
      } else {
        setTickets([]);
        setTotalPages(1);
        toast.error(response?.message || "Failed to load tickets.");
      }
    } catch (error) {
      setTickets([]);
      setTotalPages(1);
      toast.error("Failed to load tickets.");
    } finally {
      setIsLoading(false);
    }
  }, [filters, page, token]);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, loading, router]);

  useEffect(() => {
    if (isAuthenticated && token) {
      loadTickets();
    }
  }, [isAuthenticated, token, loadTickets]);

  const handleFilterChange = (event) => {
    const { name, value } = event.target;
    setPage(1);
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const clearFilters = () => {
    setPage(1);
    setFilters({
      status: "",
      email: "",
      orderId: "",
      dateFrom: "",
      dateTo: "",
    });
  };

  if (loading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <section className="w-full p-5">
      <div className="bg-white rounded-lg shadow-md p-5">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div>
            <h1 className="text-[22px] font-[600] text-gray-800">Customer Care</h1>
            <p className="text-sm text-gray-500">
              Manage support tickets, replies, and resolution flow.
            </p>
          </div>
          <Button
            variant="outlined"
            size="small"
            sx={{ textTransform: "none" }}
            onClick={clearFilters}
          >
            Clear Filters
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3 mb-5">
          <TextField
            select
            size="small"
            label="Status"
            name="status"
            value={filters.status}
            onChange={handleFilterChange}
          >
            <MenuItem value="">All</MenuItem>
            <MenuItem value="OPEN">OPEN</MenuItem>
            <MenuItem value="PENDING">PENDING</MenuItem>
            <MenuItem value="RESOLVED">RESOLVED</MenuItem>
          </TextField>

          <TextField
            size="small"
            label="Customer Email"
            name="email"
            value={filters.email}
            onChange={handleFilterChange}
          />

          <TextField
            size="small"
            label="Order ID"
            name="orderId"
            value={filters.orderId}
            onChange={handleFilterChange}
          />

          <TextField
            size="small"
            label="Date From"
            name="dateFrom"
            type="date"
            value={filters.dateFrom}
            onChange={handleFilterChange}
            InputLabelProps={{ shrink: true }}
          />

          <TextField
            size="small"
            label="Date To"
            name="dateTo"
            type="date"
            value={filters.dateTo}
            onChange={handleFilterChange}
            InputLabelProps={{ shrink: true }}
          />
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600"></div>
          </div>
        ) : tickets.length === 0 ? (
          <div className="py-10 text-center text-gray-500">No tickets found.</div>
        ) : (
          <>
            <div className="overflow-x-auto w-full">
              <table className="w-full min-w-[980px]">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700">
                      Ticket ID
                    </th>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700">
                      User Name
                    </th>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700">
                      Email
                    </th>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700">
                      Order ID
                    </th>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700">
                      Status
                    </th>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700">
                      Date
                    </th>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.map((ticket) => (
                    <tr
                      key={ticket.ticketId}
                      className="border-b border-gray-100 hover:bg-gray-50"
                    >
                      <td className="px-4 py-3 text-sm font-semibold text-gray-800">
                        {ticket.ticketId}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">{ticket.name}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{ticket.email}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {ticket.orderDisplayId
                          ? `#${ticket.orderDisplayId}`
                          : ticket.orderId
                            ? String(ticket.orderId)
                            : "N/A"}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span
                          className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold ${statusBadgeClass(ticket.status)}`}
                        >
                          {ticket.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {ticket.created_at || ticket.createdAt || "-"}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <Link href={`/customer-care/${ticket.ticketId}`}>
                          <Button
                            variant="outlined"
                            size="small"
                            sx={{ textTransform: "none" }}
                          >
                            View
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-center pt-6">
              <Pagination
                page={page}
                count={totalPages}
                onChange={(event, value) => setPage(value)}
                showFirstButton
                showLastButton
              />
            </div>
          </>
        )}
      </div>
    </section>
  );
};

export default CustomerCarePage;
