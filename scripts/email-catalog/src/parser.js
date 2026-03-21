import mammoth from "mammoth";
import { EMAIL_TYPE_DEFINITIONS } from "./emailTypes.js";

function normalize(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function parseEmailTypesFromDocx(docPath) {
  const raw = await mammoth.extractRawText({ path: docPath });
  const text = raw.value || "";
  const normalizedDoc = normalize(text);

  const detected = EMAIL_TYPE_DEFINITIONS.filter((typeDef) => {
    const keys = [typeDef.name, ...typeDef.aliases].map(normalize);
    return keys.some((k) => normalizedDoc.includes(k));
  }).map((t) => t.name);

  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const fieldsByType = {};
  let currentType = null;

  for (const line of lines) {
    const matchedType = EMAIL_TYPE_DEFINITIONS.find((typeDef) => {
      const keys = [typeDef.name, ...typeDef.aliases].map(normalize);
      const normalizedLine = normalize(line);
      return keys.some((k) => normalizedLine.includes(k));
    });

    if (matchedType) {
      currentType = matchedType.name;
      if (!fieldsByType[currentType]) {
        fieldsByType[currentType] = new Set();
      }
      continue;
    }

    if (!currentType) {
      continue;
    }

    const fieldMatch = line.match(/^[-*\d.)\s]*([a-zA-Z_\s]+)\s*:/);
    if (fieldMatch) {
      fieldsByType[currentType].add(
        fieldMatch[1].trim().toLowerCase().replace(/\s+/g, "_"),
      );
    }
  }

  const serializedFields = Object.fromEntries(
    Object.entries(fieldsByType).map(([key, valueSet]) => [
      key,
      Array.from(valueSet),
    ]),
  );

  return {
    detected,
    fieldsByType: serializedFields,
    rawTextLength: text.length,
  };
}
