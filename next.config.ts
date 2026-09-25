import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  serverExternalPackages: ['sharp', 'pdf-to-img', 'canvas', 'pdfjs-dist', 'bcryptjs', '@prisma/client'],
  experimental: { serverActions: { bodySizeLimit: '30mb' } },
  devIndicators: false,
};

export default nextConfig;
