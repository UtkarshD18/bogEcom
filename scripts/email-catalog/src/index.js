import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { REQUIRED_EMAIL_ORDER } from "./emailTypes.js";
import { parseEmailTypesFromDocx } from "./parser.js";
import { generateCatalogPdf } from "./pdf.js";
import { buildSampleData } from "./sampleData.js";
import { renderScreenshots } from "./screenshot.js";
import { buildEmailHtml, fileNameForType } from "./templates.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "../../..");

function parseArgs(argv) {
  const argMap = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token.startsWith("--")) {
      const key = token.slice(2);
      const next = argv[i + 1];
      if (!next || next.startsWith("--")) {
        argMap[key] = true;
      } else {
        argMap[key] = next;
        i += 1;
      }
    }
  }
  return argMap;
}

function resolveFromProjectRoot(inputPath) {
  if (!inputPath) {
    return inputPath;
  }

  return path.isAbsolute(inputPath)
    ? inputPath
    : path.join(projectRoot, inputPath);
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const docPath = args.doc
    ? resolveFromProjectRoot(args.doc)
    : path.join(projectRoot, "EMAILS.docx");

  const emailsDir = args.emailsDir
    ? resolveFromProjectRoot(args.emailsDir)
    : path.join(projectRoot, "emails");

  const screenshotsDir = args.screenshotsDir
    ? resolveFromProjectRoot(args.screenshotsDir)
    : path.join(projectRoot, "screenshots");

  const outputPdf = args.output
    ? resolveFromProjectRoot(args.output)
    : path.join(projectRoot, "email_catalog.pdf");

  await ensureDir(emailsDir);
  await ensureDir(screenshotsDir);

  const parsed = await parseEmailTypesFromDocx(docPath);
  const selectedTypes = [...REQUIRED_EMAIL_ORDER];

  const data = buildSampleData();
  const artifacts = [];

  for (const emailType of selectedTypes) {
    const filename = fileNameForType(emailType);
    const html = buildEmailHtml(
      emailType,
      data,
      parsed.fieldsByType[emailType] || [],
    );

    const htmlPath = path.join(emailsDir, `${filename}.html`);
    const screenshotPath = path.join(screenshotsDir, `${filename}.png`);

    await fs.writeFile(htmlPath, html, "utf-8");
    artifacts.push({
      title: emailType,
      html,
      htmlPath,
      screenshotPath,
    });
  }

  await renderScreenshots(artifacts, screenshotsDir);

  await generateCatalogPdf({
    outputPath: outputPdf,
    pages: artifacts.map((item) => ({
      title: item.title,
      imagePath: item.screenshotPath,
    })),
    includeCover: true,
    coverTitle: "HealthyOneGram Email Catalog",
  });

  const reportPath = path.join(projectRoot, "email-catalog-report.json");
  await fs.writeFile(
    reportPath,
    JSON.stringify(
      {
        sourceDocx: docPath,
        parsed,
        missingFromDocxDetection: REQUIRED_EMAIL_ORDER.filter(
          (emailType) => !parsed.detected.includes(emailType),
        ),
        generatedCount: artifacts.length,
        generatedAt: new Date().toISOString(),
        outputPdf,
        emailsDir,
        screenshotsDir,
      },
      null,
      2,
    ),
    "utf-8",
  );

  console.log(`Generated ${artifacts.length} email templates.`);
  console.log(`HTML output: ${emailsDir}`);
  console.log(`Screenshots output: ${screenshotsDir}`);
  console.log(`PDF output: ${outputPdf}`);
  console.log(`Report: ${reportPath}`);
}

main().catch((error) => {
  console.error("Failed to generate email catalog:", error);
  process.exit(1);
});
