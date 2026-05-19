import cache from "../services/cache.service.js";

const ADMIN_READ_CACHE_PREFIXES = [
  "statistics:",
  "orders:",
  "reports:",
  "analytics:",
  "behavior:",
];

export const invalidateAdminReadCaches = () => {
  for (const prefix of ADMIN_READ_CACHE_PREFIXES) {
    cache.delPrefix(prefix);
  }
};

export default invalidateAdminReadCaches;
