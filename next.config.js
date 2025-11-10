/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Option 1: For Docker deployment with Node.js server
  // output: 'standalone',
  
  // Option 2: For pure static export (no Node.js server needed)
  // All pages must be 'use client' and use client-side data fetching
  output: 'export',
  
  // Disable features that require a server
  images: {
    unoptimized: true,
  },
};

module.exports = nextConfig;
