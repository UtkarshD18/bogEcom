import UserLocationLogModel from "../models/userLocationLog.model.js";

const RETENTION_DAYS = 90;

const toNumberOrNull = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const toText = (value) => String(value || "").trim();

const computeExpiresAt = (createdAt = new Date()) =>
  new Date(createdAt.getTime() + RETENTION_DAYS * 24 * 60 * 60 * 1000);

const buildFormattedAddress = ({ street, city, state, pincode, country }) => {
  const parts = [street, city, state, pincode, country].map(toText).filter(Boolean);
  return parts.join(", ");
};

export const createUserLocationLog = async ({
  userId = null,
  orderId = null,
  location = null,
  addressFields = {},
}) => {
  const latitude = toNumberOrNull(location?.latitude);
  const longitude = toNumberOrNull(location?.longitude);

  const source =
    location?.source === "google_maps" && latitude !== null && longitude !== null
      ? "google_maps"
      : "manual";

  const street = toText(location?.street || addressFields?.street || "");
  const city = toText(location?.city || addressFields?.city || "");
  const state = toText(location?.state || addressFields?.state || "");
  const pincode = toText(location?.pincode || addressFields?.pincode || "");
  const country = toText(location?.country || addressFields?.country || "India") || "India";

  const formattedAddress = toText(
    location?.formattedAddress ||
      addressFields?.formattedAddress ||
      buildFormattedAddress({ street, city, state, pincode, country }),
  );

  const now = new Date();
  const expiresAt = computeExpiresAt(now);

  const log = await UserLocationLogModel.create({
    userId,
    orderId,
    latitude,
    longitude,
    formattedAddress,
    street,
    city,
    state,
    pincode,
    country,
    source,
    expiresAt,
    isArchived: false,
  });

  return log;
};

export const archiveExpiredLocationLogs = async ({ now = new Date() } = {}) => {
  return UserLocationLogModel.updateMany(
    {
      isArchived: false,
      expiresAt: { $lte: now },
    },
    { $set: { isArchived: true } },
  );
};

let retentionInterval = null;

export const startLocationLogRetentionJob = () => {
  if (retentionInterval) return;

  const run = async () => {
    try {
      const result = await archiveExpiredLocationLogs();
      const modified =
        typeof result?.modifiedCount === "number"
          ? result.modifiedCount
          : result?.nModified;
      if (modified) {
        console.log(`[locationLogs] Archived expired logs: ${modified}`);
      }
    } catch (err) {
      console.error("[locationLogs] Retention job failed:", err?.message || err);
    }
  };

  // Run once on startup, then every 6 hours.
  run();
  retentionInterval = setInterval(run, 6 * 60 * 60 * 1000);
};

