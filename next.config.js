/** @type {import('next').NextConfig} */
const nextConfig = {
  // CSP warnings in dev mode are expected - Next.js uses eval() for hot reloading
  // This is harmless and won't appear in production builds
  // If you want to suppress warnings, you can add headers, but it's not necessary
  
  // For production deployments, you might want to add CSP headers
  // But for development, these warnings are safe to ignore
};

module.exports = nextConfig;
