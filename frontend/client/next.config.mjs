import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rawApiUrl = process.env.NEXT_PUBLIC_API_URL?.trim();

if (!rawApiUrl) {
  throw new Error("NEXT_PUBLIC_API_URL is not defined");
}

const normalizedApiUrl = rawApiUrl.replace(/\/+$/, "").replace(/\/api$/i, "");
const parsedApiUrl = new URL(normalizedApiUrl);
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
    if (process.env.NODE_ENV === "production") {
      return [];
    }

    return [
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
