export const MANAGER_PERMISSION_OPTIONS = [
  {
    key: "manage_users",
    label: "User management",
    description: "View users and update user status/deletion controls",
  },
  {
    key: "view_analytics",
    label: "Analytics dashboards",
    description: "Access analytics and behavior dashboards",
  },
  {
    key: "manage_crm",
    label: "CRM and campaigns",
    description: "Manage CRM contacts and WhatsApp campaigns",
  },
  {
    key: "manage_membership",
    label: "Membership operations",
    description: "Manage membership users, conversions, and points",
  },
  {
    key: "manage_shipping",
    label: "Shipping operations",
    description: "Run shipment booking and tracking operations",
  },
  {
    key: "manage_orders",
    label: "Order status updates",
    description: "Update order statuses from the admin orders table",
  },
  {
    key: "manage_settings",
    label: "Platform settings",
    description: "Manage platform configuration and settings",
  },
];

export const MANAGER_PERMISSION_KEYS = MANAGER_PERMISSION_OPTIONS.map(
  (option) => option.key,
);

const MANAGER_PERMISSION_KEY_SET = new Set(MANAGER_PERMISSION_KEYS);

const normalizeRole = (role) =>
  String(role || "")
    .trim()
    .toLowerCase();

export const normalizeManagerPermissions = (permissions) => {
  if (!Array.isArray(permissions)) return [];

  return Array.from(
    new Set(
      permissions
        .map((permission) => String(permission || "").trim())
        .filter((permission) => MANAGER_PERMISSION_KEY_SET.has(permission)),
    ),
  );
};

export const hasAdminPermission = (admin, permission) => {
  const role = normalizeRole(admin?.role);
  if (role === "admin") return true;
  if (role !== "manager") return false;

  const normalizedPermission = String(permission || "").trim();
  if (!normalizedPermission) return false;

  return normalizeManagerPermissions(admin?.managerPermissions).includes(
    normalizedPermission,
  );
};
