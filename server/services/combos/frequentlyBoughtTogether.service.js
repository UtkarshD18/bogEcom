import OrderModel from "../../models/order.model.js";
import FrequentlyBoughtTogetherModel from "../../models/frequentlyBoughtTogether.model.js";
import { logger } from "../../utils/errorHandler.js";

let jobTimer = null;
let jobInFlight = false;

const isEnabled = () => {
  const flag = process.env.FBT_JOB_ENABLED;
  if (flag === undefined || flag === null || String(flag).trim() === "") {
    return true;
  }
  return String(flag).toLowerCase() === "true";
};

const getConfig = () => {
  const lookbackDays = Number(process.env.FBT_LOOKBACK_DAYS || 90);
  const maxOrders = Number(process.env.FBT_MAX_ORDERS || 5000);
  const minPairCount = Number(process.env.FBT_MIN_PAIR_COUNT || 2);
  const intervalHours = Number(process.env.FBT_JOB_INTERVAL_HOURS || 6);

  return {
    lookbackDays: Math.max(lookbackDays, 1),
    maxOrders: Math.max(maxOrders, 100),
    minPairCount: Math.max(minPairCount, 1),
    intervalMs: Math.max(intervalHours, 1) * 60 * 60 * 1000,
  };
};

const resolveEligibleOrderFilter = (since) => ({
  createdAt: { $gte: since },
  $or: [
    { payment_status: "paid" },
    {
      order_status: {
        $in: [
          "accepted",
          "confirmed",
          "in_warehouse",
          "shipped",
          "out_for_delivery",
          "delivered",
          "completed",
        ],
      },
    },
  ],
});

const buildOrderProductIds = (order) => {
  const products = Array.isArray(order?.products) ? order.products : [];
  const ids = products
    .map((item) => String(item?.productId || "").trim())
    .filter(Boolean);
  return Array.from(new Set(ids));
};

export const generateFrequentlyBoughtTogether = async () => {
  const config = getConfig();
  const since = new Date(Date.now() - config.lookbackDays * 24 * 60 * 60 * 1000);

  const orders = await OrderModel.find(resolveEligibleOrderFilter(since))
    .select("products createdAt")
    .sort({ createdAt: -1 })
    .limit(config.maxOrders)
    .lean();

  const productOrderCount = new Map();
  const pairCount = new Map();

  for (const order of orders) {
    const ids = buildOrderProductIds(order);
    if (ids.length < 2) {
      ids.forEach((id) => {
        productOrderCount.set(id, (productOrderCount.get(id) || 0) + 1);
      });
      continue;
    }

    ids.forEach((id) => {
      productOrderCount.set(id, (productOrderCount.get(id) || 0) + 1);
    });

    for (let i = 0; i < ids.length; i += 1) {
      for (let j = i + 1; j < ids.length; j += 1) {
        const a = ids[i];
        const b = ids[j];
        const keyAB = `${a}::${b}`;
        const keyBA = `${b}::${a}`;
        pairCount.set(keyAB, (pairCount.get(keyAB) || 0) + 1);
        pairCount.set(keyBA, (pairCount.get(keyBA) || 0) + 1);
      }
    }
  }

  const now = new Date();
  const bulkOps = [];

  for (const [key, count] of pairCount.entries()) {
    if (count < config.minPairCount) continue;
    const [productId, relatedProductId] = key.split("::");
    const baseCount = productOrderCount.get(productId) || 0;
    const confidenceScore = baseCount > 0 ? count / baseCount : 0;

    bulkOps.push({
      updateOne: {
        filter: { productId, relatedProductId },
        update: {
          $set: {
            frequencyScore: count,
            confidenceScore: Number(confidenceScore.toFixed(4)),
            pairCount: count,
            orderCount: baseCount,
            lastUpdated: now,
          },
          $setOnInsert: { createdAt: now },
        },
        upsert: true,
      },
    });
  }

  if (bulkOps.length > 0) {
    await FrequentlyBoughtTogetherModel.bulkWrite(bulkOps, { ordered: false });
  }

  return {
    processedOrders: orders.length,
    pairs: bulkOps.length,
  };
};

export const startFrequentlyBoughtTogetherJob = () => {
  if (!isEnabled()) {
    logger.info("fbtJob", "Frequently bought together job disabled");
    return null;
  }

  if (jobTimer) return jobTimer;
  const { intervalMs } = getConfig();

  const run = async () => {
    if (jobInFlight) return;
    jobInFlight = true;
    try {
      const result = await generateFrequentlyBoughtTogether();
      logger.info("fbtJob", "FBT refresh completed", result);
    } catch (error) {
      logger.error("fbtJob", "FBT refresh failed", {
        error: error?.message || String(error),
      });
    } finally {
      jobInFlight = false;
    }
  };

  run();
  jobTimer = setInterval(run, intervalMs);
  logger.info("fbtJob", "FBT job started", { intervalMs });
  return jobTimer;
};

export const stopFrequentlyBoughtTogetherJob = () => {
  if (jobTimer) {
    clearInterval(jobTimer);
    jobTimer = null;
  }
};

export default {
  generateFrequentlyBoughtTogether,
  startFrequentlyBoughtTogetherJob,
  stopFrequentlyBoughtTogetherJob,
};
