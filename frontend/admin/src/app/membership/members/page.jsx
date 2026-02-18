"use client";

import MembershipMemberDrawer from "@/components/membership/MembershipMemberDrawer";
import MembershipMembersTable from "@/components/membership/MembershipMembersTable";
import { useAdmin } from "@/context/AdminContext";
import { getData, postData } from "@/utils/api";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  TextField,
} from "@mui/material";
import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { RiVipCrownFill } from "react-icons/ri";

const FILTER_OPTIONS = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "expiringSoon", label: "Expiring Soon (<= 7 days)" },
  { value: "expired", label: "Expired" },
];

const EMPTY_STATS = {
  totalMembers: 0,
  activeMembers: 0,
  expiringSoon: 0,
  expiredMembers: 0,
};

export default function MembershipMembersPage() {
  const { token } = useAdmin();
  const [members, setMembers] = useState([]);
  const [stats, setStats] = useState(EMPTY_STATS);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);

  const [pointsDialogOpen, setPointsDialogOpen] = useState(false);
  const [pointsTarget, setPointsTarget] = useState(null);
  const [pointsValue, setPointsValue] = useState("");

  const fetchMembers = useCallback(async () => {
    if (!token) return;
    setLoading(true);

    const params = new URLSearchParams({
      page: String(pagination.page),
      limit: String(pagination.limit),
      search,
      filter,
    });

    const response = await getData(`/api/admin/membership-users?${params}`, token);
    if (response?.success) {
      setMembers(response?.data?.members || []);
      setStats(response?.data?.stats || EMPTY_STATS);
      setPagination((prev) => ({
        ...prev,
        ...(response?.data?.pagination || {}),
      }));
    } else {
      toast.error(response?.message || "Failed to fetch membership users");
    }

    setLoading(false);
  }, [filter, pagination.limit, pagination.page, search, token]);

  const fetchMemberDetail = useCallback(
    async (membershipUserId, openDrawer = true) => {
      if (!token || !membershipUserId) return;
      if (openDrawer) setDrawerOpen(true);

      const response = await getData(
        `/api/admin/membership-users/${membershipUserId}`,
        token,
      );
      if (response?.success) {
        setSelectedMember(response.data);
      } else {
        toast.error(response?.message || "Failed to fetch member details");
      }
    },
    [token],
  );

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const runAction = async (action) => {
    setActionLoading(true);
    try {
      await action();
      await fetchMembers();
      if (selectedMember?._id) {
        await fetchMemberDetail(selectedMember._id, false);
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleExtend = async (member) => {
    if (!member?._id) return;
    await runAction(async () => {
      const response = await postData(
        "/api/admin/membership-users/extend",
        { membershipUserId: member._id, days: 365 },
        token,
      );
      if (!response?.success) {
        toast.error(response?.message || "Failed to extend membership");
        return;
      }
      toast.success("Membership extended by 365 days");
    });
  };

  const handleCancel = async (member) => {
    if (!member?._id) return;
    if (!window.confirm("Cancel this membership?")) return;

    await runAction(async () => {
      const response = await postData(
        "/api/admin/membership-users/toggle-status",
        { membershipUserId: member._id, action: "cancel" },
        token,
      );
      if (!response?.success) {
        toast.error(response?.message || "Failed to cancel membership");
        return;
      }
      toast.success("Membership cancelled");
    });
  };

  const handleReactivate = async (member) => {
    if (!member?._id) return;
    await runAction(async () => {
      const response = await postData(
        "/api/admin/membership-users/toggle-status",
        { membershipUserId: member._id, action: "reactivate" },
        token,
      );
      if (!response?.success) {
        toast.error(response?.message || "Failed to reactivate membership");
        return;
      }
      toast.success("Membership reactivated");
    });
  };

  const handlePointsApply = async () => {
    const parsed = Number(pointsValue);
    if (!pointsTarget?._id || !Number.isFinite(parsed) || parsed === 0) {
      toast.error("Enter a valid non-zero points value");
      return;
    }

    await runAction(async () => {
      const response = await postData(
        "/api/admin/membership-users/add-points",
        {
          membershipUserId: pointsTarget._id,
          points: parsed,
        },
        token,
      );
      if (!response?.success) {
        toast.error(response?.message || "Failed to update points");
        return;
      }
      toast.success("Points updated");
      setPointsDialogOpen(false);
      setPointsTarget(null);
      setPointsValue("");
    });
  };

  return (
    <div className="w-full px-3 sm:px-4 lg:px-5 py-6 space-y-6">
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-6 text-white">
        <div className="flex items-center gap-3 mb-2">
          <RiVipCrownFill className="text-2xl text-amber-300" />
          <h1 className="text-2xl font-bold">Membership Members</h1>
        </div>
        <p className="text-blue-100">
          Manage all users who purchased membership, extension, and points.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <p className="text-sm text-gray-500">Total Members</p>
          <p className="text-2xl font-bold text-gray-900">{stats.totalMembers}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <p className="text-sm text-gray-500">Active Members</p>
          <p className="text-2xl font-bold text-emerald-600">{stats.activeMembers}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <p className="text-sm text-gray-500">Expiring Soon</p>
          <p className="text-2xl font-bold text-amber-600">{stats.expiringSoon}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <p className="text-sm text-gray-500">Expired Members</p>
          <p className="text-2xl font-bold text-red-600">{stats.expiredMembers}</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_300px_130px] lg:items-center">
          <TextField
            label="Search by name or email"
            size="small"
            fullWidth
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
          />
          <TextField
            select
            size="small"
            label="Filter"
            value={filter}
            onChange={(event) => {
              setFilter(event.target.value);
              setPagination((prev) => ({ ...prev, page: 1 }));
            }}
            className="w-full"
          >
            {FILTER_OPTIONS.map((item) => (
              <MenuItem key={item.value} value={item.value}>
                {item.label}
              </MenuItem>
            ))}
          </TextField>
          <Button
            variant="contained"
            className="w-full lg:!h-10"
            onClick={() => {
              setSearch(searchInput.trim());
              setPagination((prev) => ({ ...prev, page: 1 }));
            }}
          >
            Search
          </Button>
        </div>
      </div>

      <MembershipMembersTable
        members={members}
        loading={loading}
        pagination={pagination}
        onPageChange={(nextPage) =>
          setPagination((prev) => ({ ...prev, page: Math.max(nextPage, 1) }))
        }
        onLimitChange={(nextLimit) =>
          setPagination((prev) => ({
            ...prev,
            limit: Math.max(nextLimit, 1),
            page: 1,
          }))
        }
        onView={(member) => fetchMemberDetail(member?._id)}
        onExtend={handleExtend}
        onAddPoints={(member) => {
          setPointsTarget(member);
          setPointsValue("");
          setPointsDialogOpen(true);
        }}
        onRemove={handleCancel}
      />

      <MembershipMemberDrawer
        open={drawerOpen}
        member={selectedMember}
        loading={actionLoading}
        onClose={() => {
          setDrawerOpen(false);
          setSelectedMember(null);
        }}
        onExtend={handleExtend}
        onPointsUpdate={async (member, points) => {
          setPointsTarget(member);
          setPointsValue(String(points));
          setPointsDialogOpen(true);
        }}
        onCancel={handleCancel}
        onReactivate={handleReactivate}
      />

      <Dialog
        open={pointsDialogOpen}
        onClose={() => {
          setPointsDialogOpen(false);
          setPointsTarget(null);
          setPointsValue("");
        }}
      >
        <DialogTitle>Add / Subtract Points</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Points (+/-)"
            type="number"
            fullWidth
            value={pointsValue}
            onChange={(event) => setPointsValue(event.target.value)}
            helperText="Use negative value to subtract points."
          />
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setPointsDialogOpen(false);
              setPointsTarget(null);
              setPointsValue("");
            }}
          >
            Cancel
          </Button>
          <Button onClick={handlePointsApply} variant="contained" disabled={actionLoading}>
            Apply
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
