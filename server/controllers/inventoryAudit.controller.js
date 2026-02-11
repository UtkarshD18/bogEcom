import InventoryAuditModel from "../models/inventoryAudit.model.js";
import { AppError, asyncHandler, sendSuccess } from "../utils/errorHandler.js";
import {
  inventoryAuditQuerySchema,
  inventoryAuditProductParamSchema,
} from "../validation/inventorySchemas.js";

const parseQuery = (req) => {
  const parsed = inventoryAuditQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    throw new AppError("INVALID_INPUT", {
      errors: parsed.error.flatten().fieldErrors,
    });
  }
  return parsed.data;
};

const parseProductParam = (req) => {
  const parsed = inventoryAuditProductParamSchema.safeParse(req.params);
  if (!parsed.success) {
    throw new AppError("INVALID_INPUT", {
      errors: parsed.error.flatten().fieldErrors,
    });
  }
  return parsed.data;
};

export const getInventoryAudit = asyncHandler(async (req, res) => {
  const { page, limit } = parseQuery(req);
  const skip = (page - 1) * limit;

  const [total, audits] = await Promise.all([
    InventoryAuditModel.countDocuments({}),
    InventoryAuditModel.find({})
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
  ]);

  return sendSuccess(
    res,
    {
      items: audits,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    },
    "Inventory audit fetched",
  );
});

export const getInventoryAuditByProduct = asyncHandler(async (req, res) => {
  const { page, limit } = parseQuery(req);
  const { productId } = parseProductParam(req);
  const skip = (page - 1) * limit;

  const filter = { productId };
  const [total, audits] = await Promise.all([
    InventoryAuditModel.countDocuments(filter),
    InventoryAuditModel.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
  ]);

  return sendSuccess(
    res,
    {
      items: audits,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    },
    "Inventory audit fetched",
  );
});
