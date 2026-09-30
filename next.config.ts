import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Native and heavy server packages stay outside the bundle.
  serverExternalPackages: ['sharp', 'pdf-to-img', 'canvas', 'pdfjs-dist', 'bcryptjs', '@prisma/client'],
  // The e2e server builds into its own folder so it never collides with a running dev server.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  devIndicators: false,
  // hosts that bundle each route as a function need the database engine next to the code
  outputFileTracingIncludes: { '/**': ['./node_modules/.prisma/client/**'] },
};

export default nextConfig;
