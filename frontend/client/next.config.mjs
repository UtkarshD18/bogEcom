import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rawApiUrl = process.env.NEXT_PUBLIC_API_URL?.trim();

if (!rawApiUrl) {
  throw new Error("NEXT_PUBLIC_API_URL is not defined");
}

const normalizedApiUrl = rawApiUrl.replace(/\/+$/, "").replace(/\/api$/i, "");
const parsedApiUrl = new URL(normalizedApiUrl);
const firebaseProjectId = String(
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "",
).trim();
const firebaseProjectHost = firebaseProjectId
  ? `https://${firebaseProjectId}.firebaseapp.com`
  : "";
const apiImagePattern = [
  {
    protocol: parsedApiUrl.protocol.replace(":", ""),
    hostname: parsedApiUrl.hostname,
    ...(parsedApiUrl.port ? { port: parsedApiUrl.port } : {}),
    pathname: "/uploads/**",
  },
];

const nextConfig = {
  turbopack: {
    root: __dirname,
  },
  images: {
    deviceSizes: [360, 480, 640, 750, 828, 1080, 1200, 1600, 1920],
    imageSizes: [32, 48, 64, 96, 128, 160, 240, 320, 420, 640],
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 2678400,
    remotePatterns: [
      ...apiImagePattern,
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
        pathname: "/**",
      },
    ],
  },
  async rewrites() {
    const rewrites = [];

    if (firebaseProjectHost) {
      rewrites.push(
        {
          source: "/__/auth/:path*",
          destination: `${firebaseProjectHost}/__/auth/:path*`,
        },
        {
          source: "/__/firebase/:path*",
          destination: `${firebaseProjectHost}/__/firebase/:path*`,
        },
      );
    }

    if (process.env.NODE_ENV === "production") {
      return rewrites;
    }

    return [
      ...rewrites,
      {
        source: "/api/:path*",
        destination: `${normalizedApiUrl}/api/:path*`,
      },
      {
        source: "/uploads/:path*",
        destination: `${normalizedApiUrl}/uploads/:path*`,
      },
    ];
  },
};

export default nextConfig;
