"use client";

import MembershipStatusBadge from "@/components/membership/MembershipStatusBadge";
import { Button, Drawer, TextField } from "@mui/material";
import { useMemo, useState } from "react";
import { FiAlertTriangle } from "react-icons/fi";

const formatDate = (value) => {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleDateString("en-IN");
};

const getProgress = (startDate, expiryDate, daysRemaining) => {
  const start = new Date(startDate || new Date());
  const expiry = new Date(expiryDate || new Date());
  const totalDays = Math.max(
    Math.ceil((expiry.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)),
    1,
  );
  return Math.max(Math.min((Number(daysRemaining || 0) / totalDays) * 100, 100), 0);
};

export default function MembershipMemberDrawer({
  open,
  member,
  loading = false,
  onClose,
  onExtend,
  onPointsUpdate,
  onCancel,
  onReactivate,
}) {
  const [pointsDelta, setPointsDelta] = useState("");
  const user = member?.user || {};
  const daysRemaining = Number(member?.daysRemaining || 0);
  const isExpiringSoon =
    String(member?.status) === "active" && daysRemaining > 0 && daysRemaining <= 7;
  const progress = useMemo(
    () => getProgress(member?.startDate, member?.expiryDate, daysRemaining),
    [member?.startDate, member?.expiryDate, daysRemaining],
  );

  return (
    <Drawer anchor="right" open={open} onClose={onClose}>
      <div className="w-[380px] max-w-[92vw] h-full bg-white p-5 overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">Member Details</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-gray-500 hover:text-gray-800"
          >
            Close
          </button>
        </div>

        {!member ? (
          <div className="text-sm text-gray-500">Select a member to view details.</div>
        ) : (
          <div className="space-y-5">
            <div className="rounded-xl border border-gray-200 p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">User Info</h3>
              <div className="space-y-2 text-sm">
                <p>
                  <span className="text-gray-500">Name:</span>{" "}
                  <span className="font-medium text-gray-900">{user.name || "--"}</span>
                </p>
                <p>
                  <span className="text-gray-500">Email:</span>{" "}
                  <span className="font-medium text-gray-900">{user.email || "--"}</span>
                </p>
                <p>
                  <span className="text-gray-500">Join date:</span>{" "}
                  <span className="font-medium text-gray-900">
                    {formatDate(user.createdAt)}
                  </span>
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">
                Membership Info
              </h3>
              <div className="space-y-2 text-sm mb-4">
                <p>
                  <span className="text-gray-500">Status:</span>{" "}
                  <MembershipStatusBadge status={member.status} />
                </p>
                <p>
                  <span className="text-gray-500">Start date:</span>{" "}
                  <span className="font-medium text-gray-900">
                    {formatDate(member.startDate)}
                  </span>
                </p>
                <p>
                  <span className="text-gray-500">Expiry date:</span>{" "}
                  <span className="font-medium text-gray-900">
                    {formatDate(member.expiryDate)}
                  </span>
                </p>
                <p className="flex items-center gap-2">
                  <span className="text-gray-500">Days left:</span>{" "}
                  <span className="font-medium text-gray-900">{daysRemaining}</span>
                  {isExpiringSoon && <FiAlertTriangle className="text-amber-500" />}
                </p>
                <p>
                  <span className="text-gray-500">Coins:</span>{" "}
                  <span className="font-medium text-gray-900">
                    {Number(member.pointsBalance || 0)}
                  </span>
                </p>
              </div>

              <div className="mb-1 flex items-center justify-between text-xs text-gray-500">
                <span>Days remaining</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <div className="h-2 rounded-full bg-gray-100">
                <div
                  className="h-2 rounded-full bg-gradient-to-r from-amber-400 to-emerald-500 transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Admin Actions</h3>
              <div className="space-y-3">
                <Button
                  fullWidth
                  variant="contained"
                  onClick={() => onExtend?.(member)}
                  disabled={loading}
                >
                  Extend Membership (+365 days)
                </Button>

                <div className="flex gap-2">
                  <TextField
                    label="Coins (+/-)"
                    size="small"
                    fullWidth
                    value={pointsDelta}
                    onChange={(event) => setPointsDelta(event.target.value)}
                    inputProps={{ step: 1 }}
                  />
                  <Button
                    variant="outlined"
                    disabled={loading || !String(pointsDelta).trim()}
                    onClick={() => {
                      const parsed = Number(pointsDelta);
                      if (
                        !Number.isFinite(parsed) ||
                        parsed === 0 ||
                        !Number.isInteger(parsed)
                      ) {
                        return;
                      }
                      onPointsUpdate?.(member, parsed);
                      setPointsDelta("");
                    }}
                  >
                    Apply
                  </Button>
                </div>

                <Button
                  fullWidth
                  variant="outlined"
                  color="error"
                  disabled={loading}
                  onClick={() => onCancel?.(member)}
                >
                  Cancel Membership
                </Button>
                <Button
                  fullWidth
                  variant="outlined"
                  color="success"
                  disabled={loading}
                  onClick={() => onReactivate?.(member)}
                >
                  Reactivate Membership
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Drawer>
  );
}
