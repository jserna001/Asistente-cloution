import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Configuración de Next.js
  serverComponentsExternalPackages: [
    'mcp-remote',
    '@modelcontextprotocol/sdk'
  ],
};

export default nextConfig;
