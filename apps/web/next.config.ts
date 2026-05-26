import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  serverExternalPackages: ["pg"],
  transpilePackages: ["@cacsms-nexus/types", "@cacsms-nexus/design-system"]
};

export default nextConfig;
