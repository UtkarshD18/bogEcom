const MANAGER_PERMISSION_KEYS = Object.freeze([
  "manage_users",
  "view_analytics",
  "manage_crm",
  "manage_membership",
  "manage_shipping",
  "manage_orders",
  "manage_settings",
]);

const MANAGER_PERMISSION_LABELS = Object.freeze({
  manage_users: "User management",
  view_analytics: "Analytics dashboards",
  manage_crm: "CRM and campaigns",
  manage_membership: "Membership operations",
  manage_shipping: "Shipping operations",
  manage_orders: "Order status updates",
  manage_settings: "Platform settings",
});

const MANAGER_PERMISSION_KEY_SET = new Set(MANAGER_PERMISSION_KEYS);

const normalizeManagerPermissions = (permissions) => {
  if (!Array.isArray(permissions)) return [];

  return Array.from(
    new Set(
      permissions
        .map((permission) => String(permission || "").trim())
        .filter((permission) => MANAGER_PERMISSION_KEY_SET.has(permission)),
    ),
  );
};

const isValidManagerPermission = (permission) =>
  MANAGER_PERMISSION_KEY_SET.has(String(permission || "").trim());

const hasManagerPermission = (user, permission) => {
  const normalizedPermission = String(permission || "").trim();
  if (!normalizedPermission) return false;

  const permissions = normalizeManagerPermissions(user?.managerPermissions);
  return permissions.includes(normalizedPermission);
};

export {
  hasManagerPermission,
  isValidManagerPermission,
  MANAGER_PERMISSION_KEYS,
  MANAGER_PERMISSION_LABELS,
  normalizeManagerPermissions,
};
