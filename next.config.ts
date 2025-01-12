import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*", // Proxy all requests starting with /api
        destination: "http://localhost:11434/api/:path*", // Forward to local server
      },
    ];
  },
};

export default nextConfig;
