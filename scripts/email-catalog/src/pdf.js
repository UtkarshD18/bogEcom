import fs from "node:fs";
import PDFDocument from "pdfkit";

function drawFooter(doc, text) {
  const footerY = doc.page.height - doc.page.margins.bottom - 12;
  doc
    .fontSize(10)
    .fillColor("#64748b")
    .text(text, doc.page.margins.left, footerY, {
      width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
      align: "center",
    });
}

export function generateCatalogPdf({
  outputPath,
  pages,
  includeCover = true,
  coverTitle = "HealthyOneGram Email Catalog",
}) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 40 });
    const stream = fs.createWriteStream(outputPath);

    doc.pipe(stream);

    const totalPages = pages.length + (includeCover ? 1 : 0);
    let pageCounter = 0;

    if (includeCover) {
      pageCounter += 1;
      doc.rect(0, 0, doc.page.width, doc.page.height).fill("#f0fdfa");
      doc
        .fillColor("#0f766e")
        .fontSize(36)
        .text(coverTitle, 0, 235, { align: "center" });
      doc
        .fillColor("#475569")
        .fontSize(14)
        .text(new Date().toLocaleDateString("en-IN"), 0, 305, {
          align: "center",
        });
      drawFooter(doc, `Page ${pageCounter} of ${totalPages}`);
    }

    for (const page of pages) {
      if (pageCounter > 0 || !includeCover) {
        doc.addPage();
      }

      pageCounter += 1;

      doc
        .fillColor("#0f172a")
        .fontSize(17)
        .text(page.title, 40, 30, {
          width: doc.page.width - 80,
          align: "left",
        });

      const topGap = 70;
      const footerGap = 50;
      const maxW = doc.page.width - 80;
      const maxH = doc.page.height - topGap - footerGap;
      const img = doc.openImage(page.imagePath);
      const scale = Math.min(maxW / img.width, maxH / img.height);
      const renderW = img.width * scale;
      const renderH = img.height * scale;
      const x = (doc.page.width - renderW) / 2;

      doc.image(page.imagePath, x, topGap, {
        width: renderW,
        height: renderH,
      });

      drawFooter(doc, `Page ${pageCounter} of ${totalPages}`);
    }

    doc.end();

    stream.on("finish", () => resolve(outputPath));
    stream.on("error", reject);
  });
}
