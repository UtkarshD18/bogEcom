import mongoose from "mongoose";
import ProductModel from "../models/product.model.js";
import PurchaseOrderModel from "../models/purchaseOrder.model.js";
import InventoryAuditModel from "../models/inventoryAudit.model.js";
import { AppError, logger } from "../utils/errorHandler.js";

// Atomic inventory updates rely on $inc with $expr guards to avoid race conditions.
const TRACK_INVENTORY_FILTER = {
  $or: [
    { track_inventory: { $ne: false } },
    { trackInventory: { $ne: false } },
    { track_inventory: { $exists: false }, trackInventory: { $exists: false } },
  ],
};

const DEFAULT_RESERVATION_MINUTES = 30;

const getReservationExpiryDate = () => {
  const minutes = Number(process.env.INVENTORY_RESERVATION_MINUTES || DEFAULT_RESERVATION_MINUTES);
  if (!Number.isFinite(minutes) || minutes <= 0) return null;
  return new Date(Date.now() + minutes * 60 * 1000);
};

const toObjectId = (value) => {
  if (!value) return null;
  return mongoose.Types.ObjectId.isValid(value)
    ? new mongoose.Types.ObjectId(value)
    : null;
};

const resolveVariantObjectId = (value) => {
  if (!value) return null;
  const normalized = String(value).trim();
  if (!normalized || normalized === "null" || normalized === "undefined") {
    return null;
  }
  const objectId = toObjectId(normalized);
  if (!objectId) {
    throw new AppError("INVALID_INPUT", { variantId: normalized });
  }
  return objectId;
};

const buildAvailableExpr = () => ({
  $subtract: [
    { $ifNull: ["$stock_quantity", "$stock"] },
    { $ifNull: ["$reserved_quantity", 0] },
  ],
});

const buildVariantAvailableExpr = (variantObjectId) => ({
  $let: {
    vars: {
      variant: {
        $first: {
          $filter: {
            input: "$variants",
            as: "v",
            cond: { $eq: ["$$v._id", variantObjectId] },
          },
        },
      },
    },
    in: {
      $subtract: [
        {
          $ifNull: [
            "$$variant.stock_quantity",
            { $ifNull: ["$$variant.stock", 0] },
          ],
        },
        { $ifNull: ["$$variant.reserved_quantity", 0] },
      ],
    },
  },
});

const buildVariantReservedExpr = (variantObjectId) => ({
  $let: {
    vars: {
      variant: {
        $first: {
          $filter: {
            input: "$variants",
            as: "v",
            cond: { $eq: ["$$v._id", variantObjectId] },
          },
        },
      },
    },
    in: { $ifNull: ["$$variant.reserved_quantity", 0] },
  },
});

const getAvailableFromDoc = (doc) => {
  const stock = Number(doc?.stock_quantity ?? doc?.stock ?? 0);
  const reserved = Number(doc?.reserved_quantity ?? 0);
  return Math.max(stock - reserved, 0);
};

const getAvailableFromVariant = (variant) => {
  const stock = Number(variant?.stock_quantity ?? variant?.stock ?? 0);
  const reserved = Number(variant?.reserved_quantity ?? 0);
  return Math.max(stock - reserved, 0);
};

const isInventoryTracked = (product) => {
  if (!product) return true;
  if (typeof product.track_inventory === "boolean") {
    return product.track_inventory;
  }
  if (typeof product.trackInventory === "boolean") {
    return product.trackInventory;
  }
  return true;
};

const getVariantFromDoc = (product, variantId) => {
  if (!product || !variantId) return null;
  const variants = Array.isArray(product.variants) ? product.variants : [];
  return variants.find((variant) => String(variant?._id) === String(variantId)) || null;
};

const aggregateItems = (items = []) => {
  const map = new Map();
  for (const item of items) {
    const productId = String(item.productId || "");
    if (!productId) continue;
    let variantId = item.variantId || item.variant || item.variant_id || null;
    if (variantId) {
      variantId = String(variantId).trim();
      if (variantId === "null" || variantId === "undefined") {
        variantId = null;
      }
    }
    const quantity = Math.max(Number(item.quantity || 0), 0);
    if (quantity <= 0) continue;
    const key = `${productId}::${variantId || ""}`;
    const prev = map.get(key) || { productId, variantId, quantity: 0 };
    prev.quantity += quantity;
    map.set(key, prev);
  }
  return Array.from(map.values());
};

const getOrderItems = (order) => {
  if (!order) return [];
  const items = Array.isArray(order.products) ? order.products : [];
  return aggregateItems(items);
};

const mapAuditSource = (source = "") => {
  const normalized = String(source).toUpperCase();
  if (normalized.includes("PAYMENT")) return "PAYMENT";
  if (normalized.includes("PO")) return "PO";
  if (normalized.includes("SYSTEM")) return "SYSTEM";
  return "ORDER";
};

const logInventoryAudit = async ({
  productId,
  variantId = null,
  action,
  quantity,
  before,
  after,
  source,
  referenceId,
}) => {
  try {
    await InventoryAuditModel.create({
      productId,
      variantId,
      action,
      quantity,
      before,
      after,
      source,
      referenceId,
    });
  } catch (error) {
    logger.warn("inventoryAudit", "Failed to log inventory audit", {
      productId,
      variantId,
      action,
      error: error?.message,
    });
  }
};

const maybeEmitLowStockAlert = (product, variant = null) => {
  if (!product) return;
  const threshold = Number(
    product.low_stock_threshold ?? product.lowStockThreshold ?? 5,
  );
  if (!Number.isFinite(threshold)) return;
  const available = variant
    ? getAvailableFromVariant(variant)
    : getAvailableFromDoc(product);
  if (available <= threshold) {
    logger.warn("inventoryLowStock", "Low stock threshold reached", {
      productId: product._id,
      variantId: variant?._id || null,
      available,
      threshold,
    });
    // Placeholder: trigger notification/email hooks here.
  }
};

const rollbackReservation = async (items) => {
  for (const item of items) {
    const variantObjectId = toObjectId(item.variantId);
    if (variantObjectId) {
      await ProductModel.updateOne(
        { _id: item.productId },
        { $inc: { "variants.$[v].reserved_quantity": -item.quantity } },
        { arrayFilters: [{ "v._id": variantObjectId }] },
      );
    } else {
      await ProductModel.updateOne(
        { _id: item.productId },
        { $inc: { reserved_quantity: -item.quantity } },
      );
    }
  }
};

const rollbackDeduction = async (items) => {
  for (const item of items) {
    const variantObjectId = toObjectId(item.variantId);
    if (variantObjectId) {
      const update = item.deductReserved
        ? {
            $inc: {
              "variants.$[v].stock_quantity": item.quantity,
              "variants.$[v].stock": item.quantity,
              "variants.$[v].reserved_quantity": item.quantity,
            },
          }
        : {
            $inc: {
              "variants.$[v].stock_quantity": item.quantity,
              "variants.$[v].stock": item.quantity,
            },
          };
      await ProductModel.updateOne(
        { _id: item.productId },
        update,
        { arrayFilters: [{ "v._id": variantObjectId }] },
      );
    } else {
      const update = item.deductReserved
        ? {
            $inc: {
              stock_quantity: item.quantity,
              stock: item.quantity,
              reserved_quantity: item.quantity,
            },
          }
        : {
            $inc: {
              stock_quantity: item.quantity,
              stock: item.quantity,
            },
          };
      await ProductModel.updateOne({ _id: item.productId }, update);
    }
  }
};

const rollbackRelease = async (items) => {
  for (const item of items) {
    const variantObjectId = toObjectId(item.variantId);
    if (variantObjectId) {
      await ProductModel.updateOne(
        { _id: item.productId },
        { $inc: { "variants.$[v].reserved_quantity": item.quantity } },
        { arrayFilters: [{ "v._id": variantObjectId }] },
      );
    } else {
      await ProductModel.updateOne(
        { _id: item.productId },
        { $inc: { reserved_quantity: item.quantity } },
      );
    }
  }
};

const rollbackRestore = async (items) => {
  for (const item of items) {
    const variantObjectId = toObjectId(item.variantId);
    if (variantObjectId) {
      await ProductModel.updateOne(
        { _id: item.productId },
        {
          $inc: {
            "variants.$[v].stock_quantity": -item.quantity,
            "variants.$[v].stock": -item.quantity,
          },
        },
        { arrayFilters: [{ "v._id": variantObjectId }] },
      );
    } else {
      await ProductModel.updateOne(
        { _id: item.productId },
        {
          $inc: {
            stock_quantity: -item.quantity,
            stock: -item.quantity,
          },
        },
      );
    }
  }
};

export const reserveInventory = async (order, source = "ORDER_CREATE") => {
  if (!order) return { status: "noop", reason: "missing_order" };
  if (order.inventoryStatus === "reserved") {
    return { status: "noop", reason: "already_reserved" };
  }
  if (order.inventoryStatus === "deducted") {
    return { status: "noop", reason: "already_deducted" };
  }

  const items = getOrderItems(order);
  if (items.length === 0) {
    return { status: "noop", reason: "no_items" };
  }

  const applied = [];
  try {
    for (const item of items) {
      const variantObjectId = resolveVariantObjectId(item.variantId);
      const productBefore = await ProductModel.findById(item.productId)
        .select(
          "track_inventory trackInventory stock stock_quantity reserved_quantity low_stock_threshold variants",
        )
        .lean();

      if (!productBefore) {
        throw new AppError("PRODUCT_NOT_FOUND", { productId: item.productId });
      }
      if (!isInventoryTracked(productBefore)) {
        continue;
      }

      if (variantObjectId) {
        const filter = {
          _id: item.productId,
          ...TRACK_INVENTORY_FILTER,
          "variants._id": variantObjectId,
          $expr: { $gte: [buildVariantAvailableExpr(variantObjectId), item.quantity] },
        };
        const result = await ProductModel.updateOne(
          filter,
          { $inc: { "variants.$[v].reserved_quantity": item.quantity } },
          { arrayFilters: [{ "v._id": variantObjectId }] },
        );
        if (result.modifiedCount !== 1) {
          const variant = getVariantFromDoc(productBefore, variantObjectId);
          if (!variant) {
            throw new AppError("INVALID_INPUT", { variantId: item.variantId });
          }
          throw new AppError("INSUFFICIENT_STOCK", {
            productId: item.productId,
            variantId: item.variantId,
            requested: item.quantity,
            available: getAvailableFromVariant(variant),
          });
        }
      } else {
        const filter = {
          _id: item.productId,
          ...TRACK_INVENTORY_FILTER,
          $expr: { $gte: [buildAvailableExpr(), item.quantity] },
        };
        const result = await ProductModel.updateOne(filter, {
          $inc: { reserved_quantity: item.quantity },
        });

        if (result.modifiedCount !== 1) {
          throw new AppError("INSUFFICIENT_STOCK", {
            productId: item.productId,
            requested: item.quantity,
            available: getAvailableFromDoc(productBefore),
          });
        }
      }

      const productAfter = await ProductModel.findById(item.productId)
        .select(
          "stock stock_quantity reserved_quantity low_stock_threshold variants",
        )
        .lean();

      const auditBefore = variantObjectId
        ? getVariantFromDoc(productBefore, variantObjectId) || {}
        : productBefore;
      const auditAfter = variantObjectId
        ? getVariantFromDoc(productAfter, variantObjectId) || {}
        : productAfter;

      await logInventoryAudit({
        productId: item.productId,
        variantId: variantObjectId,
        action: "RESERVE",
        quantity: item.quantity,
        before: {
          stock_quantity: Number(auditBefore?.stock_quantity ?? auditBefore?.stock ?? 0),
          reserved_quantity: Number(auditBefore?.reserved_quantity ?? 0),
        },
        after: {
          stock_quantity: Number(auditAfter?.stock_quantity ?? auditAfter?.stock ?? 0),
          reserved_quantity: Number(auditAfter?.reserved_quantity ?? 0),
        },
        source: mapAuditSource(source),
        referenceId: String(order._id || ""),
      });

      maybeEmitLowStockAlert(productAfter, variantObjectId ? auditAfter : null);

      applied.push(item);
    }

    order.inventoryStatus = "reserved";
    order.inventoryUpdatedAt = new Date();
    order.inventorySource = source;
    if (!order.reservationExpiresAt && order.payment_status !== "paid") {
      order.reservationExpiresAt = getReservationExpiryDate();
    }
    return { status: "reserved" };
  } catch (error) {
    if (applied.length > 0) {
      await rollbackReservation(applied);
    }
    throw error;
  }
};

export const confirmInventory = async (order, source = "PAYMENT_SUCCESS") => {
  if (!order) return { status: "noop", reason: "missing_order" };
  if (order.inventoryStatus === "deducted") {
    return { status: "noop", reason: "already_deducted" };
  }

  const items = getOrderItems(order);
  if (items.length === 0) {
    return { status: "noop", reason: "no_items" };
  }

  const applied = [];
  try {
    for (const item of items) {
      const variantObjectId = resolveVariantObjectId(item.variantId);
      const productBefore = await ProductModel.findById(item.productId)
        .select(
          "track_inventory trackInventory stock stock_quantity reserved_quantity low_stock_threshold variants",
        )
        .lean();
      if (!productBefore) {
        throw new AppError("PRODUCT_NOT_FOUND", { productId: item.productId });
      }
      if (!isInventoryTracked(productBefore)) {
        continue;
      }

      const deductReserved = order.inventoryStatus === "reserved";

      if (variantObjectId) {
        const filter = deductReserved
          ? {
              _id: item.productId,
              ...TRACK_INVENTORY_FILTER,
              "variants._id": variantObjectId,
              $expr: { $gte: [buildVariantReservedExpr(variantObjectId), item.quantity] },
            }
          : {
              _id: item.productId,
              ...TRACK_INVENTORY_FILTER,
              "variants._id": variantObjectId,
              $expr: { $gte: [buildVariantAvailableExpr(variantObjectId), item.quantity] },
            };

        const update = deductReserved
          ? {
              $inc: {
                "variants.$[v].stock_quantity": -item.quantity,
                "variants.$[v].stock": -item.quantity,
                "variants.$[v].reserved_quantity": -item.quantity,
              },
            }
          : {
              $inc: {
                "variants.$[v].stock_quantity": -item.quantity,
                "variants.$[v].stock": -item.quantity,
              },
            };

        const result = await ProductModel.updateOne(filter, update, {
          arrayFilters: [{ "v._id": variantObjectId }],
        });
        if (result.modifiedCount !== 1) {
          const variant = getVariantFromDoc(productBefore, variantObjectId);
          if (!variant) {
            throw new AppError("INVALID_INPUT", { variantId: item.variantId });
          }
          const available = deductReserved
            ? Number(variant?.reserved_quantity ?? 0)
            : getAvailableFromVariant(variant);
          throw new AppError("INSUFFICIENT_STOCK", {
            productId: item.productId,
            variantId: item.variantId,
            requested: item.quantity,
            available,
          });
        }
      } else {
        const filter = deductReserved
          ? {
              _id: item.productId,
              ...TRACK_INVENTORY_FILTER,
              reserved_quantity: { $gte: item.quantity },
            }
          : {
              _id: item.productId,
              ...TRACK_INVENTORY_FILTER,
              $expr: { $gte: [buildAvailableExpr(), item.quantity] },
            };
        const update = deductReserved
          ? {
              $inc: {
                stock_quantity: -item.quantity,
                stock: -item.quantity,
                reserved_quantity: -item.quantity,
              },
            }
          : {
              $inc: {
                stock_quantity: -item.quantity,
                stock: -item.quantity,
              },
            };
        const result = await ProductModel.updateOne(filter, update);
        if (result.modifiedCount !== 1) {
          const available = deductReserved
            ? Number(productBefore?.reserved_quantity ?? 0)
            : getAvailableFromDoc(productBefore);
          throw new AppError("INSUFFICIENT_STOCK", {
            productId: item.productId,
            requested: item.quantity,
            available,
          });
        }
      }

      const productAfter = await ProductModel.findById(item.productId)
        .select(
          "stock stock_quantity reserved_quantity low_stock_threshold variants",
        )
        .lean();

      const auditBefore = variantObjectId
        ? getVariantFromDoc(productBefore, variantObjectId) || {}
        : productBefore;
      const auditAfter = variantObjectId
        ? getVariantFromDoc(productAfter, variantObjectId) || {}
        : productAfter;

      await logInventoryAudit({
        productId: item.productId,
        variantId: variantObjectId,
        action: "CONFIRM",
        quantity: item.quantity,
        before: {
          stock_quantity: Number(auditBefore?.stock_quantity ?? auditBefore?.stock ?? 0),
          reserved_quantity: Number(auditBefore?.reserved_quantity ?? 0),
        },
        after: {
          stock_quantity: Number(auditAfter?.stock_quantity ?? auditAfter?.stock ?? 0),
          reserved_quantity: Number(auditAfter?.reserved_quantity ?? 0),
        },
        source: mapAuditSource(source),
        referenceId: String(order._id || ""),
      });

      maybeEmitLowStockAlert(productAfter, variantObjectId ? auditAfter : null);

      applied.push({ ...item, deductReserved });
    }

    order.inventoryStatus = "deducted";
    order.inventoryUpdatedAt = new Date();
    order.inventorySource = source;
    order.reservationExpiresAt = null;
    return { status: "deducted" };
  } catch (error) {
    if (applied.length > 0) {
      await rollbackDeduction(applied);
    }
    throw error;
  }
};

export const releaseInventory = async (order, source = "PAYMENT_FAILURE") => {
  if (!order) return { status: "noop", reason: "missing_order" };
  if (order.inventoryStatus !== "reserved") {
    return { status: "noop", reason: "not_reserved" };
  }

  const items = getOrderItems(order);
  if (items.length === 0) {
    return { status: "noop", reason: "no_items" };
  }

  const applied = [];
  try {
    for (const item of items) {
      const variantObjectId = resolveVariantObjectId(item.variantId);
      const productBefore = await ProductModel.findById(item.productId)
        .select(
          "track_inventory trackInventory stock stock_quantity reserved_quantity low_stock_threshold variants",
        )
        .lean();
      if (!productBefore) {
        throw new AppError("PRODUCT_NOT_FOUND", { productId: item.productId });
      }
      if (!isInventoryTracked(productBefore)) {
        continue;
      }

      if (variantObjectId) {
        const filter = {
          _id: item.productId,
          ...TRACK_INVENTORY_FILTER,
          "variants._id": variantObjectId,
          $expr: { $gte: [buildVariantReservedExpr(variantObjectId), item.quantity] },
        };
        const result = await ProductModel.updateOne(
          filter,
          { $inc: { "variants.$[v].reserved_quantity": -item.quantity } },
          { arrayFilters: [{ "v._id": variantObjectId }] },
        );
        if (result.modifiedCount !== 1) {
          const variant = getVariantFromDoc(productBefore, variantObjectId);
          if (!variant) {
            throw new AppError("INVALID_INPUT", { variantId: item.variantId });
          }
          throw new AppError("INSUFFICIENT_STOCK", {
            productId: item.productId,
            variantId: item.variantId,
            requested: item.quantity,
            available: Number(variant?.reserved_quantity ?? 0),
          });
        }
      } else {
        const filter = {
          _id: item.productId,
          ...TRACK_INVENTORY_FILTER,
          reserved_quantity: { $gte: item.quantity },
        };
        const result = await ProductModel.updateOne(filter, {
          $inc: { reserved_quantity: -item.quantity },
        });
        if (result.modifiedCount !== 1) {
          throw new AppError("INSUFFICIENT_STOCK", {
            productId: item.productId,
            requested: item.quantity,
            available: Number(productBefore?.reserved_quantity ?? 0),
          });
        }
      }

      const productAfter = await ProductModel.findById(item.productId)
        .select(
          "stock stock_quantity reserved_quantity low_stock_threshold variants",
        )
        .lean();

      const auditBefore = variantObjectId
        ? getVariantFromDoc(productBefore, variantObjectId) || {}
        : productBefore;
      const auditAfter = variantObjectId
        ? getVariantFromDoc(productAfter, variantObjectId) || {}
        : productAfter;

      await logInventoryAudit({
        productId: item.productId,
        variantId: variantObjectId,
        action: "RELEASE",
        quantity: item.quantity,
        before: {
          stock_quantity: Number(auditBefore?.stock_quantity ?? auditBefore?.stock ?? 0),
          reserved_quantity: Number(auditBefore?.reserved_quantity ?? 0),
        },
        after: {
          stock_quantity: Number(auditAfter?.stock_quantity ?? auditAfter?.stock ?? 0),
          reserved_quantity: Number(auditAfter?.reserved_quantity ?? 0),
        },
        source: mapAuditSource(source),
        referenceId: String(order._id || ""),
      });

      applied.push(item);
    }

    order.inventoryStatus = "released";
    order.inventoryUpdatedAt = new Date();
    order.inventorySource = source;
    order.reservationExpiresAt = null;
    return { status: "released" };
  } catch (error) {
    if (applied.length > 0) {
      await rollbackRelease(applied);
    }
    throw error;
  }
};

export const restoreInventory = async (order, source = "ORDER_CANCELLED") => {
  if (!order) return { status: "noop", reason: "missing_order" };
  if (order.inventoryStatus !== "deducted") {
    return { status: "noop", reason: "not_deducted" };
  }

  const items = getOrderItems(order);
  if (items.length === 0) {
    return { status: "noop", reason: "no_items" };
  }

  const applied = [];
  try {
    for (const item of items) {
      const variantObjectId = resolveVariantObjectId(item.variantId);
      const productBefore = await ProductModel.findById(item.productId)
        .select(
          "track_inventory trackInventory stock stock_quantity reserved_quantity low_stock_threshold variants",
        )
        .lean();
      if (!productBefore) {
        throw new AppError("PRODUCT_NOT_FOUND", { productId: item.productId });
      }
      if (!isInventoryTracked(productBefore)) {
        continue;
      }

      if (variantObjectId) {
        const result = await ProductModel.updateOne(
          { _id: item.productId, ...TRACK_INVENTORY_FILTER },
          {
            $inc: {
              "variants.$[v].stock_quantity": item.quantity,
              "variants.$[v].stock": item.quantity,
            },
          },
          { arrayFilters: [{ "v._id": variantObjectId }] },
        );
        if (result.modifiedCount !== 1) {
          throw new AppError("INTERNAL_ERROR");
        }
      } else {
        const result = await ProductModel.updateOne(
          { _id: item.productId, ...TRACK_INVENTORY_FILTER },
          {
            $inc: { stock_quantity: item.quantity, stock: item.quantity },
          },
        );
        if (result.modifiedCount !== 1) {
          throw new AppError("INTERNAL_ERROR");
        }
      }

      const productAfter = await ProductModel.findById(item.productId)
        .select(
          "stock stock_quantity reserved_quantity low_stock_threshold variants",
        )
        .lean();

      const auditBefore = variantObjectId
        ? getVariantFromDoc(productBefore, variantObjectId) || {}
        : productBefore;
      const auditAfter = variantObjectId
        ? getVariantFromDoc(productAfter, variantObjectId) || {}
        : productAfter;

      await logInventoryAudit({
        productId: item.productId,
        variantId: variantObjectId,
        action: "RESTORE",
        quantity: item.quantity,
        before: {
          stock_quantity: Number(auditBefore?.stock_quantity ?? auditBefore?.stock ?? 0),
          reserved_quantity: Number(auditBefore?.reserved_quantity ?? 0),
        },
        after: {
          stock_quantity: Number(auditAfter?.stock_quantity ?? auditAfter?.stock ?? 0),
          reserved_quantity: Number(auditAfter?.reserved_quantity ?? 0),
        },
        source: mapAuditSource(source),
        referenceId: String(order._id || ""),
      });

      applied.push(item);
    }

    order.inventoryStatus = "restored";
    order.inventoryUpdatedAt = new Date();
    order.inventorySource = source;
    order.reservationExpiresAt = null;
    return { status: "restored" };
  } catch (error) {
    if (applied.length > 0) {
      await rollbackRestore(applied);
    }
    throw error;
  }
};

export const applyPurchaseOrderInventory = async (
  poOrId,
  { receivedItems = [], adminId = null } = {},
) => {
  const po =
    typeof poOrId === "string"
      ? await PurchaseOrderModel.findById(poOrId)
      : poOrId;
  if (!po) {
    throw new AppError("NOT_FOUND", { message: "Purchase order not found" });
  }

  if (po.inventory_applied) {
    return { status: "noop", reason: "already_applied", purchaseOrder: po };
  }

  const receivedMap = new Map(
    receivedItems.map((item) => [
      String(item.productId || ""),
      Number(item.qty_received ?? item.quantity ?? 0),
    ]),
  );

  const applied = [];
  try {
    for (const item of po.items) {
      const productId = String(item.productId || "");
      if (!productId) continue;
      const qty =
        receivedMap.has(productId) && Number.isFinite(receivedMap.get(productId))
          ? Math.max(receivedMap.get(productId), 0)
          : Math.max(Number(item.qty_received ?? item.quantity ?? 0), 0);

      if (qty <= 0) continue;

      const productBefore = await ProductModel.findById(productId)
        .select(
          "track_inventory trackInventory stock stock_quantity reserved_quantity low_stock_threshold variants",
        )
        .lean();
      if (!productBefore) {
        throw new AppError("PRODUCT_NOT_FOUND", { productId });
      }
      if (!isInventoryTracked(productBefore)) {
        continue;
      }

      const result = await ProductModel.updateOne(
        { _id: productId, ...TRACK_INVENTORY_FILTER },
        { $inc: { stock_quantity: qty, stock: qty } },
      );

      if (result.modifiedCount !== 1) {
        throw new AppError("INTERNAL_ERROR");
      }

      const productAfter = await ProductModel.findById(productId)
        .select(
          "stock stock_quantity reserved_quantity low_stock_threshold variants",
        )
        .lean();

      await logInventoryAudit({
        productId,
        action: "PO_RECEIVE",
        quantity: qty,
        before: {
          stock_quantity: Number(productBefore?.stock_quantity ?? productBefore?.stock ?? 0),
          reserved_quantity: Number(productBefore?.reserved_quantity ?? 0),
        },
        after: {
          stock_quantity: Number(productAfter?.stock_quantity ?? productAfter?.stock ?? 0),
          reserved_quantity: Number(productAfter?.reserved_quantity ?? 0),
        },
        source: "PO",
        referenceId: String(po._id || ""),
      });

      item.qty_received = qty;
      applied.push({ productId, quantity: qty });
    }

    po.status = "received";
    po.inventory_applied = true;
    po.receivedAt = new Date();
    if (adminId) {
      po.receivedBy = adminId;
    }
    await po.save();

    logger.info("applyPurchaseOrderInventory", "Inventory updated from PO", {
      purchaseOrderId: po._id,
      itemCount: applied.length,
    });

    return { status: "applied", purchaseOrder: po };
  } catch (error) {
    if (applied.length > 0) {
      for (const item of applied) {
        await ProductModel.updateOne(
          { _id: item.productId },
          { $inc: { stock_quantity: -item.quantity, stock: -item.quantity } },
        );
      }
    }
    throw error;
  }
};
