import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Force the correct project root for Turbopack/Next to avoid picking up
  // lockfiles/configs from parent directories on Windows.
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
