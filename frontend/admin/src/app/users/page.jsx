"use client";
import { useAdmin } from "@/context/AdminContext";
import { deleteData, getData, putData } from "@/utils/api";
import {
  Avatar,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  Tooltip,
} from "@mui/material";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  FiSearch,
  FiShield,
  FiTrash2,
  FiUser,
  FiUserCheck,
  FiUserX,
} from "react-icons/fi";
import { MdOutlineAdminPanelSettings } from "react-icons/md";

export default function UserManagement() {
  const { token, isAuthenticated, loading } = useAdmin();
  const router = useRouter();

  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState({
    page: 0,
    limit: 10,
    total: 0,
  });
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState(""); // "role", "status", "delete"
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, loading, router]);

  useEffect(() => {
    if (isAuthenticated && token) {
      fetchUsers();
    }
  }, [isAuthenticated, token, pagination.page, pagination.limit, roleFilter]);

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page + 1,
        limit: pagination.limit,
        search,
        role: roleFilter,
      });

      const response = await getData(`/api/user/admin/users?${params}`, token);

      if (response.success) {
        setUsers(response.data);
        setPagination((prev) => ({
          ...prev,
          total: response.pagination.total,
        }));
      }
    } catch (error) {
      console.error("Failed to fetch users:", error);
    }
    setIsLoading(false);
  };

  const handleSearch = (e) => {
    e.preventDefault();
    fetchUsers();
  };

  const handleChangePage = (event, newPage) => {
    setPagination((prev) => ({ ...prev, page: newPage }));
  };

  const handleChangeRowsPerPage = (event) => {
    setPagination((prev) => ({
      ...prev,
      limit: parseInt(event.target.value, 10),
      page: 0,
    }));
  };

  const openDialog = (user, type) => {
    setSelectedUser(user);
    setDialogType(type);
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setSelectedUser(null);
    setDialogType("");
    setDialogOpen(false);
  };

  const handleRoleChange = async (newRole) => {
    if (!selectedUser) return;
    setActionLoading(true);

    try {
      const response = await putData(
        `/api/user/admin/users/${selectedUser._id}/role`,
        { role: newRole },
        token,
      );

      if (response.success) {
        fetchUsers();
        closeDialog();
      } else {
        alert(response.message || "Failed to update role");
      }
    } catch (error) {
      console.error("Failed to update role:", error);
      alert("Failed to update role");
    }

    setActionLoading(false);
  };

  const handleStatusChange = async (newStatus) => {
    if (!selectedUser) return;
    setActionLoading(true);

    try {
      const response = await putData(
        `/api/user/admin/users/${selectedUser._id}/status`,
        { status: newStatus },
        token,
      );

      if (response.success) {
        fetchUsers();
        closeDialog();
      } else {
        alert(response.message || "Failed to update status");
      }
    } catch (error) {
      console.error("Failed to update status:", error);
      alert("Failed to update status");
    }

    setActionLoading(false);
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;
    setActionLoading(true);

    try {
      const response = await deleteData(
        `/api/user/admin/users/${selectedUser._id}`,
        token,
      );

      if (response.success) {
        fetchUsers();
        closeDialog();
      } else {
        alert(response.message || "Failed to delete user");
      }
    } catch (error) {
      console.error("Failed to delete user:", error);
      alert("Failed to delete user");
    }

    setActionLoading(false);
  };

  const getRoleChip = (role) => {
    if (role === "Admin") {
      return (
        <Chip
          icon={<MdOutlineAdminPanelSettings />}
          label="Admin"
          color="primary"
          size="small"
        />
      );
    }
    return <Chip icon={<FiUser />} label="User" color="default" size="small" />;
  };

  const getStatusChip = (status) => {
    const colors = {
      active: "success",
      inactive: "warning",
      Suspended: "error",
    };
    return (
      <Chip label={status} color={colors[status] || "default"} size="small" />
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">
          User Management
        </h1>
        <p className="text-gray-600">Manage user roles and permissions</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
        <form
          onSubmit={handleSearch}
          className="flex flex-wrap gap-4 items-end"
        >
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Search
            </label>
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or email..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
              />
            </div>
          </div>

          <div className="w-[150px]">
            <FormControl fullWidth size="small">
              <InputLabel>Role</InputLabel>
              <Select
                value={roleFilter}
                label="Role"
                onChange={(e) => setRoleFilter(e.target.value)}
              >
                <MenuItem value="">All</MenuItem>
                <MenuItem value="User">User</MenuItem>
                <MenuItem value="Admin">Admin</MenuItem>
              </Select>
            </FormControl>
          </div>

          <Button type="submit" variant="contained" color="primary">
            Search
          </Button>
        </form>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow className="bg-gray-50">
                <TableCell>User</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Role</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Provider</TableCell>
                <TableCell>Joined</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" className="py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600 mx-auto"></div>
                  </TableCell>
                </TableRow>
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    align="center"
                    className="py-8 text-gray-500"
                  >
                    No users found
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user) => (
                  <TableRow key={user._id} hover>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar src={user.avatar} alt={user.name}>
                          {user.name?.[0]?.toUpperCase()}
                        </Avatar>
                        <span className="font-medium">{user.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>{getRoleChip(user.role)}</TableCell>
                    <TableCell>{getStatusChip(user.status)}</TableCell>
                    <TableCell>
                      <Chip
                        label={user.provider || "email"}
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      {new Date(user.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell align="right">
                      <div className="flex justify-end gap-1">
                        <Tooltip
                          title={
                            user.role === "Admin"
                              ? "Demote to User"
                              : "Promote to Admin"
                          }
                        >
                          <IconButton
                            size="small"
                            color={
                              user.role === "Admin" ? "warning" : "primary"
                            }
                            onClick={() => openDialog(user, "role")}
                          >
                            {user.role === "Admin" ? <FiUserX /> : <FiShield />}
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Change Status">
                          <IconButton
                            size="small"
                            color={
                              user.status === "active" ? "success" : "warning"
                            }
                            onClick={() => openDialog(user, "status")}
                          >
                            <FiUserCheck />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete User">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => openDialog(user, "delete")}
                          >
                            <FiTrash2 />
                          </IconButton>
                        </Tooltip>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          rowsPerPageOptions={[5, 10, 25]}
          component="div"
          count={pagination.total}
          rowsPerPage={pagination.limit}
          page={pagination.page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </div>

      {/* Role Change Dialog */}
      <Dialog open={dialogOpen && dialogType === "role"} onClose={closeDialog}>
        <DialogTitle>Change User Role</DialogTitle>
        <DialogContent>
          <p className="mb-4">
            Change role for <strong>{selectedUser?.name}</strong> (
            {selectedUser?.email})?
          </p>
          <p className="text-sm text-gray-600">
            Current role: <strong>{selectedUser?.role}</strong>
          </p>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog} disabled={actionLoading}>
            Cancel
          </Button>
          <Button
            onClick={() =>
              handleRoleChange(
                selectedUser?.role === "Admin" ? "User" : "Admin",
              )
            }
            variant="contained"
            color={selectedUser?.role === "Admin" ? "warning" : "primary"}
            disabled={actionLoading}
          >
            {actionLoading
              ? "Updating..."
              : selectedUser?.role === "Admin"
                ? "Demote to User"
                : "Promote to Admin"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Status Change Dialog */}
      <Dialog
        open={dialogOpen && dialogType === "status"}
        onClose={closeDialog}
      >
        <DialogTitle>Change User Status</DialogTitle>
        <DialogContent>
          <p className="mb-4">
            Change status for <strong>{selectedUser?.name}</strong>?
          </p>
          <FormControl fullWidth className="mt-4">
            <InputLabel>New Status</InputLabel>
            <Select
              defaultValue={selectedUser?.status || "active"}
              label="New Status"
              onChange={(e) => handleStatusChange(e.target.value)}
              disabled={actionLoading}
            >
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="inactive">Inactive</MenuItem>
              <MenuItem value="Suspended">Suspended</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog} disabled={actionLoading}>
            Cancel
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={dialogOpen && dialogType === "delete"}
        onClose={closeDialog}
      >
        <DialogTitle>Delete User</DialogTitle>
        <DialogContent>
          <p>
            Are you sure you want to delete{" "}
            <strong>{selectedUser?.name}</strong>?
          </p>
          <p className="text-sm text-red-600 mt-2">
            This action cannot be undone.
          </p>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog} disabled={actionLoading}>
            Cancel
          </Button>
          <Button
            onClick={handleDeleteUser}
            variant="contained"
            color="error"
            disabled={actionLoading}
          >
            {actionLoading ? "Deleting..." : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
