import {
  backfillLegacyMembershipUsers,
  expireMembershipUsers,
} from "./membershipUser.service.js";

let membershipExpiryTimer = null;
let membershipExpiryInFlight = false;

const isEnabled = () => {
  const flag = process.env.MEMBERSHIP_EXPIRY_JOB_ENABLED;
  if (flag === undefined || flag === null || String(flag).trim() === "") {
    return true;
  }
  return String(flag).toLowerCase() === "true";
};

const getConfig = () => {
  const everyHours = Number(process.env.MEMBERSHIP_EXPIRY_INTERVAL_HOURS || 6);
  return {
    intervalMs: Math.max(everyHours, 1) * 60 * 60 * 1000,
  };
};

export const processMembershipExpiry = async () => {
  if (membershipExpiryInFlight) return { expiredCount: 0 };
  membershipExpiryInFlight = true;

  try {
    await backfillLegacyMembershipUsers({ batchSize: 1000 });
    return expireMembershipUsers();
  } catch (error) {
    console.error("[membership-expiry] Failed:", error?.message || error);
    return { expiredCount: 0 };
  } finally {
    membershipExpiryInFlight = false;
  }
};

export const startMembershipExpiryJob = () => {
  if (!isEnabled()) {
    console.log("[membership-expiry] Job disabled");
    return null;
  }
  if (membershipExpiryTimer) {
    return membershipExpiryTimer;
  }

  const { intervalMs } = getConfig();
  processMembershipExpiry();
  membershipExpiryTimer = setInterval(processMembershipExpiry, intervalMs);
  console.log("[membership-expiry] Job started", { intervalMs });
  return membershipExpiryTimer;
};

export const stopMembershipExpiryJob = () => {
  if (membershipExpiryTimer) {
    clearInterval(membershipExpiryTimer);
    membershipExpiryTimer = null;
  }
};

export default {
  processMembershipExpiry,
  startMembershipExpiryJob,
  stopMembershipExpiryJob,
};
