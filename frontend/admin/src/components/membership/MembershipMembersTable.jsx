"use client";

import MembershipStatusBadge from "@/components/membership/MembershipStatusBadge";
import {
  Avatar,
  IconButton,
  Menu,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  Tooltip,
} from "@mui/material";
import { useMemo, useState } from "react";
import { FiAlertTriangle, FiMoreVertical } from "react-icons/fi";
import { RiVipCrownFill } from "react-icons/ri";

const formatDate = (value) => {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleDateString("en-IN");
};

export default function MembershipMembersTable({
  members = [],
  loading = false,
  pagination = { page: 1, limit: 10, total: 0 },
  onPageChange,
  onLimitChange,
  onView,
  onExtend,
  onAddPoints,
  onRemove,
}) {
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedMember, setSelectedMember] = useState(null);
  const isMenuOpen = Boolean(anchorEl);

  const page = useMemo(() => Math.max(Number(pagination?.page || 1), 1), [pagination]);
  const limit = useMemo(
    () => Math.max(Number(pagination?.limit || 10), 1),
    [pagination],
  );
  const total = useMemo(() => Math.max(Number(pagination?.total || 0), 0), [pagination]);

  const openMenu = (event, member) => {
    setAnchorEl(event.currentTarget);
    setSelectedMember(member);
  };

  const closeMenu = () => {
    setAnchorEl(null);
    setSelectedMember(null);
  };

  return (
    <div className="w-full bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <TableContainer className="w-full min-h-[420px] overflow-x-auto">
        <Table className="w-full">
          <TableHead>
            <TableRow className="bg-gray-50">
              <TableCell>Member</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Start Date</TableCell>
              <TableCell>Expiry Date</TableCell>
              <TableCell>Days Remaining</TableCell>
              <TableCell>Coins</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  align="center"
                  className="py-8 text-sm text-gray-500"
                >
                  Loading members...
                </TableCell>
              </TableRow>
            ) : members.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  align="center"
                  className="py-24 text-sm text-gray-500"
                >
                  No membership users found.
                </TableCell>
              </TableRow>
            ) : (
              members.map((member) => {
                const user = member?.user || {};
                const daysRemaining = Number(member?.daysRemaining || 0);
                const isExpiringSoon =
                  String(member?.status) === "active" &&
                  daysRemaining > 0 &&
                  daysRemaining <= 7;
                return (
                  <TableRow key={member._id} hover>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar src={user.avatar || ""} alt={user.name || "Member"}>
                          {String(user.name || "M").charAt(0).toUpperCase()}
                        </Avatar>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-gray-900">
                              {user.name || "Unknown User"}
                            </span>
                            <RiVipCrownFill className="text-amber-500" />
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{user.email || "--"}</TableCell>
                    <TableCell>
                      <MembershipStatusBadge status={member.status} />
                    </TableCell>
                    <TableCell>{formatDate(member.startDate)}</TableCell>
                    <TableCell>{formatDate(member.expiryDate)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span>
                          {String(member?.status) === "active"
                            ? `${daysRemaining} days`
                            : "--"}
                        </span>
                        {isExpiringSoon && (
                          <Tooltip title="Expiring in 7 days or less">
                            <span>
                              <FiAlertTriangle className="text-amber-500" />
                            </span>
                          </Tooltip>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{Number(member.pointsBalance || 0)}</TableCell>
                    <TableCell align="right">
                      <IconButton size="small" onClick={(event) => openMenu(event, member)}>
                        <FiMoreVertical />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <TablePagination
        rowsPerPageOptions={[10, 25, 50]}
        component="div"
        count={total}
        rowsPerPage={limit}
        page={Math.max(page - 1, 0)}
        onPageChange={(_, nextPage) => onPageChange?.(nextPage + 1)}
        onRowsPerPageChange={(event) =>
          onLimitChange?.(Math.max(Number(event.target.value || 10), 1))
        }
      />

      <Menu anchorEl={anchorEl} open={isMenuOpen} onClose={closeMenu}>
        <MenuItem
          onClick={() => {
            onView?.(selectedMember);
            closeMenu();
          }}
        >
          View
        </MenuItem>
        <MenuItem
          onClick={() => {
            onExtend?.(selectedMember);
            closeMenu();
          }}
        >
          Extend +365 days
        </MenuItem>
        <MenuItem
          onClick={() => {
            onAddPoints?.(selectedMember);
            closeMenu();
          }}
        >
          Add/Subtract Coins
        </MenuItem>
        <MenuItem
          onClick={() => {
            onRemove?.(selectedMember);
            closeMenu();
          }}
          className="!text-red-600"
        >
          Remove
        </MenuItem>
      </Menu>
    </div>
  );
}
