import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ⚡ PERFORMANCE OPTIMIZATIONS
  experimental: {
    // Optimize package imports to reduce bundle size
    optimizePackageImports: ['lucide-react', 'framer-motion', 'date-fns', 'recharts'],
  },
  
  compiler: {
    // Remove console.log in production for better performance
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'],
    } : false,
  },

  // Ensure static files are served correctly
  async headers() {
    return [
      {
          source: '/manifest.json',
          headers: [
            {
              key: 'Content-Type',
              value: 'application/manifest+json',
            },
            {
              key: 'Cache-Control',
              value: 'public, max-age=0, must-revalidate',
            },
          ],
      },
      {
          source: '/sw.js',
          headers: [
            {
              key: 'Content-Type',
              value: 'application/javascript',
            },
            {
              key: 'Cache-Control',
              value: 'public, max-age=0, must-revalidate',
            },
            {
              key: 'Service-Worker-Allowed',
              value: '/',
            },
          ],
      },
    ];
  },
};

export default nextConfig;

