import mongoose from "mongoose";
import OrderModel from "../models/order.model.js";
import {
  AppError,
  asyncHandler,
  handleDatabaseError,
  logger,
  sendError,
  sendSuccess,
} from "../utils/errorHandler.js";
import { normalizeOrderStatus, ORDER_STATUS } from "../utils/orderStatus.js";
import { createOrderReportWriter } from "../utils/excelExport.js";

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
        $project: {
          orderId: "$_id",
          orderNumber: 1,
          displayOrderId: 1,
          order_status: 1,
          createdAt: 1,
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
        },
      },
    ];

    cursor = OrderModel.aggregate(exportPipeline)
      .allowDiskUse(true)
      .cursor({ batchSize: 1000 })
      .exec();

    const filename = `order-report-${startDate
      .toISOString()
      .slice(0, 10)}_to_${endDate.toISOString().slice(0, 10)}.xlsx`;
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    const { workbook, worksheet } = await createOrderReportWriter({ stream: res });

    for await (const row of cursor) {
      const orderId = String(row?.orderId || row?._id || "").trim();
      const orderDisplayId = String(
        row?.orderNumber || row?.displayOrderId || orderId || "",
      ).trim();
      worksheet
        .addRow({
          orderId: orderDisplayId || orderId,
          productId: String(row?.productId || "").trim(),
          productName: String(row?.productName || "").trim(),
          quantity: Number(row?.quantity || 0),
          price: Number(row?.price || 0),
          orderStatus: resolveOrderStatusLabel(row?.order_status),
          customer: String(row?.customerName || "").trim() || "Guest",
          orderDate: row?.createdAt
            ? new Date(row.createdAt).toISOString().slice(0, 10)
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
