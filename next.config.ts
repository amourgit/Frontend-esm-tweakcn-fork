import { type NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pas de page d'accueil : le service ouvre directement l'éditeur de thèmes.
  async redirects() {
    return [{ source: "/", destination: "/editor/theme", permanent: false }];
  },
  turbopack: {
      rules: {
        '*.svg': {
          loaders: [
            {
              loader: '@svgr/webpack',
              options: {
                icon: true,
              },
            },
          ],
        as: '*.js',
      },
    },
  },
};

export default nextConfig;
