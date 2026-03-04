import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  async rewrites() {
    // In development, proxy to local Fastify server
    // In production, Vercel will handle /api routes via vercel.json
    if (process.env.NODE_ENV === 'development') {
      return [
        {
          source: '/api/v1/:path*',
          destination: 'http://localhost:3001/api/v1/:path*',
        },
      ];
    }
    return [];
  },
};

export default nextConfig;
