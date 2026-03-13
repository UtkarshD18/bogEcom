import ComboAnalyticsModel from "../../models/comboAnalytics.model.js";
import ComboOrderModel from "../../models/comboOrder.model.js";
import ComboModel from "../../models/combo.model.js";
import FrequentlyBoughtTogetherModel from "../../models/frequentlyBoughtTogether.model.js";
import { getAnalyticsDb } from "../analytics/analyticsDb.service.js";
import { getAnalyticsCollection } from "../analytics/collectionResolver.service.js";

const toDate = (value, fallback) => {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return date;
};

const toPositiveInt = (value, fallback) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
};

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toDateExpression = (fieldExpression) => ({
  $convert: { input: fieldExpression, to: "date", onError: null, onNull: null },
});

export const resolveRange = (query = {}) => {
  const now = new Date();
  const from = toDate(query.from, new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000));
  const to = toDate(query.to, now);
  if (from > to) return { from: to, to: from };
  return { from, to };
};

const getComboEventCollection = async () => {
  const analyticsDb = await getAnalyticsDb();
  return getAnalyticsCollection(analyticsDb, "combo_events", []);
};

export const fetchComboEventStats = async ({ from, to }) => {
  const collection = await getComboEventCollection();
  const match = {
    eventType: { $in: ["combo_view", "combo_click", "combo_add_to_cart", "combo_purchase"] },
    $expr: {
      $and: [
        { $gte: [toDateExpression("$timestamp"), from] },
        { $lte: [toDateExpression("$timestamp"), to] },
      ],
    },
  };

  const pipeline = [
    { $match: match },
    {
      $group: {
        _id: { comboId: "$comboId", eventType: "$eventType" },
        count: { $sum: 1 },
      },
    },
  ];

  const results = await collection.aggregate(pipeline).toArray();
  const stats = new Map();

  for (const row of results) {
    const comboId = String(row?._id?.comboId || "");
    if (!comboId) continue;
    const entry = stats.get(comboId) || {
      impressions: 0,
      clicks: 0,
      addToCart: 0,
      purchases: 0,
    };
    const count = toNumber(row?.count, 0);

    switch (row?._id?.eventType) {
      case "combo_view":
        entry.impressions += count;
        break;
      case "combo_click":
        entry.clicks += count;
        break;
      case "combo_add_to_cart":
        entry.addToCart += count;
        break;
      case "combo_purchase":
        entry.purchases += count;
        break;
      default:
        break;
    }

    stats.set(comboId, entry);
  }

  return stats;
};

export const fetchComboRevenueStats = async ({ from, to }) => {
  const pipeline = [
    {
      $match: {
        createdAt: { $gte: from, $lte: to },
      },
    },
    {
      $group: {
        _id: "$comboId",
        revenue: { $sum: "$comboPrice" },
        purchases: { $sum: 1 },
        avgOrderTotal: { $avg: "$orderTotal" },
      },
    },
  ];

  const results = await ComboOrderModel.aggregate(pipeline);
  const stats = new Map();

  for (const row of results) {
    const comboId = String(row?._id || "");
    if (!comboId) continue;
    stats.set(comboId, {
      revenue: toNumber(row?.revenue, 0),
      purchases: toNumber(row?.purchases, 0),
      avgOrderTotal: toNumber(row?.avgOrderTotal, 0),
    });
  }

  return stats;
};

export const fetchOverallAov = async ({ from, to }) => {
  const result = await ComboOrderModel.aggregate([
    { $match: { createdAt: { $gte: from, $lte: to } } },
    {
      $group: {
        _id: null,
        avgOrderTotal: { $avg: "$orderTotal" },
      },
    },
  ]);

  return toNumber(result?.[0]?.avgOrderTotal, 0);
};

export const buildComboAnalyticsReport = async ({ from, to }) => {
  const [eventStats, revenueStats, combos, overallAov] = await Promise.all([
    fetchComboEventStats({ from, to }),
    fetchComboRevenueStats({ from, to }),
    ComboModel.find({}).select("_id name slug comboPrice totalSavings").lean(),
    fetchOverallAov({ from, to }),
  ]);

  const comboMap = new Map(combos.map((combo) => [String(combo._id), combo]));

  const rows = [];
  for (const [comboId, eventData] of eventStats.entries()) {
    const revenueData = revenueStats.get(comboId) || {};
    const combo = comboMap.get(comboId) || {};

    const impressions = eventData.impressions || 0;
    const purchases = revenueData.purchases || eventData.purchases || 0;
    const conversionRate = impressions > 0 ? (purchases / impressions) * 100 : 0;
    const aovImpact = overallAov > 0 ? revenueData.avgOrderTotal - overallAov : 0;

    rows.push({
      comboId,
      comboName: combo?.name || "Unknown Combo",
      comboSlug: combo?.slug || "",
      impressions: eventData.impressions || 0,
      clicks: eventData.clicks || 0,
      addToCart: eventData.addToCart || 0,
      purchases,
      revenue: toNumber(revenueData.revenue, 0),
      conversionRate: Number(conversionRate.toFixed(2)),
      aovImpact: Number(aovImpact.toFixed(2)),
      totalSavings: toNumber(combo?.totalSavings, 0),
      comboPrice: toNumber(combo?.comboPrice, 0),
    });
  }

  rows.sort((a, b) => b.revenue - a.revenue);

  return {
    summary: {
      totalCombos: combos.length,
      totalRevenue: rows.reduce((sum, row) => sum + row.revenue, 0),
      totalImpressions: rows.reduce((sum, row) => sum + row.impressions, 0),
      totalClicks: rows.reduce((sum, row) => sum + row.clicks, 0),
      totalAddToCart: rows.reduce((sum, row) => sum + row.addToCart, 0),
      totalPurchases: rows.reduce((sum, row) => sum + row.purchases, 0),
      overallAov: overallAov,
    },
    rows,
  };
};

export const refreshComboAnalyticsBuckets = async ({ from, to, bucketLabel = "custom" } = {}) => {
  const { summary, rows } = await buildComboAnalyticsReport({ from, to });

  const operations = rows.map((row) => ({
    updateOne: {
      filter: { comboId: row.comboId, bucket: bucketLabel },
      update: {
        $set: {
          rangeStart: from,
          rangeEnd: to,
          impressions: row.impressions,
          clicks: row.clicks,
          addToCart: row.addToCart,
          purchases: row.purchases,
          revenue: row.revenue,
          conversionRate: row.conversionRate,
          aovImpact: row.aovImpact,
          lastUpdatedAt: new Date(),
        },
      },
      upsert: true,
    },
  }));

  if (operations.length > 0) {
    await ComboAnalyticsModel.bulkWrite(operations, { ordered: false });
  }

  return summary;
};

export const buildComboAnalyticsCharts = async ({ from, to }) => {
  const collection = await getComboEventCollection();
  const interval = "day";

  const pipeline = [
    {
      $match: {
        eventType: { $in: ["combo_view", "combo_click", "combo_add_to_cart", "combo_purchase"] },
        $expr: {
          $and: [
            { $gte: [toDateExpression("$timestamp"), from] },
            { $lte: [toDateExpression("$timestamp"), to] },
          ],
        },
      },
    },
    {
      $addFields: {
        bucket: {
          $dateToString: {
            format: "%Y-%m-%d",
            date: toDateExpression("$timestamp"),
          },
        },
      },
    },
    {
      $group: {
        _id: { bucket: "$bucket", eventType: "$eventType" },
        count: { $sum: 1 },
      },
    },
    { $sort: { "_id.bucket": 1 } },
  ];

  const data = await collection.aggregate(pipeline).toArray();
  const bucketMap = new Map();

  data.forEach((row) => {
    const bucket = row?._id?.bucket;
    if (!bucket) return;
    const entry = bucketMap.get(bucket) || {
      bucket,
      impressions: 0,
      clicks: 0,
      addToCart: 0,
      purchases: 0,
    };

    const count = toNumber(row?.count, 0);
    switch (row?._id?.eventType) {
      case "combo_view":
        entry.impressions += count;
        break;
      case "combo_click":
        entry.clicks += count;
        break;
      case "combo_add_to_cart":
        entry.addToCart += count;
        break;
      case "combo_purchase":
        entry.purchases += count;
        break;
      default:
        break;
    }

    bucketMap.set(bucket, entry);
  });

  return {
    interval,
    series: Array.from(bucketMap.values()),
  };
};

export const buildComboPairingHeatmap = async ({ limit = 20 } = {}) => {
  const pipeline = [
    { $sort: { pairCount: -1, confidenceScore: -1 } },
    { $limit: Math.max(toPositiveInt(limit, 20), 1) },
  ];

  const pairs = await FrequentlyBoughtTogetherModel.aggregate(pipeline);

  return pairs.map((pair) => ({
    productId: String(pair.productId || ""),
    relatedProductId: String(pair.relatedProductId || ""),
    pairCount: toNumber(pair.pairCount, 0),
    confidenceScore: toNumber(pair.confidenceScore, 0),
  }));
};
