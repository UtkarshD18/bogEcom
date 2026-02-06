"use client";

import { useAdmin } from "@/context/AdminContext";
import { deleteData, getData } from "@/utils/api";
import { Button, CircularProgress, MenuItem, Select } from "@mui/material";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { MdMailOutline } from "react-icons/md";
import Pagination from "@mui/material/Pagination";

const NewsletterPage = () => {
  const { token, isAuthenticated, loading } = useAdmin();
  const router = useRouter();

  const [subscribers, setSubscribers] = useState([]);
  const [stats, setStats] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSubscribers = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await getData(
        `/api/newsletter/subscribers?page=${page}&limit=20&status=${statusFilter}`,
        token,
      );

      if (response.success) {
        setSubscribers(response.subscribers || []);
        setStats(response.stats || null);
        setTotalPages(response.pagination?.pages || 1);
      } else {
        setSubscribers([]);
        setStats(null);
      }
    } catch (error) {
      console.error("Failed to fetch subscribers:", error);
      setSubscribers([]);
      setStats(null);
    }
    setIsLoading(false);
  }, [page, statusFilter, token]);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, loading, router]);

  useEffect(() => {
    if (isAuthenticated && token) {
      fetchSubscribers();
    }
  }, [isAuthenticated, token, fetchSubscribers]);

  const handleDelete = async (id) => {
    if (!confirm("Delete this subscriber?")) return;
    try {
      const response = await deleteData(`/api/newsletter/subscribers/${id}`, token);
      if (response.success) {
        toast.success("Subscriber deleted");
        fetchSubscribers();
      } else {
        toast.error(response.message || "Failed to delete subscriber");
      }
    } catch (error) {
      toast.error("Failed to delete subscriber");
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
          <h1 className="text-2xl font-bold text-gray-800">Newsletter</h1>
          <p className="text-gray-500">Manage newsletter subscribers</p>
        </div>
        <div className="flex items-center gap-2">
          <Select
            size="small"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <MenuItem value="all">All</MenuItem>
            <MenuItem value="active">Active</MenuItem>
            <MenuItem value="inactive">Inactive</MenuItem>
          </Select>
          <Button variant="outlined" onClick={fetchSubscribers}>
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm p-5">
          <div className="flex items-center gap-2 mb-2">
            <MdMailOutline className="text-xl text-orange-500" />
            <h2 className="font-semibold text-gray-800">Subscribers</h2>
          </div>
          <p className="text-gray-600 text-sm">
            Total: {stats?.total || 0}
          </p>
          <p className="text-gray-600 text-sm">
            Active: {stats?.active || 0}
          </p>
          <p className="text-gray-600 text-sm">
            Inactive: {stats?.inactive || 0}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-5">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <CircularProgress size={28} />
          </div>
        ) : subscribers.length === 0 ? (
          <div className="text-center py-10 text-gray-500">
            No subscribers found.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="text-left text-sm font-semibold text-gray-600 px-4 py-2">
                      Email
                    </th>
                    <th className="text-left text-sm font-semibold text-gray-600 px-4 py-2">
                      Status
                    </th>
                    <th className="text-left text-sm font-semibold text-gray-600 px-4 py-2">
                      Source
                    </th>
                    <th className="text-left text-sm font-semibold text-gray-600 px-4 py-2">
                      Subscribed At
                    </th>
                    <th className="text-left text-sm font-semibold text-gray-600 px-4 py-2">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {subscribers.map((subscriber) => (
                    <tr key={subscriber._id} className="border-b">
                      <td className="px-4 py-2 text-sm text-gray-700">
                        {subscriber.email}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-600">
                        {subscriber.isActive ? "Active" : "Inactive"}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-600">
                        {subscriber.source || "unknown"}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-600">
                        {subscriber.subscribedAt
                          ? new Date(subscriber.subscribedAt).toLocaleDateString()
                          : "-"}
                      </td>
                      <td className="px-4 py-2 text-sm">
                        <Button
                          size="small"
                          color="error"
                          onClick={() => handleDelete(subscriber._id)}
                        >
                          Delete
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-center py-6">
              <Pagination
                count={totalPages}
                page={page}
                onChange={(e, value) => setPage(value)}
                showFirstButton
                showLastButton
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default NewsletterPage;
