"use client";

import { useAdmin } from "@/context/AdminContext";
import { getData } from "@/utils/api";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { RiVipCrownFill } from "react-icons/ri";

const EMPTY_SUMMARY = {
  newMembersThisMonth: 0,
  activeMembers: 0,
  expiredMembers: 0,
  totalMembers: 0,
  totalPointsDistributed: 0,
};

export default function MembershipAnalyticsPage() {
  const { token } = useAdmin();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(EMPTY_SUMMARY);
  const [growth, setGrowth] = useState([]);

  useEffect(() => {
    if (!token) return;

    const loadAnalytics = async () => {
      setLoading(true);
      const response = await getData("/api/admin/membership-analytics", token);

      if (response?.success) {
        setSummary(response?.data?.summary || EMPTY_SUMMARY);
        setGrowth(response?.data?.growth || []);
      } else {
        toast.error(response?.message || "Failed to fetch membership analytics");
      }

      setLoading(false);
    };

    loadAnalytics();
  }, [token]);

  return (
    <div className="p-6 space-y-6">
      <div className="bg-gradient-to-r from-indigo-600 to-blue-600 rounded-2xl p-6 text-white">
        <div className="flex items-center gap-3 mb-2">
          <RiVipCrownFill className="text-2xl text-amber-300" />
          <h1 className="text-2xl font-bold">Membership Analytics</h1>
        </div>
        <p className="text-blue-100">
          Track growth, active users, expiry trend, and points distribution.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <p className="text-sm text-gray-500">New Members This Month</p>
          <p className="text-2xl font-bold text-gray-900">
            {loading ? "..." : summary.newMembersThisMonth}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <p className="text-sm text-gray-500">Active Members</p>
          <p className="text-2xl font-bold text-emerald-600">
            {loading ? "..." : summary.activeMembers}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <p className="text-sm text-gray-500">Expired Members</p>
          <p className="text-2xl font-bold text-red-600">
            {loading ? "..." : summary.expiredMembers}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <p className="text-sm text-gray-500">Total Points Distributed</p>
          <p className="text-2xl font-bold text-indigo-600">
            {loading ? "..." : Math.round(summary.totalPointsDistributed || 0)}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Members Growth Over Time</h2>
        <div className="h-[360px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={growth}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="totalMembers"
                stroke="#2563eb"
                strokeWidth={3}
                dot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
