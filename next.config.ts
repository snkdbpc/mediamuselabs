import type { NextConfig } from "next";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_MEDIAMUSELABS_API_URL ||
  process.env.NEXT_PUBLIC_MEDIAMIND_API_URL ||
  "https://api.mediamuselabs.com";

const nextConfig: NextConfig = {
  httpAgentOptions: {
    keepAlive: true,
  },
  experimental: {
    middlewareClientMaxBodySize: "300mb",
    proxyTimeout: 600000,
    serverActions: {
      bodySizeLimit: "300mb",
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
