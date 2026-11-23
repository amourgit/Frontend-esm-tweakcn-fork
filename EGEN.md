# Intégration au Core EGEN

EGEN Theme Studio est une **application externe** du Core EGEN (scénario C3 du doc 15 du Core : iframe + pont).

| Élément | Rôle |
| --- | --- |
| `middleware.ts`, `lib/frame-ancestors.ts` | `EGEN_FRAME_ANCESTORS` (lue à l'exécution) → `Content-Security-Policy: frame-ancestors 'self' <origines>`. Vide = comportement amont |
| `integrations/egen/esm-tweakcn-app/` | enveloppe `@civitas/esm-tweakcn-app` (route `theme-studio`, rail gauche, nav) |
| `.github/workflows/egen-tweakcn-app.yml` | tag `egen-app-v<version>` → tests, build, `npm pack`, release |

## En local
1. `cp .env.example .env`, renseigner `DATABASE_URL`, `BETTER_AUTH_SECRET`, `EGEN_FRAME_ANCESTORS=http://localhost:<port du Core>` ; `pnpm dev` (http://localhost:3000).
2. Core : configuration `{ "@civitas/esm-tweakcn-app": { "studioUrl": "http://localhost:3000" } }` ; app lancée avec `egen develop --sources "packages/apps/*" "<chemin>/integrations/egen/esm-tweakcn-app"`.

## En production (à froid)
Déployer l'image (`docker compose up -d --build`), puis dans le Core : déclarer le tarball de release dans `external-apps.json`, `EGEN_CONFIG_FILE` avec `studioUrl`, `yarn prepare:prod`, redémarrer.
