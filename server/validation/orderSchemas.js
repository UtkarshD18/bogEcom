import { z } from "zod";

const allowedStatuses = [
  "pending",
  "pending_payment",
  "accepted",
  "in_warehouse",
  "shipped",
  "out_for_delivery",
  "delivered",
  "completed",
  "cancelled",
  "rto",
  "rto_completed",
  "confirmed",
];

export const orderIdParamSchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid order ID"),
});

export const userOrderIdParamSchema = z.object({
  orderId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid order ID"),
});

export const updateOrderStatusSchema = z.object({
  order_status: z
    .string()
    .trim()
    .transform((value) => value.toLowerCase().replace(/\s+/g, "_"))
    .refine((value) => allowedStatuses.includes(value), {
      message: "Invalid order status",
    }),
  notes: z
    .string()
    .trim()
    .max(500, "Notes cannot exceed 500 characters")
    .optional()
    .nullable(),
});
