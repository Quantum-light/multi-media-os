import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@mmos/brand", "@mmos/contracts", "@mmos/db"],
};

export default config;
