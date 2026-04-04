/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  /** Avoid Windows EISDIR/readlink errors in webpack when resolving `next/dist/pages/*`. */
  webpack: (config) => {
    config.resolve.symlinks = false;
    return config;
  },
  async rewrites() {
    return {
      beforeFiles: [
        { source: "/favicon.ico", destination: "/favicon.svg" }
      ]
    };
  }
};

export default nextConfig;
