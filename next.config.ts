import { type NextConfig } from "next";

const nextConfig: NextConfig = {
  // Sortie autonome (server.js + dépendances tracées) pour une image Docker légère.
  output: "standalone",
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
