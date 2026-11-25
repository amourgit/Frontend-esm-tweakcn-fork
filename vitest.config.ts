import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // Vite 8 transforme avec oxc ; le tsconfig de Next fixe jsx:"preserve", on force le runtime automatique.
  oxc: { jsx: { runtime: "automatic" } },
  resolve: { alias: [{ find: /^@\//, replacement: `${path.resolve(__dirname)}/` }] },
  test: {
    include: ["__tests__/**/*.test.{ts,tsx}"],
    environment: "node",
    setupFiles: ["__tests__/setup.ts"],
    testTimeout: 20000,
    // Le client d'auth (importé par le store de l'éditeur) exige une URL de base valide.
    environmentOptions: { jsdom: { url: "http://localhost:3000" } },
    env: { NEXT_PUBLIC_APP_URL: "http://localhost:3000", BASE_URL: "http://localhost:3000" },
  },
});
