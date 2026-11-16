import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
    ],
  },
  serverExternalPackages: [
    "better-sqlite3",
    "@takumi-rs/core",
    "@takumi-rs/image-response",
    "@remotion/renderer",
    "@remotion/bundler",
  ],
};

export default nextConfig;
