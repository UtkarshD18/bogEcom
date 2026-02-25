import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const localCandidates = [
  path.join(
    __dirname,
    "client",
    "node_modules",
    "@tailwindcss",
    "postcss",
    "dist",
    "index.js",
  ),
  path.join(
    __dirname,
    "admin",
    "node_modules",
    "@tailwindcss",
    "postcss",
    "dist",
    "index.js",
  ),
];

const pluginKey =
  localCandidates.find((candidate) => fs.existsSync(candidate)) ??
  "@tailwindcss/postcss";

const config = {
  plugins: {
    [pluginKey]: {},
  },
};

export default config;
