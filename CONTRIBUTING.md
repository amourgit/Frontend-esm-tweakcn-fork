# Contribuer à EGEN Theme Studio

1. Travailler sur une branche dédiée, jamais directement sur `main`.
2. Installer : `corepack enable && pnpm install --frozen-lockfile` (pnpm uniquement).
3. Avant chaque commit : `pnpm exec tsc --noEmit`, lint des fichiers modifiés (`pnpm exec eslint <fichiers>`), puis `pnpm build`.
4. Ne pas réintroduire de dépendance à un service tiers (télémétrie, paiement, IA, CDN de scripts) sans décision explicite.
5. Les URLs du service passent par `lib/site.ts` (`getBaseUrl()`) : ne jamais coder de domaine en dur.
6. Ne jamais commiter de secret (`.env` est ignoré par git).
