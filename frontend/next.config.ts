// Project: Via Nostra
// File: frontend/next.config.ts
// Purpose: Next.js settings for the website. Uploads of documents and car photos
//          travel through the website's forms, so the allowed upload size is raised.

import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    serverActions: { bodySizeLimit: '25mb' },
  },
};

export default nextConfig;

// File: frontend/next.config.ts
// END OF FILE