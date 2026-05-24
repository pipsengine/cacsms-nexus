import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ["@cacsms-nexus/types", "@cacsms-nexus/design-system"]
};

export default nextConfig;
