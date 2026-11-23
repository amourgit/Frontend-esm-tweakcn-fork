# Intégration au Core EGEN

EGEN Theme Studio est une **application externe** du Core EGEN (scénario C3 du doc 15 du Core : iframe + pont).

| Élément | Rôle |
| --- | --- |
| `middleware.ts`, `lib/frame-ancestors.ts` | `EGEN_FRAME_ANCESTORS` (lue à l'exécution) → `Content-Security-Policy: frame-ancestors 'self' <origines>`. Vide = comportement amont |
| `integrations/egen/esm-tweakcn-app/` | enveloppe `@civitas/esm-tweakcn-app` (route `theme-studio`, rail gauche, nav) |
| `public/egen-bridge.js`, `components/egen-nav-sync.tsx` | **navigation partagée** : l'URL du Core reflète la page courante (actualisation, retour/avance, lien partageable). Script vendorisé de `esm-nextjs-utils` ≥ 0.3.0, inactif hors iframe ; `router.push` au retour/avance |
| `.github/workflows/egen-tweakcn-app.yml` | tag `egen-app-v<version>` → tests, build, `npm pack`, release |

## En local
1. `cp .env.example .env`, renseigner `DATABASE_URL`, `BETTER_AUTH_SECRET`, `EGEN_FRAME_ANCESTORS=http://localhost:<port du Core>` ; `pnpm dev` (http://localhost:3000).
2. Core : configuration `{ "@civitas/esm-tweakcn-app": { "studioUrl": "http://localhost:3000" } }` ; app lancée avec `egen develop --sources "packages/apps/*" "<chemin>/integrations/egen/esm-tweakcn-app"`.

## En production (à froid)
Déployer l'image (`docker compose up -d --build`), puis dans le Core : déclarer le tarball de release dans `external-apps.json`, `EGEN_CONFIG_FILE` avec `studioUrl`, `yarn prepare:prod`, redémarrer.

## Navigation partagée
`navigation` (`history` par défaut, `hash`, `none`) dans la configuration du Core, par instance. Spécification : `docs/integration-apps/16-navigation-partagee-apps-externes.md` du Core. Le wrapper ≥ 1.1.0 exige `@egen-civitas/esm-nextjs-utils` ≥ 0.3.0.
