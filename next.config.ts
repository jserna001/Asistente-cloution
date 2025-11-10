import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Configuración de Next.js

  // Optimizaciones de bundle para animaciones
  experimental: {
    // Optimizar imports de paquetes grandes
    optimizePackageImports: ['gsap', 'lucide-react'],
  },

  // Configuración de Turbopack (Next.js 16+)
  turbopack: {
    resolveAlias: {
      '@/lib/animations': './lib/animations',
      '@/components': './components',
    },
  },

  // Configuración de webpack para optimizaciones adicionales
  webpack: (config, { dev, isServer }) => {
    // Optimizaciones de producción
    if (!dev && !isServer) {
      // Tree-shaking agresivo para GSAP
      config.optimization = {
        ...config.optimization,
        usedExports: true,
        sideEffects: false,

        // Code splitting mejorado
        splitChunks: {
          chunks: 'all',
          cacheGroups: {
            // Separar GSAP en su propio chunk
            gsap: {
              test: /[\\/]node_modules[\\/]gsap[\\/]/,
              name: 'gsap',
              priority: 20,
              reuseExistingChunk: true,
            },
            // Separar animaciones personalizadas
            animations: {
              test: /[\\/]lib[\\/]animations[\\/]/,
              name: 'animations',
              priority: 15,
              reuseExistingChunk: true,
            },
            // Separar componentes de animación
            animatedComponents: {
              test: /[\\/]components[\\/](AnimatedIcon|IconAnimations|microinteractions)[\\/]/,
              name: 'animated-components',
              priority: 15,
              reuseExistingChunk: true,
            },
            // Vendor chunk para otras librerías
            vendor: {
              test: /[\\/]node_modules[\\/]/,
              name: 'vendor',
              priority: 10,
              reuseExistingChunk: true,
            },
          },
        },
      };

      // Configurar module concatenation para mejor minificación
      config.optimization.concatenateModules = true;
    }

    // Aliases para importar más fácilmente
    config.resolve.alias = {
      ...config.resolve.alias,
      '@/lib/animations': '/home/user/Asistente-cloution/lib/animations',
      '@/components': '/home/user/Asistente-cloution/components',
    };

    return config;
  },

  // Configuración de headers para caching
  async headers() {
    return [
      {
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
