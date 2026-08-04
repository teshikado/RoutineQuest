import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: "/hero", destination: "/dashboard", permanent: false },
      { source: "/hero/:path*", destination: "/dashboard", permanent: false },
    ];
  },
};

export default nextConfig;
