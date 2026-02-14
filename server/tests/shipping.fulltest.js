// FULL SHIPPING TEST SCRIPT
// No auth required
// Tests zones + weights + pricing

const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

const API = "http://localhost:8000/api/shipping/quote";

const PINCODES = [
  "302001", // A
  "302019", // A
  "110001", // B
  "400001", // B
  "560001", // B
  "190001", // C
  "180001", // C
  "781001", // C
  "682001", // C
  "744101", // C
];

const SUBTOTALS = [
  400,   // 500g
  800,   // 1kg
  1200,  // 1.5kg
  1800,  // 2kg
];

(async () => {
  const results = [];

  for (const pin of PINCODES) {
    for (const subtotal of SUBTOTALS) {
      try {
        const res = await fetch(API, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pincode: pin,
            subtotal,
          }),
        });

        const json = await res.json();

        results.push({
          PINCODE: pin,
          ZONE: json?.data?.zone,
          WEIGHT: json?.data?.weight,
          CHARGE: json?.data?.charge,
        });
      } catch (e) {
        results.push({
          PINCODE: pin,
          ERROR: e.message,
        });
      }
    }
  }

  console.table(results);
})();
