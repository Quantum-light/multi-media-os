import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@mmos/brand", "@mmos/contracts", "@mmos/db", "@mmos/media"],
};

export default config;
