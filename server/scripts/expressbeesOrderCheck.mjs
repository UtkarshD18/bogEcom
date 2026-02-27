import fs from "fs/promises";
import path from "path";
import dotenv from "dotenv";
import mongoose from "mongoose";

import connectDb from "../config/connectDb.js";
import AddressModel from "../models/address.model.js";
import "../models/influencer.model.js";
import OrderModel from "../models/order.model.js";
import ProductModel from "../models/product.model.js";
import UserModel from "../models/user.model.js";
import { autoCreateShipmentForPaidOrder } from "../services/automatedShipping.service.js";
import {
  cancelShipment,
  checkServiceability,
  createManifest,
} from "../services/xpressbees.service.js";
import { generateInvoicePdf } from "../utils/generateInvoicePdf.js";

dotenv.config();

const round2 = (value) =>
  Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

const timestampTag = () =>
  new Date().toISOString().replace(/[:.]/g, "-");

const redactError = (error) => ({
  message: error?.message || String(error),
  status: error?.status || null,
  data: error?.data || null,
});

const sanitizeServiceability = (response) => {
  const list = Array.isArray(response?.data) ? response.data : [];
  return list.map((entry) => ({
    id: entry?.id || null,
    name: entry?.name || null,
    freight_charges: Number(entry?.freight_charges || 0),
    total_charges: Number(entry?.total_charges || 0),
    min_weight: Number(entry?.min_weight || 0),
    chargeable_weight: Number(entry?.chargeable_weight || 0),
  }));
};

const safeWriteJson = async (filePath, payload) => {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(payload, null, 2), "utf8");
};

const resolveSellerDetails = () => ({
  name: process.env.INVOICE_SELLER_NAME || process.env.BUSINESS_NAME || "BuyOneGram",
  gstin: process.env.INVOICE_SELLER_GSTIN || "",
  address: process.env.INVOICE_SELLER_ADDRESS || "",
  state: process.env.INVOICE_SELLER_STATE || "",
  stateCode: process.env.INVOICE_SELLER_STATE_CODE || "",
  cin: process.env.INVOICE_SELLER_CIN || "",
  msme: process.env.INVOICE_SELLER_MSME || "",
  fssai: process.env.INVOICE_SELLER_FSSAI || "",
  phone: process.env.INVOICE_SELLER_PHONE || "",
  email: process.env.INVOICE_SELLER_EMAIL || "",
  logoPath: process.env.INVOICE_LOGO_PATH || "",
  currencySymbol: process.env.INVOICE_CURRENCY_SYMBOL || "Rs. ",
  bankName: process.env.INVOICE_BANK_NAME || "ICICI BANK LIMITED",
  bankAccount: process.env.INVOICE_BANK_ACCOUNT || "731405000083",
  bankBranch: process.env.INVOICE_BANK_BRANCH || "SITAPURA",
  bankIfsc: process.env.INVOICE_BANK_IFSC || "ICIC0006748",
  declaration: process.env.INVOICE_DECLARATION || "",
  terms: process.env.INVOICE_TERMS || "",
  jurisdictionLine: process.env.INVOICE_JURISDICTION_LINE || "",
});

const toPhone = (value) => String(value || "").replace(/\D/g, "").slice(-10);

const toPincode = (value) => String(value || "").replace(/\D/g, "").slice(0, 6);

const parseManifestUrl = (payload) =>
  payload?.data?.manifest ||
  payload?.data?.manifest_url ||
  (typeof payload?.data === "string" ? payload.data : null) ||
  payload?.manifest ||
  null;

const setEnvIfMissing = (key, value) => {
  if (process.env[key] && String(process.env[key]).trim()) return;
  process.env[key] = String(value || "").trim();
};

const maybeDownloadFile = async ({ url, filePath }) => {
  if (!url) return { ok: false, reason: "URL_MISSING" };
  const response = await fetch(url);
  if (!response.ok) {
    return {
      ok: false,
      reason: `HTTP_${response.status}`,
    };
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, bytes);
  return { ok: true, bytes: bytes.length, filePath };
};

const run = async () => {
  const skipCancel =
    String(process.env.SKIP_CANCEL || "false").trim().toLowerCase() === "true";
  const runId = timestampTag();
  const artifactRoot = path.resolve(process.cwd(), "..", "test-artifacts", `expressbees-order-check-${runId}`);
  const reportPath = path.join(artifactRoot, "report.json");

  const report = {
    runId,
    startedAt: new Date().toISOString(),
    artifacts: {
      root: artifactRoot,
      reportPath,
    },
    order: null,
    invoice: null,
    shipping: {
      serviceability: null,
      booking: null,
      manifest: null,
      cancel: null,
    },
    conclusion: null,
    errors: [],
  };

  try {
    await fs.mkdir(artifactRoot, { recursive: true });
    await connectDb();

    const address = await AddressModel.findOne({
      pincode: /^\d{6}$/,
      mobile: { $exists: true, $ne: null },
    })
      .sort({ updatedAt: -1 })
      .lean();

    if (!address) {
      throw new Error("No valid address found to create test order");
    }

    const user = address.userId
      ? await UserModel.findById(address.userId)
          .select("name email mobile")
          .lean()
      : null;

    const product = await ProductModel.findOne({ price: { $gt: 0 } })
      .sort({ updatedAt: -1 })
      .lean();

    if (!product) {
      throw new Error("No purchasable product found for test order");
    }

    const quantity = 1;
    const price = round2(Number(product.price || 0));
    if (!Number.isFinite(price) || price <= 0) {
      throw new Error("Selected product has invalid price");
    }

    const subtotal = round2(price * quantity);
    const tax = round2(subtotal * 0.05);
    const shipping = 0;
    const finalAmount = round2(subtotal + tax + shipping);

    const billingDetails = {
      fullName: String(address.name || user?.name || "Test Customer").trim(),
      email: String(user?.email || "").trim().toLowerCase(),
      phone: toPhone(address.mobile || user?.mobile || "9876543210"),
      address: String(address.address_line1 || "Test Address").trim(),
      pincode: toPincode(address.pincode),
      state: String(address.state || "").trim(),
    };

    // Ensure pickup defaults align with the tax-invoice seller address.
    setEnvIfMissing("XPRESSBEES_PICKUP_WAREHOUSE", "BUY ONE GRAM PRIVATE LIMITED");
    setEnvIfMissing("XPRESSBEES_PICKUP_NAME", "BuyOneGram Dispatch");
    setEnvIfMissing(
      "XPRESSBEES_PICKUP_ADDRESS1",
      "G-225, RIICO INDUSTRIAL AREA SITAPURA, TONK ROAD",
    );
    setEnvIfMissing("XPRESSBEES_PICKUP_ADDRESS2", "JAIPUR-302022");
    setEnvIfMissing("XPRESSBEES_PICKUP_CITY", "Jaipur");
    setEnvIfMissing("XPRESSBEES_PICKUP_STATE", "Rajasthan");
    setEnvIfMissing("XPRESSBEES_PICKUP_PINCODE", "302022");
    setEnvIfMissing(
      "XPRESSBEES_PICKUP_PHONE",
      toPhone(process.env.INVOICE_SELLER_PHONE || "9876541234"),
    );

    const order = await OrderModel.create({
      user: user?._id || null,
      products: [
        {
          productId: String(product._id),
          productTitle: String(product.name || "Test Product").trim(),
          quantity,
          price,
          image: String(product.images?.[0] || product.thumbnail || "").trim(),
          subTotal: subtotal,
          // Force a small package for the weight verification test.
          weightGrams: 500,
        },
      ],
      totalAmt: finalAmount,
      subtotal,
      tax,
      shipping,
      finalAmount,
      payment_status: "paid",
      order_status: "accepted",
      statusTimeline: [
        { status: "pending", source: "EXPRESSBEES_TEST", timestamp: new Date() },
        { status: "accepted", source: "EXPRESSBEES_TEST", timestamp: new Date() },
      ],
      paymentMethod: "TEST",
      paymentId: `EXPRESSBEES_TEST_${Date.now()}`,
      originalPrice: subtotal,
      billingDetails,
      delivery_address: address._id,
      guestDetails: user
        ? undefined
        : {
            fullName: billingDetails.fullName,
            phone: billingDetails.phone,
            address: billingDetails.address,
            pincode: billingDetails.pincode,
            state: billingDetails.state,
            email: billingDetails.email,
          },
      notes: "Automated test order for Expressbees weight and charge validation",
      isDemoOrder: false,
    });

    report.order = {
      orderId: String(order._id),
      paymentStatus: order.payment_status,
      orderStatus: order.order_status,
      paymentId: order.paymentId,
      subtotal,
      tax,
      shipping,
      finalAmount,
      product: {
        productId: String(product._id),
        title: String(product.name || "Test Product"),
        quantity,
        unitPrice: price,
        weightGrams: 500,
      },
      billingDetails,
    };

    const generatedInvoice = await generateInvoicePdf({
      order,
      sellerDetails: resolveSellerDetails(),
      productMetaById: {},
      forceRegenerate: true,
    });

    order.invoiceNumber = generatedInvoice.invoiceNumber;
    order.invoicePath = generatedInvoice.invoicePath;
    order.invoiceGeneratedAt = generatedInvoice.invoiceGeneratedAt;
    order.isInvoiceGenerated = true;
    order.invoiceUrl = generatedInvoice.invoicePath;
    await order.save();

    const invoiceCopyPath = path.join(artifactRoot, `invoice_${order._id}.pdf`);
    await fs.copyFile(generatedInvoice.absolutePath, invoiceCopyPath);

    report.invoice = {
      invoiceNumber: generatedInvoice.invoiceNumber,
      sourceInvoicePath: generatedInvoice.absolutePath,
      storedInvoicePath: invoiceCopyPath,
      storedInvoiceBytes: (await fs.stat(invoiceCopyPath)).size,
    };

    const serviceabilityPayload = {
      origin:
        toPincode(
        process.env.XPRESSBEES_PICKUP_PINCODE ||
          process.env.XPRESSBEES_ORIGIN_PINCODE ||
          process.env.SHIPPER_PINCODE,
      ) || billingDetails.pincode,
      destination: billingDetails.pincode,
      payment_type: "prepaid",
      order_amount: finalAmount,
      weight: 500,
      length: Number(process.env.XPRESSBEES_PACKAGE_LENGTH_CM || 10),
      breadth: Number(process.env.XPRESSBEES_PACKAGE_BREADTH_CM || 10),
      height: Number(process.env.XPRESSBEES_PACKAGE_HEIGHT_CM || 10),
    };

    try {
      const serviceabilityResponse = await checkServiceability(serviceabilityPayload);
      report.shipping.serviceability = {
        ok: true,
        payload: serviceabilityPayload,
        options: sanitizeServiceability(serviceabilityResponse),
      };
    } catch (error) {
      report.shipping.serviceability = {
        ok: false,
        payload: serviceabilityPayload,
        error: redactError(error),
      };
    }

    let awb = null;
    let packageWeight = null;
    try {
      const booking = await autoCreateShipmentForPaidOrder({
        orderId: String(order._id),
        source: "EXPRESSBEES_TEST",
      });

      packageWeight = Number(booking?.payload?.package_weight || 0);
      awb = booking?.shipment?.awb || booking?.order?.awbNumber || booking?.order?.awb_number || null;

      report.shipping.booking = {
        ok: Boolean(booking?.ok),
        skipped: Boolean(booking?.skipped),
        reason: booking?.reason || null,
        packageWeight,
        payload: booking?.payload || null,
        awb: awb || null,
        response: booking?.response || null,
        error: booking?.error ? redactError(booking.error) : null,
      };
    } catch (error) {
      report.shipping.booking = {
        ok: false,
        error: redactError(error),
      };
    }

    if (awb) {
      try {
        const manifestResponse = await createManifest([awb]);
        const manifestUrl = parseManifestUrl(manifestResponse);
        const manifestFilePath = manifestUrl
          ? path.join(artifactRoot, `manifest_${awb}.pdf`)
          : null;
        const downloaded = manifestUrl
          ? await maybeDownloadFile({ url: manifestUrl, filePath: manifestFilePath })
          : { ok: false, reason: "MANIFEST_URL_MISSING" };

        report.shipping.manifest = {
          ok: true,
          awb,
          manifestUrl,
          response: manifestResponse,
          download: downloaded,
        };
      } catch (error) {
        report.shipping.manifest = {
          ok: false,
          awb,
          error: redactError(error),
        };
      }

      if (skipCancel) {
        report.shipping.cancel = {
          ok: false,
          skipped: true,
          awb,
          reason: "SKIP_CANCEL_ENABLED",
        };
      } else {
        try {
          const cancelResponse = await cancelShipment(awb);
          report.shipping.cancel = {
            ok: true,
            awb,
            response: cancelResponse,
          };
        } catch (error) {
          report.shipping.cancel = {
            ok: false,
            awb,
            error: redactError(error),
          };
        }
      }
    } else {
      report.shipping.manifest = {
        ok: false,
        reason: "AWB_MISSING",
      };
      report.shipping.cancel = {
        ok: false,
        reason: "AWB_MISSING",
      };
    }

    const serviceabilityOptions = report.shipping.serviceability?.options || [];
    const hasFiveKgOption = serviceabilityOptions.some((option) =>
      [option.chargeable_weight, option.min_weight].includes(5000),
    );
    const hasRequestedWeightOption = packageWeight
      ? serviceabilityOptions.some((option) =>
          [option.chargeable_weight, option.min_weight].includes(packageWeight),
        )
      : false;

    report.conclusion = {
      requestedPackageWeight: packageWeight || null,
      hasFiveKgOption,
      hasRequestedWeightOption,
      forcedToFiveKg:
        packageWeight === 5000 ||
        (packageWeight && !hasRequestedWeightOption && hasFiveKgOption),
      note:
        packageWeight && hasRequestedWeightOption
          ? "Booking payload uses order-sized package weight; 5kg exists as a carrier slab, not a forced payload weight."
          : "Could not fully confirm forced slab selection because booking did not complete with an AWB.",
      manualCancellationRequired: Boolean(skipCancel && awb),
    };
  } catch (error) {
    report.errors.push(redactError(error));
  } finally {
    report.completedAt = new Date().toISOString();
    await safeWriteJson(reportPath, report);

    try {
      await mongoose.connection.close();
    } catch {
      // ignore close errors
    }
  }

  console.log(`REPORT_PATH=${reportPath}`);
};

run().catch(async (error) => {
  console.error("FATAL", error?.message || error);
  process.exitCode = 1;
});
