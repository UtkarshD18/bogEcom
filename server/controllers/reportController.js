import mongoose from "mongoose";
import OrderModel from "../models/order.model.js";
import InfluencerModel from "../models/influencer.model.js";
import SettingsModel from "../models/settings.model.js";
import {
  AppError,
  asyncHandler,
  handleDatabaseError,
  logger,
  sendError,
  sendSuccess,
} from "../utils/errorHandler.js";
import { normalizeOrderStatus, ORDER_STATUS } from "../utils/orderStatus.js";
import {
  createOrderReportWriter,
  ORDER_REPORT_COLUMNS,
  PRICING_ENGINE_COLUMNS,
  PRICING_ENGINE_DEFAULTS,
  resolvePricingEngineTemplatePath,
} from "../utils/excelExport.js";

const REPORT_DEFAULT_LIMIT = 20;
const REPORT_MAX_LIMIT = 100;

const CONFIRMED_STATUSES = [
  ORDER_STATUS.ACCEPTED,
  ORDER_STATUS.CONFIRMED_LEGACY,
  ORDER_STATUS.IN_WAREHOUSE,
  ORDER_STATUS.SHIPPED,
  ORDER_STATUS.OUT_FOR_DELIVERY,
  ORDER_STATUS.DELIVERED,
  ORDER_STATUS.COMPLETED,
];

const RTO_STATUSES = [ORDER_STATUS.RTO, ORDER_STATUS.RTO_COMPLETED];

const sanitizeSearch = (value) => {
  if (!value) return "";
  return String(value)
    .trim()
    .slice(0, 100)
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

const parseDateInput = (value, isEnd = false) => {
  const raw = String(value || "").trim();
  if (!raw) return null;
  if (raw.includes("T")) {
    return new Date(raw);
  }
  const suffix = isEnd ? "23:59:59.999Z" : "00:00:00.000Z";
  return new Date(`${raw}T${suffix}`);
};

const resolveDateRange = (startInput, endInput) => {
  const startDate = parseDateInput(startInput, false);
  const endDate = parseDateInput(endInput, true);

  if (!startDate || !endDate) {
    throw new AppError("MISSING_FIELD", { fields: ["startDate", "endDate"] });
  }
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    throw new AppError("INVALID_FORMAT", {
      message: "startDate and endDate must be valid ISO dates",
    });
  }
  if (endDate < startDate) {
    throw new AppError("INVALID_FORMAT", {
      message: "endDate must be on or after startDate",
    });
  }

  return { startDate, endDate };
};

const resolvePagination = (pageInput, limitInput) => {
  let page = Number(pageInput || 1);
  let limit = Number(limitInput || REPORT_DEFAULT_LIMIT);
  if (!Number.isFinite(page) || page < 1) page = 1;
  if (!Number.isFinite(limit) || limit < 1) limit = REPORT_DEFAULT_LIMIT;
  if (limit > REPORT_MAX_LIMIT) limit = REPORT_MAX_LIMIT;
  return { page, limit, skip: (page - 1) * limit };
};

const resolveInterval = (startDate, endDate) => {
  const diffMs = Math.max(endDate.getTime() - startDate.getTime(), 0);
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays <= 1) {
    return { interval: "hourly", format: "%Y-%m-%d %H:00" };
  }
  if (diffDays <= 30) {
    return { interval: "daily", format: "%Y-%m-%d" };
  }
  if (diffDays <= 92) {
    return { interval: "weekly", format: "%Y-W%V" };
  }
  if (diffDays <= 730) {
    return { interval: "monthly", format: "%Y-%m" };
  }
  return { interval: "yearly", format: "%Y" };
};

const resolveOrderStatusLabel = (status) => {
  const normalized = normalizeOrderStatus(status);
  if (!normalized) return "Pending";
  if (normalized === ORDER_STATUS.CANCELLED) return "Cancelled";
  if (normalized === ORDER_STATUS.RTO || normalized === ORDER_STATUS.RTO_COMPLETED) {
    return "RTO";
  }
  if (
    normalized === ORDER_STATUS.PENDING ||
    normalized === ORDER_STATUS.PAYMENT_PENDING
  ) {
    return "Pending";
  }
  return "Confirmed";
};

const extractHsnFromSpecifications = (specifications) => {
  if (!specifications) return null;

  if (specifications instanceof Map) {
    const direct =
      specifications.get("HSN") ||
      specifications.get("hsn") ||
      specifications.get("Hsn") ||
      specifications.get("HSN Code") ||
      specifications.get("hsnCode") ||
      null;
    if (direct) return direct;
  }

  if (typeof specifications === "object") {
    const direct =
      specifications.HSN ||
      specifications.hsn ||
      specifications.Hsn ||
      specifications["HSN Code"] ||
      specifications.hsnCode ||
      null;
    if (direct) return direct;
  }

  const entries =
    specifications instanceof Map
      ? Array.from(specifications.entries())
      : typeof specifications === "object"
        ? Object.entries(specifications)
        : [];
  for (const [key, value] of entries) {
    if (!key) continue;
    if (!String(key).toLowerCase().includes("hsn")) continue;
    const normalized = String(value || "").trim();
    if (normalized) return normalized;
  }

  return null;
};

const parseNumberLike = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const match = String(value).match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeInfluencerCode = (value) => {
  const raw = String(value || "").trim().toUpperCase();
  if (!raw) return "";
  const normalized = raw.replace(/[^A-Z0-9_-]/g, "");
  return normalized.slice(0, 30);
};

const pickMostCommonInfluencerCode = (counts) => {
  if (!counts || typeof counts !== "object") return "";
  let bestCode = "";
  let bestCount = 0;
  for (const [code, count] of Object.entries(counts)) {
    const numericCount = Number(count || 0);
    if (!code) continue;
    if (!Number.isFinite(numericCount) || numericCount <= 0) continue;
    if (numericCount > bestCount) {
      bestCode = code;
      bestCount = numericCount;
    }
  }
  return bestCode;
};

const computeInfluencerPercent = (type, value, baseAmount) => {
  const numericValue = Number(value || 0);
  if (!Number.isFinite(numericValue) || numericValue <= 0) return 0;
  const normalizedType = String(type || "").trim().toUpperCase();
  if (normalizedType === "PERCENT") return numericValue;
  if (normalizedType === "FLAT") {
    const base = Number(baseAmount || 0);
    if (!Number.isFinite(base) || base <= 0) return 0;
    return Math.round((numericValue / base) * 100 * 100) / 100;
  }
  return 0;
};

const extractCostOfMaking = (productDoc) => {
  if (!productDoc) return null;

  const specs = productDoc?.specifications;
  const candidates = [
    specs?.["Cost of Making"],
    specs?.["cost of making"],
    specs?.["Costing"],
    specs?.["costing"],
    specs?.["COGS"],
    specs?.["cogs"],
    specs?.costOfMaking,
    specs?.cost,
  ];

  if (specs instanceof Map) {
    candidates.push(
      specs.get("Cost of Making"),
      specs.get("cost of making"),
      specs.get("Costing"),
      specs.get("costing"),
      specs.get("COGS"),
      specs.get("cogs"),
      specs.get("costOfMaking"),
      specs.get("cost"),
    );
  }

  for (const candidate of candidates) {
    const parsed = parseNumberLike(candidate);
    if (parsed !== null) return parsed;
  }

  const variantAttributes = productDoc?.variant?.attributes;
  if (variantAttributes instanceof Map) {
    const variantCost = parseNumberLike(
      variantAttributes.get("cost") ||
        variantAttributes.get("Cost") ||
        variantAttributes.get("Cost of Making") ||
        variantAttributes.get("cost of making") ||
        variantAttributes.get("costOfMaking"),
    );
    if (variantCost !== null) return variantCost;
  } else if (variantAttributes && typeof variantAttributes === "object") {
    const variantCost = parseNumberLike(
      variantAttributes.cost ||
        variantAttributes.Cost ||
        variantAttributes["Cost of Making"] ||
        variantAttributes["cost of making"] ||
        variantAttributes.costOfMaking,
    );
    if (variantCost !== null) return variantCost;
  }

  return null;
};

const buildSearchMatch = (searchTerm) => {
  if (!searchTerm) return null;
  const filters = [
    { "products.productId": { $regex: searchTerm, $options: "i" } },
    { orderNumber: { $regex: searchTerm, $options: "i" } },
    { displayOrderId: { $regex: searchTerm, $options: "i" } },
  ];

  if (mongoose.Types.ObjectId.isValid(searchTerm)) {
    filters.push({ _id: new mongoose.Types.ObjectId(searchTerm) });
  }

  return { $or: filters };
};

const normalizeReportRow = (row) => {
  const orderId = String(row?.orderId || row?._id || "").trim();
  const orderDisplayId = String(
    row?.orderNumber || row?.displayOrderId || orderId || "",
  ).trim();

  return {
    orderId,
    orderDisplayId,
    productId: String(row?.productId || "").trim(),
    productName: String(row?.productName || "").trim(),
    quantity: Number(row?.quantity || 0),
    price: Number(row?.price || 0),
    orderStatus: resolveOrderStatusLabel(row?.order_status),
    customerName: String(row?.customerName || "").trim() || "Guest",
    orderDate: row?.createdAt ? new Date(row.createdAt).toISOString() : null,
    deliveryStatus: String(
      row?.deliveryStatus || row?.shipmentStatus || row?.shipment_status || "pending",
    ).trim(),
  };
};

export const getOrdersReport = asyncHandler(async (req, res) => {
  try {
    const { startDate, endDate } = resolveDateRange(
      req.query.startDate,
      req.query.endDate,
    );
    const { page, limit, skip } = resolvePagination(
      req.query.page,
      req.query.limit,
    );
    const searchTerm = sanitizeSearch(req.query.search);

    const baseMatch = {
      purchaseOrder: null,
      createdAt: { $gte: startDate, $lte: endDate },
      payment_status: { $in: ["paid", "confirmed", "PAID", "CONFIRMED"] },
    };
    const searchMatch = buildSearchMatch(searchTerm);

    const reportPipeline = [
      { $match: baseMatch },
      { $unwind: "$products" },
      ...(searchMatch ? [{ $match: searchMatch }] : []),
      {
        $facet: {
          data: [
            { $sort: { createdAt: -1 } },
            { $skip: skip },
            { $limit: limit },
            {
              $project: {
                orderId: "$_id",
                orderNumber: 1,
                displayOrderId: 1,
                order_status: 1,
                createdAt: 1,
                shipmentStatus: 1,
                shipment_status: 1,
                productId: "$products.productId",
                productName: "$products.productTitle",
                quantity: "$products.quantity",
                price: "$products.price",
                customerName: {
                  $ifNull: [
                    "$billingDetails.fullName",
                    {
                      $ifNull: [
                        "$deliveryAddressSnapshot.order_name",
                        "$guestDetails.fullName",
                      ],
                    },
                  ],
                },
                deliveryStatus: {
                  $ifNull: ["$shipmentStatus", "$shipment_status"],
                },
              },
            },
          ],
          total: [{ $count: "count" }],
        },
      },
    ];

    const [reportResult] = await OrderModel.aggregate(reportPipeline)
      .allowDiskUse(true)
      .exec();
    const rawRows = reportResult?.data || [];
    const total = reportResult?.total?.[0]?.count || 0;
    const orders = rawRows.map(normalizeReportRow);

    const { interval, format } = resolveInterval(startDate, endDate);
    const chartPipeline = [
      {
        $match: {
          ...baseMatch,
          order_status: { $in: [...CONFIRMED_STATUSES, ...RTO_STATUSES] },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format, date: "$createdAt" } },
          confirmed: {
            $sum: {
              $cond: [{ $in: ["$order_status", CONFIRMED_STATUSES] }, 1, 0],
            },
          },
          rto: {
            $sum: { $cond: [{ $in: ["$order_status", RTO_STATUSES] }, 1, 0] },
          },
        },
      },
      { $sort: { _id: 1 } },
    ];

    const chartRows = await OrderModel.aggregate(chartPipeline)
      .allowDiskUse(true)
      .exec();
    const chartData = chartRows.map((entry) => ({
      date: entry._id,
      confirmed: entry.confirmed || 0,
      rto: entry.rto || 0,
    }));

    logger.debug("getOrdersReport", "Report generated", {
      page,
      limit,
      total,
      interval,
      startDate,
      endDate,
    });

    return sendSuccess(
      res,
      {
        orders,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit) || 1,
        },
        chart: { interval, data: chartData },
        range: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        },
      },
      "Order report loaded",
    );
  } catch (error) {
    if (error instanceof AppError) {
      return sendError(res, error);
    }
    const dbError = handleDatabaseError(error, "getOrdersReport");
    return sendError(res, dbError);
  }
});

export const exportOrdersReport = asyncHandler(async (req, res) => {
  let cursor = null;
  try {
    const { startDate, endDate } = resolveDateRange(
      req.query.startDate,
      req.query.endDate,
    );
    const includeRto =
      String(req.query.includeRto || "")
        .trim()
        .toLowerCase() === "true";
    const statusFilter = includeRto
      ? {
          $in: [
            ORDER_STATUS.DELIVERED,
            ORDER_STATUS.COMPLETED,
            ORDER_STATUS.RTO,
            ORDER_STATUS.RTO_COMPLETED,
          ],
        }
      : { $in: [ORDER_STATUS.DELIVERED, ORDER_STATUS.COMPLETED] };
    const searchTerm = sanitizeSearch(req.query.search);
    const baseMatch = {
      purchaseOrder: null,
      createdAt: { $gte: startDate, $lte: endDate },
      order_status: statusFilter,
    };
    const searchMatch = buildSearchMatch(searchTerm);

    const exportPipeline = [
      { $match: baseMatch },
      { $unwind: "$products" },
      ...(searchMatch ? [{ $match: searchMatch }] : []),
      { $sort: { createdAt: -1 } },
      {
        $addFields: {
          productObjectId: {
            $convert: {
              input: "$products.productId",
              to: "objectId",
              onError: null,
              onNull: null,
            },
          },
        },
      },
      {
        $lookup: {
          from: "products",
          let: {
            pid: "$productObjectId",
            vid: "$products.variantId",
            vname: "$products.variantName",
          },
          pipeline: [
            { $match: { $expr: { $eq: ["$_id", "$$pid"] } } },
            {
              $project: {
                name: 1,
                sku: 1,
                hsnCode: 1,
                specifications: 1,
                shippingCost: 1,
                freeShipping: 1,
                unit: 1,
                weight: 1,
                price: 1,
                originalPrice: 1,
                variants: 1,
              },
            },
            {
              $addFields: {
                variant: {
                  $first: {
                    $filter: {
                      input: "$variants",
                      as: "v",
                      cond: {
                        $or: [
                          { $eq: [{ $toString: "$$v._id" }, "$$vid"] },
                          {
                            $and: [
                              { $ne: ["$$vname", null] },
                              { $ne: ["$$vname", ""] },
                              {
                                $eq: [
                                  {
                                    $toLower: { $trim: { input: "$$v.name" } },
                                  },
                                  {
                                    $toLower: {
                                      $trim: { input: "$$vname" },
                                    },
                                  },
                                ],
                              },
                            ],
                          },
                        ],
                      },
                    },
                  },
                },
              },
            },
            {
              $project: {
                name: 1,
                sku: 1,
                hsnCode: 1,
                specifications: 1,
                shippingCost: 1,
                freeShipping: 1,
                unit: 1,
                weight: 1,
                price: 1,
                originalPrice: 1,
                variant: {
                  _id: 1,
                  name: 1,
                  sku: 1,
                  price: 1,
                  originalPrice: 1,
                  weight: 1,
                  unit: 1,
                  attributes: 1,
                },
              },
            },
          ],
          as: "productDoc",
        },
      },
      { $unwind: { path: "$productDoc", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          orderId: "$_id",
          orderNumber: 1,
          displayOrderId: 1,
          order_status: 1,
          createdAt: 1,
          shipmentStatus: { $ifNull: ["$shipmentStatus", "$shipment_status"] },
          productId: "$products.productId",
          productName: "$products.productTitle",
          variantId: "$products.variantId",
          variantName: "$products.variantName",
          quantity: "$products.quantity",
          price: "$products.price",
          subTotal: "$products.subTotal",
          customerName: {
            $ifNull: [
              "$billingDetails.fullName",
              {
                $ifNull: [
                  "$deliveryAddressSnapshot.order_name",
                  "$guestDetails.fullName",
                ],
              },
            ],
          },
          couponCode: 1,
          discountAmount: { $ifNull: ["$discountAmount", "$discount"] },
          influencerId: 1,
          influencerCode: 1,
          affiliateCode: 1,
          influencerDiscount: 1,
          influencerCommission: 1,
          shipping: 1,
          subtotal: 1,
          gst: 1,
          productDoc: 1,
        },
      },
    ];

    cursor = OrderModel.aggregate(exportPipeline)
      .allowDiskUse(true)
      .cursor({ batchSize: 1000 });

    const filename = `order-report-${startDate
      .toISOString()
      .slice(0, 10)}_to_${endDate.toISOString().slice(0, 10)}.xlsx`;
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    const { workbook, worksheet: orderWorksheet } = await createOrderReportWriter({
      stream: res,
      sheetName: "Order Report",
      columns: ORDER_REPORT_COLUMNS,
    });

    const { worksheet: pricingWorksheet } = await createOrderReportWriter({
      workbook,
      sheetName: "Pricing Engine",
      templatePath: resolvePricingEngineTemplatePath(),
      columns: PRICING_ENGINE_COLUMNS,
    });

    const pricingRows = new Map();
    let pricingRowNumber = 2;

    for await (const row of cursor) {
      const orderId = String(row?.orderId || row?._id || "").trim();
      const orderDisplayId = String(
        row?.orderNumber || row?.displayOrderId || orderId || "",
      ).trim();

      const productDoc = row?.productDoc || null;
      const variantDoc = productDoc?.variant || null;
      const sku = String(variantDoc?.sku || productDoc?.sku || "").trim();
      const hsn =
        String(variantDoc?.hsnCode || "").trim() ||
        String(productDoc?.hsnCode || "").trim() ||
        extractHsnFromSpecifications(variantDoc?.attributes) ||
        extractHsnFromSpecifications(productDoc?.specifications);
      const deliveryStatus = String(
        row?.deliveryStatus || row?.shipmentStatus || row?.shipment_status || "pending",
      ).trim();

      orderWorksheet
        .addRow({
          orderId: orderDisplayId || orderId,
          productId: String(row?.productId || "").trim(),
          sku,
          hsnCode: hsn ? String(hsn).trim() : "",
          productName: String(row?.productName || "").trim(),
          variantName: String(row?.variantName || "").trim(),
          quantity: Number(row?.quantity || 0),
          price: Number(row?.price || 0),
          orderStatus: resolveOrderStatusLabel(row?.order_status),
          customer: String(row?.customerName || "").trim() || "Guest",
          orderDate: row?.createdAt
            ? new Date(row.createdAt).toISOString().slice(0, 10)
            : "",
          deliveryStatus,
        })
        .commit();

      const productId = String(row?.productId || "").trim();
      if (productId) {
        const variantId = String(row?.variantId || "").trim();
        const pricingKey = `${productId}:${variantId || "default"}`;
        const orderItemPrice = Number(row?.price || 0);
        const mrpCandidate = Number(
          variantDoc?.originalPrice ?? productDoc?.originalPrice ?? 0,
        );
        const sellingCandidate = Number(variantDoc?.price ?? productDoc?.price ?? 0);
        const weightCandidate = Number(variantDoc?.weight ?? productDoc?.weight ?? 0);
        const resolvedMrp =
          Number.isFinite(mrpCandidate) && mrpCandidate > 0 ? mrpCandidate : null;
        const resolvedSellingPrice =
          Number.isFinite(sellingCandidate) && sellingCandidate > 0
            ? sellingCandidate
            : Number.isFinite(orderItemPrice) && orderItemPrice > 0
              ? orderItemPrice
              : null;
        const resolvedWeight =
          Number.isFinite(weightCandidate) && weightCandidate > 0
            ? weightCandidate
            : null;

        const influencerCode = normalizeInfluencerCode(
          row?.influencerCode || row?.affiliateCode,
        );
        let pricingEntry = pricingRows.get(pricingKey);
        if (!pricingEntry) {
          pricingEntry = {
            productId,
            variantId,
            productName: String(productDoc?.name || row?.productName || "").trim(),
             variantName: String(variantDoc?.name || row?.variantName || "").trim(),
             sku,
             hsnCode: hsn ? String(hsn).trim() : "",
             unit: String(variantDoc?.unit || productDoc?.unit || "").trim(),
             weight: resolvedWeight,
             mrp: resolvedMrp,
             sellingPrice: resolvedSellingPrice,
             costOfMaking: extractCostOfMaking(productDoc),
             deliveryCost:
               productDoc?.freeShipping === true
                ? 0
                : Number(productDoc?.shippingCost || 0) > 0
                  ? Number(productDoc.shippingCost)
                  : PRICING_ENGINE_DEFAULTS.deliveryCost,
            influencerCodeCounts: {},
          };
          pricingRows.set(pricingKey, pricingEntry);
        }

        if (!pricingEntry.sku && sku) pricingEntry.sku = sku;
        if (!pricingEntry.hsnCode && hsn) {
          pricingEntry.hsnCode = String(hsn).trim();
        }
        if (!pricingEntry.unit && (variantDoc?.unit || productDoc?.unit)) {
          pricingEntry.unit = String(variantDoc?.unit || productDoc?.unit || "").trim();
        }
        if (
          (!pricingEntry.weight || Number(pricingEntry.weight) <= 0) &&
          resolvedWeight !== null
        ) {
          pricingEntry.weight = resolvedWeight;
        }
        if (pricingEntry.mrp === null && resolvedMrp !== null) {
          pricingEntry.mrp = resolvedMrp;
        }
        if (pricingEntry.sellingPrice === null && resolvedSellingPrice !== null) {
          pricingEntry.sellingPrice = resolvedSellingPrice;
        }

        if (influencerCode) {
          pricingEntry.influencerCodeCounts[influencerCode] =
            (pricingEntry.influencerCodeCounts[influencerCode] || 0) + 1;
        }
      }
    }

    const influencerCodeOverride = normalizeInfluencerCode(req.query.influencerCode);
    const influencerCodesToFetch = new Set();
    if (influencerCodeOverride) {
      influencerCodesToFetch.add(influencerCodeOverride);
    }
    for (const item of pricingRows.values()) {
      const codes = item?.influencerCodeCounts
        ? Object.keys(item.influencerCodeCounts)
        : [];
      for (const code of codes) {
        const normalized = normalizeInfluencerCode(code);
        if (normalized) influencerCodesToFetch.add(normalized);
      }
    }

    const influencerMap = new Map();
    if (influencerCodesToFetch.size > 0) {
      const influencers = await InfluencerModel.find({
        code: { $in: Array.from(influencerCodesToFetch) },
      })
        .select("code discountType discountValue commissionType commissionValue isActive")
        .lean();

      influencers.forEach((influencer) => {
        const code = normalizeInfluencerCode(influencer?.code);
        if (code) influencerMap.set(code, influencer);
      });
    }

    const taxSetting = await SettingsModel.findOne({ key: "taxSettings" })
      .select("value")
      .lean();
    const taxRateCandidate = Number(
      taxSetting?.value?.taxRate ?? taxSetting?.value?.rate ?? NaN,
    );
    const effectiveGstRate =
      Number.isFinite(taxRateCandidate) && taxRateCandidate > 0
        ? taxRateCandidate
        : Number(PRICING_ENGINE_DEFAULTS.cgstPercent || 0) +
          Number(PRICING_ENGINE_DEFAULTS.sgstPercent || 0);
    const defaultCgstPercent = Number.isFinite(effectiveGstRate)
      ? Math.max(effectiveGstRate / 2, 0)
      : Number(PRICING_ENGINE_DEFAULTS.cgstPercent || 0);
    const defaultSgstPercent = Number.isFinite(effectiveGstRate)
      ? Math.max(effectiveGstRate / 2, 0)
      : Number(PRICING_ENGINE_DEFAULTS.sgstPercent || 0);

    for (const item of pricingRows.values()) {
      const rowNumber = pricingRowNumber;
      pricingRowNumber += 1;

      const baseAmountForPercent =
        Number(item?.sellingPrice || item?.mrp || 0) || 0;
      const resolvedInfluencerCode =
        influencerCodeOverride ||
        pickMostCommonInfluencerCode(item?.influencerCodeCounts) ||
        "";
      const influencer =
        resolvedInfluencerCode && influencerMap.has(resolvedInfluencerCode)
          ? influencerMap.get(resolvedInfluencerCode)
          : null;
      const computedInfluencerCommissionPercent = influencer
        ? computeInfluencerPercent(
            influencer.commissionType,
            influencer.commissionValue,
            baseAmountForPercent,
          )
        : PRICING_ENGINE_DEFAULTS.influencerCommissionPercent;
      const influencerCommissionPercent =
        Number.isFinite(computedInfluencerCommissionPercent) &&
        computedInfluencerCommissionPercent > 0
          ? computedInfluencerCommissionPercent
          : "";

      const computedInfluencerCustomerDiscountPercent = influencer
        ? computeInfluencerPercent(
            influencer.discountType,
            influencer.discountValue,
            baseAmountForPercent,
          )
        : PRICING_ENGINE_DEFAULTS.influencerCustomerDiscountPercent;
      const influencerCustomerDiscountPercent =
        Number.isFinite(computedInfluencerCustomerDiscountPercent) &&
        computedInfluencerCustomerDiscountPercent > 0
          ? computedInfluencerCustomerDiscountPercent
          : "";

      pricingWorksheet
        .addRow({
          product: item.variantName
            ? `${item.productName} - ${item.variantName}`
            : item.productName,
          costOfMaking:
            item.costOfMaking === null || item.costOfMaking === undefined
              ? ""
              : Number(item.costOfMaking),
          deliveryCost: Number(item.deliveryCost || 0),
          targetProfitMarginPercent:
            Number(PRICING_ENGINE_DEFAULTS.targetProfitMarginPercent || 0) > 0
              ? PRICING_ENGINE_DEFAULTS.targetProfitMarginPercent
              : "",
          influencerCommissionPercent,
          influencerCustomerDiscountPercent,
          couponDiscountPercent:
            Number(PRICING_ENGINE_DEFAULTS.couponDiscountPercent || 0) > 0
              ? PRICING_ENGINE_DEFAULTS.couponDiscountPercent
              : "",
          cgstPercent: defaultCgstPercent,
          sgstPercent: defaultSgstPercent,
          subtotalProduct: { formula: `B${rowNumber}` },
          influencerDiscountRs: { formula: `J${rowNumber}*(F${rowNumber}/100)` },
          couponDiscountRs: { formula: `J${rowNumber}*(G${rowNumber}/100)` },
          discountedProductPrice: { formula: `J${rowNumber}-K${rowNumber}-L${rowNumber}` },
          cgstRs: { formula: `M${rowNumber}*(H${rowNumber}/100)` },
          sgstRs: { formula: `M${rowNumber}*(I${rowNumber}/100)` },
          productPriceAfterGst: { formula: `M${rowNumber}+N${rowNumber}+O${rowNumber}` },
          customerPrice: { formula: `P${rowNumber}+C${rowNumber}` },
          influencerCommissionRs: { formula: `Q${rowNumber}*(E${rowNumber}/100)` },
          totalCost: { formula: `B${rowNumber}+C${rowNumber}+R${rowNumber}` },
          actualProfit: { formula: `Q${rowNumber}-S${rowNumber}` },
          actualMarginPercent: {
            formula: `IF(Q${rowNumber}=0,0,T${rowNumber}/Q${rowNumber}*100)`,
          },
          minCustomerPriceForTargetMargin: {
            formula: `IF(D${rowNumber}=0,0,S${rowNumber}/(1-D${rowNumber}/100))`,
          },
          productId: item.productId,
          variantId: item.variantId || "",
          sku: item.sku,
          hsnCode: item.hsnCode,
          unit: item.unit,
          weight: Number.isFinite(item.weight) && item.weight > 0 ? item.weight : "",
          mrp: Number.isFinite(item.mrp) && item.mrp > 0 ? item.mrp : "",
          sellingPrice:
            Number.isFinite(item.sellingPrice) && item.sellingPrice > 0
              ? item.sellingPrice
              : "",
        })
        .commit();
    }

    await workbook.commit();
  } catch (error) {
    if (res.headersSent) {
      logger.error("exportOrdersReport", "Export failed after headers sent", {
        error: error?.message || String(error),
      });
      return;
    }
    if (error instanceof AppError) {
      return sendError(res, error);
    }
    const dbError = handleDatabaseError(error, "exportOrdersReport");
    return sendError(res, dbError);
  } finally {
    if (cursor && typeof cursor.close === "function") {
      try {
        await cursor.close();
      } catch {
        // ignore cursor close failures
      }
    }
  }
});
