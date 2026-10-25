import type { NextConfig } from 'next'
const nextConfig: NextConfig = {
  async redirects() {
    return [
      // Removed from the Student Zone; send old links to the section page
      // rather than leaving a 404.
      {
        source: '/student-zone/academic-associations',
        destination: '/student-zone',
        permanent: true,
      },
      {
        source: '/student-zone/welfare-cells',
        destination: '/student-zone',
        permanent: true,
      },
      {
        source: '/student-zone/question-bank',
        destination: '/student-zone',
        permanent: true,
      },
    ]
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'plus.unsplash.com' },
      // Google Drive links pasted into the CMS are rewritten to this host,
      // which serves the image bytes. See lib/imageUrl.ts.
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: 'lh4.googleusercontent.com' },
      { protocol: 'https', hostname: 'lh5.googleusercontent.com' },
      { protocol: 'https', hostname: 'lh6.googleusercontent.com' },
    ],
    qualities: [75, 80, 82],
    deviceSizes: [640, 750, 828, 1080, 1200, 1400, 1600, 1920, 2560, 3840],
  } }
export default nextConfig
