import crypto from "node:crypto";
import fs from "node:fs";
import mongoose from "mongoose";
import path from "node:path";
import PDFDocument from "pdfkit";
import Category from "../models/category.model.js";
import Partner from "../models/partner.model.js";
import PartnerApiKey from "../models/partnerApiKey.model.js";
import Product from "../models/product.model.js";

const SITE_URL =
  String(process.env.NEXT_PUBLIC_SITE_URL || process.env.CLIENT_URL || "https://healthyonegram.com")
    .split(",")[0]
    .trim()
    .replace(/\/+$/, "") || "https://healthyonegram.com";

const SUPPORT_EMAIL = String(
  process.env.SUPPORT_EMAIL || process.env.CONTACT_EMAIL || "support@healthyonegram.com",
)
  .trim()
  .toLowerCase();

const SUPPORT_PHONE = String(
  process.env.SUPPORT_PHONE || process.env.CONTACT_PHONE || "+91-00000-00000",
).trim();

const resolvePartnerGuideLogoPath = () => {
  const cwd = process.cwd();
  const candidates = [
    path.resolve(cwd, "frontend", "admin", "public", "logo.png"),
    path.resolve(cwd, "frontend", "client", "public", "logo.png"),
    path.resolve(cwd, "..", "frontend", "admin", "public", "logo.png"),
    path.resolve(cwd, "..", "frontend", "client", "public", "logo.png"),
    path.resolve(cwd, "frontend", "admin", "public", "logo-og-v2.png"),
    path.resolve(cwd, "frontend", "client", "public", "logo-og-v2.png"),
    path.resolve(cwd, "..", "frontend", "admin", "public", "logo-og-v2.png"),
    path.resolve(cwd, "..", "frontend", "client", "public", "logo-og-v2.png"),
  ];

  return candidates.find((filePath) => fs.existsSync(filePath)) || null;
};

const hashApiKey = (value) =>
  crypto.createHash("sha256").update(String(value || "")).digest("hex");

const createApiKey = () => {
  const prefix = `hogp_${crypto.randomBytes(4).toString("hex")}`;
  const secret = crypto.randomBytes(24).toString("hex");
  const apiKey = `${prefix}.${secret}`;
  return {
    apiKey,
    keyPrefix: prefix,
    keyHash: hashApiKey(apiKey),
  };
};

const parseBoolean = (value, fallback = undefined) => {
  if (value === undefined || value === null || value === "") return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (["true", "1", "yes", "on"].includes(normalized)) return true;
  if (["false", "0", "no", "off"].includes(normalized)) return false;
  return fallback;
};

const parseNumber = (value, fallback) => {
  const number = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(number) ? number : fallback;
};

const escapeRegex = (value = "") =>
  String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const getAvailableStock = (product) => {
  const directStock = Number(product?.stock_quantity ?? product?.stock ?? 0);
  const directReserved = Number(product?.reserved_quantity ?? 0);
  const directAvailable = Math.max(directStock - directReserved, 0);

  const variants = Array.isArray(product?.variants) ? product.variants : [];
  const variantAvailable = variants.reduce((sum, variant) => {
    const stock = Number(variant?.stock_quantity ?? variant?.stock ?? 0);
    const reserved = Number(variant?.reserved_quantity ?? 0);
    return sum + Math.max(stock - reserved, 0);
  }, 0);

  if (variantAvailable > 0) return variantAvailable;
  return Math.max(directAvailable, 0);
};

const mapPartnerProduct = (product) => {
  const availableQuantity = getAvailableStock(product);
  const discountedAmount = Number(product?.price || 0);
  const originalAmount = Number(product?.originalPrice || discountedAmount || 0);
  const discountValue = Number(product?.discount || 0);

  return {
    id: String(product._id),
    sku: String(product.sku || "").trim() || null,
    name: product.name,
    description: product.description || "",
    shortDescription: product.shortDescription || "",
    images: Array.isArray(product.images) ? product.images.filter(Boolean) : [],
    productUrl: `${SITE_URL}/product/${String(product._id)}`,
    category: product.category
      ? {
          id: String(product.category._id || ""),
          name: product.category.name || "",
          slug: product.category.slug || "",
        }
      : null,
    tags: Array.isArray(product.tags) ? product.tags : [],
    price: {
      amount: discountedAmount,
      currency: "INR",
      originalAmount,
    },
    discount: {
      type: "percentage",
      value: discountValue,
    },
    stock: {
      status: availableQuantity > 0 ? "in_stock" : "out_of_stock",
      availableQuantity,
    },
    shipping: {
      freeShipping: discountedAmount >= 499,
      estimatedDispatchDays: availableQuantity > 0 ? 1 : 3,
    },
    updatedAt: product.updatedAt,
  };
};

const withMeta = (req, payload) => ({
  ...payload,
  meta: {
    requestId: req.requestId || crypto.randomBytes(6).toString("hex"),
    version: "v1",
    partnerId: req.partner ? String(req.partner._id) : undefined,
  },
});

const buildDeterministicEtagPayload = (bodyObject) => {
  if (!bodyObject || typeof bodyObject !== "object") return bodyObject;

  const cloned = {
    ...bodyObject,
    meta: bodyObject.meta
      ? {
          ...bodyObject.meta,
          requestId: undefined,
        }
      : undefined,
  };

  return cloned;
};

const setEtagAndHandle304 = (req, res, bodyObject) => {
  const etagBasis = buildDeterministicEtagPayload(bodyObject);
  const etag = `W/\"${hashApiKey(JSON.stringify(etagBasis)).slice(0, 16)}\"`;
  res.setHeader("ETag", etag);
  if (req.headers["if-none-match"] === etag) {
    res.status(304).end();
    return true;
  }
  return false;
};

const getPartnerGuideDetails = (req) => {
  const baseUrl = `${req.protocol}://${req.get("host")}/api/v1/partner`;
  const authModes = [
    {
      type: "header",
      header: "x-api-key",
      valueExample: "hogp_xxxxxxxx.yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy",
    },
    {
      type: "bearer",
      header: "Authorization",
      valueExample: "Bearer hogp_xxxxxxxx.yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy",
    },
  ];

  const endpoints = [
    {
      method: "GET",
      path: "/health",
      fullUrl: `${baseUrl}/health`,
      scope: "none",
      description: "API/key health check",
    },
    {
      method: "GET",
      path: "/products",
      fullUrl: `${baseUrl}/products?limit=20&page=1`,
      scope: "catalog.read",
      description: "List products",
    },
    {
      method: "GET",
      path: "/products/:productId",
      fullUrl: `${baseUrl}/products/PRODUCT_ID_OR_SLUG`,
      scope: "catalog.read",
      description: "Get one product",
    },
    {
      method: "GET",
      path: "/inventory",
      fullUrl: `${baseUrl}/inventory?inStock=true`,
      scope: "inventory.read",
      description: "Inventory snapshot",
    },
    {
      method: "GET",
      path: "/pricing",
      fullUrl: `${baseUrl}/pricing`,
      scope: "price.read",
      description: "Current prices and discounts",
    },
    {
      method: "GET",
      path: "/categories",
      fullUrl: `${baseUrl}/categories`,
      scope: "catalog.read",
      description: "Category list",
    },
    {
      method: "GET",
      path: "/tags",
      fullUrl: `${baseUrl}/tags`,
      scope: "catalog.read",
      description: "Tag list",
    },
  ];

  const sampleCurl = `curl -X GET \"${baseUrl}/products?limit=20\" -H \"x-api-key: YOUR_PARTNER_API_KEY\"`;

  return {
    baseUrl,
    authModes,
    endpoints,
    sampleCurl,
  };
};

const buildPartnerGuidePdfBuffer = ({ baseUrl, endpoints, sampleCurl }) =>
  new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 42 });
    const chunks = [];
    const logoPath = resolvePartnerGuideLogoPath();

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

    doc.rect(42, 42, pageWidth, 64).fill("#0f172a");

    if (logoPath) {
      try {
        doc.image(logoPath, 52, 52, {
          fit: [34, 34],
          align: "left",
        });
      } catch {
      }
    }

    doc
      .fillColor("#ffffff")
      .font("Helvetica-Bold")
      .fontSize(18)
      .text("HealthyOneGram Partner API", logoPath ? 94 : 56, 58);
    doc
      .font("Helvetica")
      .fontSize(10)
      .text("Share this PDF with partners for direct API integration", logoPath ? 94 : 56, 82);

    doc.moveDown(4.8);
    doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(12).text("Base URL");
    doc
      .moveDown(0.3)
      .font("Helvetica")
      .fontSize(10)
      .fillColor("#334155")
      .text(baseUrl, {
        width: pageWidth,
      });

    doc.moveDown(0.8);
    doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(12).text("Authentication");
    doc
      .moveDown(0.3)
      .font("Helvetica")
      .fontSize(10)
      .fillColor("#334155")
      .text("1) x-api-key: YOUR_PARTNER_API_KEY")
      .text("2) Authorization: Bearer YOUR_PARTNER_API_KEY");

    doc.moveDown(0.8);
    doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(12).text("Endpoints");

    const startX = doc.page.margins.left;
    const tableWidth = pageWidth;
    const rowHeight = 20;
    const colWidths = [60, 180, 110, tableWidth - 60 - 180 - 110];

    let y = doc.y + 8;
    doc.rect(startX, y, tableWidth, rowHeight).fill("#e2e8f0");
    doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(9);
    doc.text("Method", startX + 6, y + 6, { width: colWidths[0] - 8 });
    doc.text("Path", startX + colWidths[0] + 6, y + 6, { width: colWidths[1] - 8 });
    doc.text("Scope", startX + colWidths[0] + colWidths[1] + 6, y + 6, { width: colWidths[2] - 8 });
    doc.text("Description", startX + colWidths[0] + colWidths[1] + colWidths[2] + 6, y + 6, { width: colWidths[3] - 8 });

    y += rowHeight;
    doc.font("Helvetica").fontSize(8.8);

    endpoints.forEach((item, index) => {
      if (y > doc.page.height - 90) {
        doc.addPage();
        y = doc.page.margins.top;
      }

      doc.rect(startX, y, tableWidth, rowHeight).fill(index % 2 === 0 ? "#ffffff" : "#f8fafc");
      doc.fillColor("#0f172a");
      doc.text(item.method, startX + 6, y + 6, { width: colWidths[0] - 8 });
      doc.text(item.path, startX + colWidths[0] + 6, y + 6, { width: colWidths[1] - 8 });
      doc.text(item.scope, startX + colWidths[0] + colWidths[1] + 6, y + 6, { width: colWidths[2] - 8 });
      doc.text(item.description, startX + colWidths[0] + colWidths[1] + colWidths[2] + 6, y + 6, { width: colWidths[3] - 8 });
      y += rowHeight;
    });

    doc.y = y + 12;
    doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(12).text("Sample cURL");
    doc.moveDown(0.25);
    doc.rect(startX, doc.y, tableWidth, 46).fill("#0f172a");
    doc.fillColor("#e2e8f0").font("Helvetica").fontSize(9);
    doc.text(sampleCurl, startX + 8, doc.y + 14, { width: tableWidth - 16 });

    doc.moveDown(3.2);
    doc.fillColor("#64748b").font("Helvetica").fontSize(8.5).text(
      `Generated on ${new Date().toLocaleString("en-IN")} • Guide URL: ${baseUrl}/guide • Support: ${SUPPORT_EMAIL} • ${SUPPORT_PHONE}`,
      startX,
      doc.y,
      { width: tableWidth },
    );

    doc.end();
  });

export const partnerHealth = async (req, res) => {
  return res.status(200).json(
    withMeta(req, {
      success: true,
      data: {
        status: "ok",
        service: "partner-api",
      },
    }),
  );
};

export const getPartnerApiGuide = async (req, res) => {
  const { baseUrl, authModes, endpoints, sampleCurl } = getPartnerGuideDetails(req);

  const payload = {
    success: true,
    data: {
      title: "HealthyOneGram Partner API Guide",
      version: "v1",
      baseUrl,
      authentication: authModes,
      endpoints,
      sampleCurl,
      notes: [
        "All responses are JSON and include success/data or success/error envelopes.",
        "Use If-None-Match with returned ETag for cache-friendly polling on product endpoints.",
      ],
    },
  };

  const format = String(req.query?.format || "").trim().toLowerCase();
  if (format === "json") {
    return res.status(200).json(payload);
  }
  if (format === "pdf") {
    try {
      const pdfBuffer = await buildPartnerGuidePdfBuffer({ baseUrl, endpoints, sampleCurl });
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", 'inline; filename="healthyonegram-partner-api-guide.pdf"');
      return res.status(200).send(pdfBuffer);
    } catch (error) {
      console.error("Partner API guide PDF generation error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to generate partner API PDF guide",
      });
    }
  }

  const endpointRows = endpoints
    .map(
      (item) => `
        <tr>
          <td style=\"padding:10px;border:1px solid #e5e7eb;white-space:nowrap;font-weight:600;\">${item.method}</td>
          <td style=\"padding:10px;border:1px solid #e5e7eb;\">${item.path}</td>
          <td style=\"padding:10px;border:1px solid #e5e7eb;\">${item.scope}</td>
          <td style=\"padding:10px;border:1px solid #e5e7eb;\">${item.description}</td>
        </tr>`,
    )
    .join("");

  const html = `<!doctype html>
<html>
  <head>
    <meta charset=\"utf-8\" />
    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />
    <title>HealthyOneGram Partner API Guide</title>
  </head>
  <body style=\"margin:0;padding:24px;background:#f8fafc;font-family:Arial,sans-serif;color:#0f172a;\">
    <div style=\"max-width:980px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:14px;padding:22px;\">
      <h1 style=\"margin:0 0 8px;font-size:26px;\">HealthyOneGram Partner API Guide</h1>
      <p style=\"margin:0 0 16px;color:#475569;\">Version v1 • Share this link with partners.</p>

      <div style=\"padding:12px;background:#f1f5f9;border-radius:10px;margin-bottom:16px;\">
        <div style=\"font-size:12px;color:#64748b;margin-bottom:6px;\">Base URL</div>
        <div style=\"font-family:Consolas,monospace;font-size:13px;word-break:break-all;\">${baseUrl}</div>
      </div>

      <h2 style=\"margin:16px 0 8px;font-size:18px;\">Authentication</h2>
      <ul style=\"margin:0 0 12px 18px;padding:0;color:#334155;\">
        <li>Header: <code>x-api-key: YOUR_PARTNER_API_KEY</code></li>
        <li>Or Bearer: <code>Authorization: Bearer YOUR_PARTNER_API_KEY</code></li>
      </ul>

      <h2 style=\"margin:16px 0 8px;font-size:18px;\">Endpoints</h2>
      <table style=\"width:100%;border-collapse:collapse;font-size:14px;\">
        <thead>
          <tr style=\"background:#f8fafc;\">
            <th style=\"text-align:left;padding:10px;border:1px solid #e5e7eb;\">Method</th>
            <th style=\"text-align:left;padding:10px;border:1px solid #e5e7eb;\">Path</th>
            <th style=\"text-align:left;padding:10px;border:1px solid #e5e7eb;\">Scope</th>
            <th style=\"text-align:left;padding:10px;border:1px solid #e5e7eb;\">Description</th>
          </tr>
        </thead>
        <tbody>${endpointRows}</tbody>
      </table>

      <h2 style=\"margin:16px 0 8px;font-size:18px;\">Sample cURL</h2>
      <pre style=\"background:#0f172a;color:#e2e8f0;padding:12px;border-radius:10px;overflow:auto;\">${sampleCurl}</pre>

      <p style=\"margin-top:14px;font-size:12px;color:#64748b;\">JSON format of this guide: <a href=\"${baseUrl}/guide?format=json\">${baseUrl}/guide?format=json</a></p>
        <p style="margin-top:6px;font-size:12px;color:#64748b;">PDF format: <a href="${baseUrl}/guide.pdf">${baseUrl}/guide.pdf</a></p>
        <p style="margin-top:6px;font-size:12px;color:#64748b;">Support: ${SUPPORT_EMAIL} • ${SUPPORT_PHONE}</p>
    </div>
  </body>
</html>`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  return res.status(200).send(html);
};

export const getPartnerApiGuidePdf = async (req, res) => {
  try {
    const { baseUrl, endpoints, sampleCurl } = getPartnerGuideDetails(req);
    const pdfBuffer = await buildPartnerGuidePdfBuffer({ baseUrl, endpoints, sampleCurl });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'attachment; filename="healthyonegram-partner-api-guide.pdf"');
    return res.status(200).send(pdfBuffer);
  } catch (error) {
    console.error("getPartnerApiGuidePdf error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to generate partner API PDF guide",
    });
  }
};

export const getPartnerProducts = async (req, res) => {
  try {
    const page = Math.max(parseNumber(req.query.page, 1), 1);
    const limit = Math.min(Math.max(parseNumber(req.query.limit, 20), 1), 100);
    const skip = (page - 1) * limit;

    const query = { isActive: true };

    const q = String(req.query.q || "").trim();
    if (q) {
      const regex = new RegExp(escapeRegex(q), "i");
      query.$or = [{ name: regex }, { description: regex }, { shortDescription: regex }];
    }

    const tag = String(req.query.tag || "").trim();
    if (tag) {
      query.tags = { $in: [tag] };
    }

    const category = String(req.query.category || "").trim();
    if (category) {
      if (mongoose.Types.ObjectId.isValid(category)) {
        query.category = category;
      } else {
        const matchedCategory = await Category.findOne({ slug: category, isActive: true })
          .select("_id")
          .lean();
        if (matchedCategory?._id) {
          query.category = matchedCategory._id;
        }
      }
    }

    const inStock = parseBoolean(req.query.inStock);
    if (inStock === true) {
      query.$or = [...(query.$or || []), { stock_quantity: { $gt: 0 } }, { stock: { $gt: 0 } }];
    }

    const updatedSince = String(req.query.updatedSince || "").trim();
    if (updatedSince) {
      const date = new Date(updatedSince);
      if (!Number.isNaN(date.getTime())) {
        query.updatedAt = { $gte: date };
      }
    }

    const sortMap = {
      updatedAt_desc: { updatedAt: -1 },
      updatedAt_asc: { updatedAt: 1 },
      price_asc: { price: 1 },
      price_desc: { price: -1 },
      name_asc: { name: 1 },
    };
    const sort = sortMap[String(req.query.sort || "").trim()] || { updatedAt: -1 };

    const [items, total] = await Promise.all([
      Product.find(query)
        .populate("category", "name slug")
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      Product.countDocuments(query),
    ]);

    const data = items.map(mapPartnerProduct);
    const body = withMeta(req, {
      success: true,
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(Math.ceil(total / limit), 1),
      },
    });

    if (setEtagAndHandle304(req, res, body)) return;

    return res.status(200).json(body);
  } catch (error) {
    console.error("getPartnerProducts error:", error);
    return res.status(500).json(
      withMeta(req, {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to fetch products",
          details: null,
        },
      }),
    );
  }
};

export const getPartnerProductById = async (req, res) => {
  try {
    const id = String(req.params.productId || "").trim();
    const query = { isActive: true };
    if (mongoose.Types.ObjectId.isValid(id)) {
      query._id = id;
    } else {
      query.slug = id;
    }

    const product = await Product.findOne(query)
      .populate("category", "name slug")
      .lean();

    if (!product) {
      return res.status(404).json(
        withMeta(req, {
          success: false,
          error: {
            code: "NOT_FOUND",
            message: "Product not found",
            details: null,
          },
        }),
      );
    }

    const body = withMeta(req, {
      success: true,
      data: mapPartnerProduct(product),
    });

    if (setEtagAndHandle304(req, res, body)) return;

    return res.status(200).json(body);
  } catch (error) {
    console.error("getPartnerProductById error:", error);
    return res.status(500).json(
      withMeta(req, {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to fetch product",
          details: null,
        },
      }),
    );
  }
};

export const getPartnerInventory = async (req, res) => {
  try {
    const page = Math.max(parseNumber(req.query.page, 1), 1);
    const limit = Math.min(Math.max(parseNumber(req.query.limit, 20), 1), 100);
    const skip = (page - 1) * limit;

    const query = { isActive: true };

    const productId = String(req.query.productId || "").trim();
    if (productId) {
      if (mongoose.Types.ObjectId.isValid(productId)) {
        query._id = productId;
      } else {
        query.slug = productId;
      }
    }

    const sku = String(req.query.sku || "").trim();
    if (sku) {
      query.sku = sku.toUpperCase();
    }

    const inStock = parseBoolean(req.query.inStock);
    if (inStock === true) {
      query.$or = [{ stock_quantity: { $gt: 0 } }, { stock: { $gt: 0 } }];
    }

    const [items, total] = await Promise.all([
      Product.find(query)
        .select("_id sku stock stock_quantity reserved_quantity updatedAt")
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Product.countDocuments(query),
    ]);

    const data = items.map((item) => {
      const availableQuantity = getAvailableStock(item);
      return {
        productId: String(item._id),
        sku: String(item.sku || "").trim() || null,
        stock: {
          status: availableQuantity > 0 ? "in_stock" : "out_of_stock",
          availableQuantity,
        },
        updatedAt: item.updatedAt,
      };
    });

    return res.status(200).json(
      withMeta(req, {
        success: true,
        data,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.max(Math.ceil(total / limit), 1),
        },
      }),
    );
  } catch (error) {
    console.error("getPartnerInventory error:", error);
    return res.status(500).json(
      withMeta(req, {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to fetch inventory",
          details: null,
        },
      }),
    );
  }
};

export const getPartnerPricing = async (req, res) => {
  try {
    const query = { isActive: true };

    const productId = String(req.query.productId || "").trim();
    if (productId) {
      if (mongoose.Types.ObjectId.isValid(productId)) {
        query._id = productId;
      } else {
        query.slug = productId;
      }
    }

    const sku = String(req.query.sku || "").trim();
    if (sku) {
      query.sku = sku.toUpperCase();
    }

    const items = await Product.find(query)
      .select("_id sku price originalPrice discount updatedAt")
      .sort({ updatedAt: -1 })
      .limit(200)
      .lean();

    const data = items.map((item) => ({
      productId: String(item._id),
      sku: String(item.sku || "").trim() || null,
      price: {
        amount: Number(item.price || 0),
        currency: "INR",
        originalAmount: Number(item.originalPrice || item.price || 0),
      },
      discount: {
        type: "percentage",
        value: Number(item.discount || 0),
      },
      updatedAt: item.updatedAt,
    }));

    return res.status(200).json(withMeta(req, { success: true, data }));
  } catch (error) {
    console.error("getPartnerPricing error:", error);
    return res.status(500).json(
      withMeta(req, {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to fetch pricing",
          details: null,
        },
      }),
    );
  }
};

export const getPartnerCategories = async (req, res) => {
  try {
    const categories = await Category.find({ isActive: true })
      .select("_id name slug parentCategory")
      .sort({ sortOrder: 1, name: 1 })
      .lean();

    const data = categories.map((item) => ({
      id: String(item._id),
      name: item.name,
      slug: item.slug,
      parentCategoryId: item.parentCategory ? String(item.parentCategory) : null,
    }));

    return res.status(200).json(withMeta(req, { success: true, data }));
  } catch (error) {
    console.error("getPartnerCategories error:", error);
    return res.status(500).json(
      withMeta(req, {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to fetch categories",
          details: null,
        },
      }),
    );
  }
};

export const getPartnerTags = async (req, res) => {
  try {
    const tags = await Product.distinct("tags", { isActive: true });
    const cleanTags = tags
      .map((tag) => String(tag || "").trim())
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));

    return res.status(200).json(withMeta(req, { success: true, data: cleanTags }));
  } catch (error) {
    console.error("getPartnerTags error:", error);
    return res.status(500).json(
      withMeta(req, {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to fetch tags",
          details: null,
        },
      }),
    );
  }
};

export const adminCreatePartner = async (req, res) => {
  try {
    const name = String(req.body?.name || "").trim();
    const contactEmail = String(req.body?.contactEmail || "").trim().toLowerCase();

    if (!name || !contactEmail) {
      return res.status(400).json({
        success: false,
        message: "name and contactEmail are required",
      });
    }

    const partner = await Partner.create({
      name,
      contactEmail,
      status: "active",
      scopes: Array.isArray(req.body?.scopes) && req.body.scopes.length
        ? req.body.scopes
        : ["catalog.read", "inventory.read", "price.read"],
      rateLimitPerMinute: parseNumber(req.body?.rateLimitPerMinute, 120),
      allowedOrigins: Array.isArray(req.body?.allowedOrigins) ? req.body.allowedOrigins : [],
      notes: String(req.body?.notes || "").trim(),
    });

    const generated = createApiKey();
    await PartnerApiKey.create({
      partnerId: partner._id,
      keyPrefix: generated.keyPrefix,
      keyHash: generated.keyHash,
      status: "active",
      expiresAt: null,
    });

    return res.status(201).json({
      success: true,
      message: "Partner created",
      data: {
        partner: {
          id: String(partner._id),
          name: partner.name,
          contactEmail: partner.contactEmail,
          status: partner.status,
          scopes: partner.scopes,
          rateLimitPerMinute: partner.rateLimitPerMinute,
        },
        apiKey: generated.apiKey,
      },
    });
  } catch (error) {
    console.error("adminCreatePartner error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create partner",
    });
  }
};

export const adminListPartners = async (_req, res) => {
  try {
    const partners = await Partner.find({}).sort({ createdAt: -1 }).lean();

    const ids = partners.map((p) => p._id);
    const keys = await PartnerApiKey.find({
      partnerId: { $in: ids },
      status: "active",
    })
      .select("partnerId keyPrefix lastUsedAt createdAt")
      .lean();

    const keyByPartner = new Map(keys.map((item) => [String(item.partnerId), item]));

    return res.status(200).json({
      success: true,
      data: partners.map((partner) => {
        const key = keyByPartner.get(String(partner._id));
        return {
          id: String(partner._id),
          name: partner.name,
          contactEmail: partner.contactEmail,
          status: partner.status,
          scopes: partner.scopes,
          rateLimitPerMinute: partner.rateLimitPerMinute,
          keyPrefix: key?.keyPrefix || null,
          keyCreatedAt: key?.createdAt || null,
          keyLastUsedAt: key?.lastUsedAt || null,
          createdAt: partner.createdAt,
        };
      }),
    });
  } catch (error) {
    console.error("adminListPartners error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to list partners",
    });
  }
};

export const adminExportPartnersCsv = async (_req, res) => {
  try {
    const partners = await Partner.find({}).sort({ createdAt: -1 }).lean();

    const ids = partners.map((p) => p._id);
    const keys = await PartnerApiKey.find({
      partnerId: { $in: ids },
      status: "active",
    })
      .select("partnerId keyPrefix lastUsedAt createdAt")
      .lean();

    const keyByPartner = new Map(keys.map((item) => [String(item.partnerId), item]));

    const csvEscape = (value) => {
      const text = String(value ?? "");
      if (/[",\n]/.test(text)) {
        return `"${text.replace(/"/g, '""')}"`;
      }
      return text;
    };

    const headers = [
      "partnerId",
      "name",
      "contactEmail",
      "status",
      "scopes",
      "rateLimitPerMinute",
      "keyPrefix",
      "keyCreatedAt",
      "keyLastUsedAt",
      "createdAt",
    ];

    const rows = partners.map((partner) => {
      const key = keyByPartner.get(String(partner._id));
      return [
        String(partner._id),
        partner.name || "",
        partner.contactEmail || "",
        partner.status || "",
        Array.isArray(partner.scopes) ? partner.scopes.join("|") : "",
        String(partner.rateLimitPerMinute ?? ""),
        key?.keyPrefix || "",
        key?.createdAt ? new Date(key.createdAt).toISOString() : "",
        key?.lastUsedAt ? new Date(key.lastUsedAt).toISOString() : "",
        partner.createdAt ? new Date(partner.createdAt).toISOString() : "",
      ].map(csvEscape).join(",");
    });

    const csv = [headers.join(","), ...rows].join("\n");
    const fileName = `partner-api-partners-${new Date().toISOString().slice(0, 10)}.csv`;

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename=\"${fileName}\"`);
    return res.status(200).send(csv);
  } catch (error) {
    console.error("adminExportPartnersCsv error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to export partners CSV",
    });
  }
};

export const adminRotatePartnerKey = async (req, res) => {
  try {
    const partnerId = String(req.params?.partnerId || "").trim();
    const partner = await Partner.findById(partnerId);

    if (!partner) {
      return res.status(404).json({ success: false, message: "Partner not found" });
    }

    await PartnerApiKey.updateMany(
      { partnerId: partner._id, status: "active" },
      { $set: { status: "revoked" } },
    );

    const generated = createApiKey();
    await PartnerApiKey.create({
      partnerId: partner._id,
      keyPrefix: generated.keyPrefix,
      keyHash: generated.keyHash,
      status: "active",
      expiresAt: null,
    });

    return res.status(200).json({
      success: true,
      message: "Partner API key rotated",
      data: {
        partnerId: String(partner._id),
        apiKey: generated.apiKey,
      },
    });
  } catch (error) {
    console.error("adminRotatePartnerKey error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to rotate partner key",
    });
  }
};

export const adminUpdatePartner = async (req, res) => {
  try {
    const partnerId = String(req.params?.partnerId || "").trim();

    const update = {};
    if (req.body?.name !== undefined) update.name = String(req.body.name || "").trim();
    if (req.body?.contactEmail !== undefined) {
      update.contactEmail = String(req.body.contactEmail || "").trim().toLowerCase();
    }
    if (req.body?.status !== undefined) {
      const status = String(req.body.status || "").trim().toLowerCase();
      if (["active", "paused"].includes(status)) update.status = status;
    }
    if (req.body?.scopes !== undefined && Array.isArray(req.body.scopes)) {
      update.scopes = req.body.scopes;
    }
    if (req.body?.rateLimitPerMinute !== undefined) {
      update.rateLimitPerMinute = Math.min(Math.max(parseNumber(req.body.rateLimitPerMinute, 120), 10), 5000);
    }
    if (req.body?.allowedOrigins !== undefined && Array.isArray(req.body.allowedOrigins)) {
      update.allowedOrigins = req.body.allowedOrigins;
    }

    const partner = await Partner.findByIdAndUpdate(
      partnerId,
      { $set: update },
      { new: true },
    ).lean();

    if (!partner) {
      return res.status(404).json({ success: false, message: "Partner not found" });
    }

    return res.status(200).json({
      success: true,
      message: "Partner updated",
      data: {
        id: String(partner._id),
        name: partner.name,
        contactEmail: partner.contactEmail,
        status: partner.status,
        scopes: partner.scopes,
        rateLimitPerMinute: partner.rateLimitPerMinute,
      },
    });
  } catch (error) {
    console.error("adminUpdatePartner error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update partner",
    });
  }
};

export const adminDeletePartner = async (req, res) => {
  try {
    const partnerId = String(req.params?.partnerId || "").trim();

    const partner = await Partner.findById(partnerId).lean();
    if (!partner) {
      return res.status(404).json({
        success: false,
        message: "Partner not found",
      });
    }

    await Promise.all([
      Partner.deleteOne({ _id: partnerId }),
      PartnerApiKey.deleteMany({ partnerId }),
    ]);

    return res.status(200).json({
      success: true,
      message: "Partner deleted",
      data: {
        id: partnerId,
        name: partner.name,
      },
    });
  } catch (error) {
    console.error("adminDeletePartner error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete partner",
    });
  }
};
