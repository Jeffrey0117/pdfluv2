import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 家目錄有 Claude Code CLI 的 package-lock.json，會讓 Turbopack 誤判 workspace root
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
