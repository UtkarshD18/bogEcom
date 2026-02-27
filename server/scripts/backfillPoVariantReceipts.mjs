import mongoose from "mongoose";
import connectDb from "../config/connectDb.js";
import InventoryAuditModel from "../models/inventoryAudit.model.js";
import ProductModel from "../models/product.model.js";
import PurchaseOrderModel from "../models/purchaseOrder.model.js";

const shouldApply = process.argv.includes("--apply");
const poArg = process.argv.find((arg) => String(arg || "").startsWith("--po="));
const targetPoNumber = poArg ? String(poArg).split("=")[1] : "";

const normalizeUnitForPacking = (unit) => {
  const normalized = String(unit || "")
    .trim()
    .toLowerCase();
  if (!normalized) return "";
  if (["g", "gm", "gram", "grams"].includes(normalized)) return "g";
  if (["kg", "kgs", "kilogram", "kilograms"].includes(normalized)) return "kg";
  if (
    ["ml", "millilitre", "milliliter", "millilitres", "milliliters"].includes(
      normalized,
    )
  ) {
    return "ml";
  }
  if (["l", "lt", "ltr", "liter", "litre", "liters", "litres"].includes(normalized)) {
    return "l";
  }
  return normalized;
};

const normalizePackingKey = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/(\d)\.0+(?=[a-z]|$)/g, "$1");

const buildPackingFromWeightAndUnit = (weightValue, unitValue) => {
  const weight = Number(weightValue || 0);
  if (!Number.isFinite(weight) || weight <= 0) return "";
  const unit = normalizeUnitForPacking(unitValue);
  if (unit === "g") return weight >= 1000 ? `${weight / 1000}kg` : `${weight}g`;
  if (unit === "kg") return `${weight}kg`;
  if (unit === "ml" || unit === "l") return `${weight}${unit}`;
  return `${weight}${unit || ""}`;
};

const resolveVariantForPacking = ({
  product,
  variantId = "",
  variantName = "",
  packing = "",
}) => {
  const variants = Array.isArray(product?.variants) ? product.variants : [];
  if (variants.length === 0) return null;

  const normalizedVariantId = String(variantId || "").trim();
  if (normalizedVariantId && mongoose.Types.ObjectId.isValid(normalizedVariantId)) {
    const byId = variants.find(
      (variant) => String(variant?._id || "") === normalizedVariantId,
    );
    if (byId) return byId;
  }

  const candidateKeys = new Set(
    [variantName, packing].map((value) => normalizePackingKey(value)).filter(Boolean),
  );
  if (candidateKeys.size === 0) return null;

  return (
    variants.find((variant) => {
      const variantNameKey = normalizePackingKey(variant?.name || "");
      const variantWeightKey = normalizePackingKey(
        buildPackingFromWeightAndUnit(variant?.weight, variant?.unit),
      );
      return candidateKeys.has(variantNameKey) || candidateKeys.has(variantWeightKey);
    }) || null
  );
};

const resolveReceivedQuantity = (item = {}) => {
  const qtyReceived = Number(item?.qty_received);
  if (Number.isFinite(qtyReceived) && qtyReceived > 0) return qtyReceived;
  const receivedQuantity = Number(item?.receivedQuantity);
  if (Number.isFinite(receivedQuantity) && receivedQuantity > 0) return receivedQuantity;
  const quantity = Number(item?.quantity);
  if (Number.isFinite(quantity) && quantity > 0) return quantity;
  return 0;
};

const run = async () => {
  await connectDb();

  const poFilter = targetPoNumber
    ? { poNumber: String(targetPoNumber).trim() }
    : { status: "received", inventory_applied: true };

  const purchaseOrders = await PurchaseOrderModel.find(poFilter)
    .sort({ createdAt: -1 })
    .select("_id poNumber status inventory_applied items")
    .exec();

  const summary = {
    purchaseOrdersScanned: purchaseOrders.length,
    lineItemsScanned: 0,
    lineItemsEligible: 0,
    lineItemsBackfilled: 0,
    lineItemsSkipped: 0,
  };

  for (const po of purchaseOrders) {
    let poChanged = false;

    for (let index = 0; index < (po.items || []).length; index += 1) {
      const item = po.items[index];
      summary.lineItemsScanned += 1;

      const productId = String(item?.productId || "");
      if (!mongoose.Types.ObjectId.isValid(productId)) {
        summary.lineItemsSkipped += 1;
        continue;
      }

      const receivedQty = resolveReceivedQuantity(item);
      if (receivedQty <= 0) {
        summary.lineItemsSkipped += 1;
        continue;
      }

      const product = await ProductModel.findById(productId)
        .select(
          "name stock stock_quantity variants._id variants.name variants.weight variants.unit variants.stock variants.stock_quantity",
        )
        .lean();
      if (!product || !Array.isArray(product.variants) || product.variants.length === 0) {
        summary.lineItemsSkipped += 1;
        continue;
      }

      const resolvedVariant = resolveVariantForPacking({
        product,
        variantId: item?.variantId,
        variantName: item?.variantName,
        packing: item?.packing || item?.packSize,
      });
      if (!resolvedVariant?._id) {
        summary.lineItemsSkipped += 1;
        continue;
      }

      const resolvedVariantId = String(resolvedVariant._id);
      const hasVariantAudit = await InventoryAuditModel.exists({
        action: "PO_RECEIVE",
        source: "PO",
        referenceId: String(po._id),
        productId: new mongoose.Types.ObjectId(productId),
        variantId: new mongoose.Types.ObjectId(resolvedVariantId),
      });
      if (hasVariantAudit) {
        summary.lineItemsSkipped += 1;
        continue;
      }

      const productOverallStock = Number(
        product?.stock_quantity ?? product?.stock ?? 0,
      );
      const productVariantStockSum = (product?.variants || []).reduce(
        (sum, variant) =>
          sum + Number(variant?.stock_quantity ?? variant?.stock ?? 0),
        0,
      );
      const stockGap = Math.max(productOverallStock - productVariantStockSum, 0);
      const shouldBackfill = stockGap > 0;

      if (!shouldBackfill) {
        summary.lineItemsSkipped += 1;
        continue;
      }

      summary.lineItemsEligible += 1;
      const applyQty =
        stockGap > 0
          ? Math.min(Number(receivedQty), Number(stockGap))
          : Number(receivedQty);
      if (!Number.isFinite(applyQty) || applyQty <= 0) {
        summary.lineItemsSkipped += 1;
        continue;
      }

      const normalizedPacking =
        buildPackingFromWeightAndUnit(resolvedVariant?.weight, resolvedVariant?.unit) ||
        String(resolvedVariant?.name || item?.packing || "").trim();
      const nextVariantName = String(
        resolvedVariant?.name || item?.variantName || normalizedPacking || "",
      ).trim();

      console.log(
        `[ELIGIBLE] PO=${po.poNumber} line=${index} product=${product.name} qty=${applyQty}/${receivedQty} gap=${stockGap} variant=${nextVariantName} (${resolvedVariantId})`,
      );

      if (!shouldApply) {
        continue;
      }

      await ProductModel.updateOne(
        { _id: new mongoose.Types.ObjectId(productId), "variants._id": new mongoose.Types.ObjectId(resolvedVariantId) },
        {
          $inc: {
            "variants.$.stock_quantity": Number(applyQty),
            "variants.$.stock": Number(applyQty),
          },
        },
      );

      item.variantId = new mongoose.Types.ObjectId(resolvedVariantId);
      item.variantName = nextVariantName;
      item.packing = normalizedPacking;
      poChanged = true;

      await InventoryAuditModel.create({
        productId: new mongoose.Types.ObjectId(productId),
        variantId: new mongoose.Types.ObjectId(resolvedVariantId),
        action: "PO_RECEIVE",
        quantity: Number(applyQty),
        source: "PO",
        referenceId: String(po._id),
        before: { stock_quantity: 0, reserved_quantity: 0 },
        after: { stock_quantity: 0, reserved_quantity: 0 },
      });

      summary.lineItemsBackfilled += 1;
    }

    if (poChanged && shouldApply) {
      await po.save();
    }
  }

  console.log("\nBackfill summary:");
  console.table(summary);
  console.log(shouldApply ? "Applied changes." : "Dry run only. Use --apply to execute.");
};

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Backfill failed:", error);
    process.exit(1);
  });
