import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rawApiUrl = process.env.NEXT_PUBLIC_API_URL?.trim();
const rawLocalDevApiUrl = process.env.NEXT_PUBLIC_LOCAL_API_URL?.trim();

if (!rawApiUrl) {
  throw new Error("NEXT_PUBLIC_API_URL is not defined");
}

const sanitizeUrl = (value) =>
  String(value || "")
    .trim()
    .replace(/\/+$/, "");
const isLocalhostUrl = (value) => {
  try {
    const parsed = new URL(String(value || ""));
    const hostname = String(parsed.hostname || "").toLowerCase();
    return hostname === "localhost" || hostname === "127.0.0.1";
  } catch {
    return false;
  }
};
const normalizeLoopbackUrl = (value) => {
  const sanitized = sanitizeUrl(value);
  if (!sanitized || !isLocalhostUrl(sanitized)) {
    return sanitized;
  }

  try {
    const parsed = new URL(sanitized);
    parsed.hostname = "127.0.0.1";
    return parsed.toString().replace(/\/+$/, "");
  } catch {
    return sanitized;
  }
};

const normalizedApiUrl = rawApiUrl.replace(/\/+$/, "").replace(/\/api$/i, "");
const normalizedLocalDevApiUrl = rawLocalDevApiUrl
  ? normalizeLoopbackUrl(sanitizeUrl(rawLocalDevApiUrl).replace(/\/api$/i, ""))
  : "";
const resolvedDevApiUrl =
  process.env.NODE_ENV !== "production" && normalizedLocalDevApiUrl
    ? normalizedLocalDevApiUrl
    : normalizedApiUrl;
const parsedApiUrl = new URL(normalizedApiUrl);
const parsedDevApiUrl = new URL(resolvedDevApiUrl);
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
  ...(resolvedDevApiUrl !== normalizedApiUrl
    ? [
        {
          protocol: parsedDevApiUrl.protocol.replace(":", ""),
          hostname: parsedDevApiUrl.hostname,
          ...(parsedDevApiUrl.port ? { port: parsedDevApiUrl.port } : {}),
          pathname: "/uploads/**",
        },
      ]
    : []),
];

const nextConfig = {
  outputFileTracingRoot: __dirname,
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
      {
        protocol: "https",
        hostname: "storage.googleapis.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
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
        destination: `${resolvedDevApiUrl}/api/:path*`,
      },
      {
        source: "/uploads/:path*",
        destination: `${resolvedDevApiUrl}/uploads/:path*`,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
