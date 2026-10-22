import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@mmos/agents", "@mmos/brand", "@mmos/contracts", "@mmos/db", "@mmos/media"],
};

export default config;
