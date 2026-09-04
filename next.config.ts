import type { NextConfig } from "next";

const BACKEND_URL =
  process.env.INTERNAL_BACKEND_URL ||
  process.env.BACKEND_URL ||
  "http://127.0.0.1:8000";

const nextConfig: NextConfig = {
  httpAgentOptions: {
    keepAlive: true,
  },
  experimental: {
    middlewareClientMaxBodySize: "1gb",
    proxyTimeout: 600000,
    serverActions: {
      bodySizeLimit: "1gb",
    },
  },
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${BACKEND_URL}/api/v1/:path*`,
      },
      {
        source: "/auth/:path*",
        destination: `${BACKEND_URL}/auth/:path*`,
      },
    ];
  },
};
export default nextConfig;
