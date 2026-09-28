import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingIncludes: {
    "/api/relatorio": ["./public/logo.png"],
  },
};

export default nextConfig;
