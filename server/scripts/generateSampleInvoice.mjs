import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { generateInvoicePdf } from "../utils/generateInvoicePdf.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");

const sampleOrderId = "65f1a2b3c4d5e6f7890ab99";

const sampleOrder = {
  _id: sampleOrderId,
  invoiceNumber: "INV-20260222-SAMPLE99",
  createdAt: "2026-01-29T06:21:00+05:30",
  notes: "Please call before delivery",
  payment_status: "PAID",
  shipping: 157.38,
  tax: 157.38,
  totalAmt: 3315.0,
  finalAmount: 3315.0,
  gst: { rate: 5 },
  gstNumber: "27ABCDE1234F1Z5",
  termsOfDelivery: "-",
  awb_number: "-",
  shipping_provider: "-",
  shipment_created_at: null,
  user: {
    name: "Sudnyata Private Limited",
  },
  delivery_address: {
    name: "Sudnyata Private Limited",
    address_line1:
      "Vikramshila Nagar, Behind Shankar Ice Factory, Near Buddha Vihar, Wardha",
    city: "Wardha",
    state: "Maharashtra",
    stateCode: "27",
    pincode: "442001",
    country: "India",
    mobile: "9999999999",
  },
  products: [
    {
      productId: "PB-CRNCHY",
      productTitle: "Peanut Butter Crunchy",
      quantity: 3,
      price: 257.18,
      subTotal: 771.54,
      hsn: "200811",
    },
    {
      productId: "PB-CHOC",
      productTitle: "Peanut Butter Chocolate",
      quantity: 5,
      price: 466.74,
      subTotal: 2333.7,
      hsn: "200811",
    },
    {
      productId: "PB-CRMY",
      productTitle: "Peanut Butter Creamy",
      quantity: 1,
      price: 52.38,
      subTotal: 52.38,
      hsn: "190410",
    },
  ],
};

const sellerDetails = {
  name: "BUY ONE GRAM PRIVATE LIMITED",
  gstin: "08AAJCB3889Q1ZO",
  address: "G-225, RIICO INDUSTRIAL AREA SITAPURA, TONK ROAD, JAIPUR-302022",
  state: "Rajasthan",
  placeOfSupplyStateCode: "08",
  cin: "U51909RJ2020PTC071817",
  msme: "UDYAM-RJ-17-0154669",
  fssai: "12224027000921",
  currencySymbol: "Rs. ",
  bankName: "ICICI BANK LIMITED",
  bankAccount: "731405000083",
  bankBranch: "SITAPURA",
  bankIfsc: "ICIC0006748",
  jurisdictionLine: "SUBJECT TO JAIPUR JURISDICTION",
};

const productMetaById = {
  "PB-CRNCHY": { hsn: "200811", taxRate: 5, unit: "Nos" },
  "PB-CHOC": { hsn: "200811", taxRate: 5, unit: "Nos" },
  "PB-CRMY": { hsn: "190410", taxRate: 5, unit: "Nos" },
};

const run = async () => {
  const result = await generateInvoicePdf({
    order: sampleOrder,
    sellerDetails,
    productMetaById,
    forceRegenerate: true,
  });

  const outputPath = path.resolve(repoRoot, "tmp", "sample-new-invoice.pdf");
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.copyFile(result.absolutePath, outputPath);

  console.log(`Sample invoice generated: ${outputPath}`);
  console.log(`Invoice number: ${result.invoiceNumber}`);
};

run().catch((error) => {
  console.error("Failed to generate sample invoice:", error?.message || error);
  process.exit(1);
});
