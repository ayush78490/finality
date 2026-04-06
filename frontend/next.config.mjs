/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: false,
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
