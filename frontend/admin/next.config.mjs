import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rawApiUrl = process.env.NEXT_PUBLIC_API_URL?.trim();

if (!rawApiUrl) {
  throw new Error("NEXT_PUBLIC_API_URL is not defined");
}

const parsedApiUrl = new URL(rawApiUrl);
const apiImagePattern = [
  {
    protocol: parsedApiUrl.protocol.replace(":", ""),
    hostname: parsedApiUrl.hostname,
    ...(parsedApiUrl.port ? { port: parsedApiUrl.port } : {}),
    pathname: "/uploads/**",
  },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    root: __dirname,
  },
  images: {
    remotePatterns: [
      ...apiImagePattern,
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
