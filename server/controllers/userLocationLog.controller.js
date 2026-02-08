import UserLocationLogModel from "../models/userLocationLog.model.js";
import {
  asyncHandler,
  sendSuccess,
  validateMongoId,
} from "../utils/errorHandler.js";

/**
 * Admin: get location logs for a specific order.
 * This endpoint is admin-only because it can include raw latitude/longitude.
 */
export const getOrderLocationLogsAdmin = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  validateMongoId(String(orderId || ""), "orderId");

  const includeArchived =
    String(req.query.includeArchived || "").toLowerCase() === "true";

  const filter = { orderId };
  if (!includeArchived) filter.isArchived = false;

  const logs = await UserLocationLogModel.find(filter)
    .sort({ createdAt: -1 })
    .lean();

  return sendSuccess(
    res,
    { logs },
    logs.length ? "Location logs fetched" : "No location logs found",
  );
});

/**
 * Admin: get location logs for a user (paginated).
 * This endpoint is admin-only because it can include raw latitude/longitude.
 */
export const getUserLocationLogsAdmin = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  validateMongoId(String(userId || ""), "userId");

  const includeArchived =
    String(req.query.includeArchived || "").toLowerCase() === "true";

  const page = Math.max(Number(req.query.page || 1), 1);
  const limit = Math.min(Math.max(Number(req.query.limit || 50), 1), 200);
  const skip = (page - 1) * limit;

  const filter = { userId };
  if (!includeArchived) filter.isArchived = false;

  const [logs, total] = await Promise.all([
    UserLocationLogModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    UserLocationLogModel.countDocuments(filter),
  ]);

  return sendSuccess(res, { logs, page, limit, total }, "Location logs fetched");
});

