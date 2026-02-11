import { z } from "zod";

export const inventoryAuditQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const inventoryAuditProductParamSchema = z.object({
  productId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid product ID"),
});
