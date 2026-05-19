import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isProduction = process.env.NODE_ENV === "production";
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
  basePath: "/admin",
  assetPrefix: isProduction ? "/admin" : "",
  allowedDevOrigins: ["127.0.0.1"],
  outputFileTracingRoot: __dirname,
  async redirects() {
    return [
      {
        source: "/",
        destination: "/admin",
        permanent: false,
        basePath: false,
      },
    ];
  },
  async rewrites() {
    return [
      { source: "/logo.png", destination: "/admin/logo.png" },
      { source: "/profile.png", destination: "/admin/profile.png" },
      { source: "/placeholder.png", destination: "/admin/placeholder.png" },
      { source: "/pattern.png", destination: "/admin/pattern.png" },
    ];
  },
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
      {
        protocol: "https",
        hostname: "storage.googleapis.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "firebasestorage.googleapis.com",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
