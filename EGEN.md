# Intégration au Core EGEN

EGEN Theme Studio est une **application embarquée** du Core EGEN : une app autonome dans une iframe, qui parle au Core par le **SDK** `@egen-civitas/esm-embed-client` (protocole v2). Une seule voie d'intégration : plus d'enveloppe `@civitas/esm-tweakcn-app`, plus de tarball, plus de pont `egen-bridge.js`.

| Élément | Rôle |
| --- | --- |
| `app/egen-config.json/route.ts`, `lib/egen/manifest.ts` | **Déclaration** publiée à `/egen-config.json` : identité, route `theme-studio`, rail gauche (`placement`), navigation `history`, capacités demandées, **droits d'iframe demandés** (`sandbox`, `allow`). Valide selon le protocole ; `EGEN_PUBLIC_URL` en donne l'URL |
| `components/egen/egen-integration.tsx`, `lib/egen/navigation.ts` | Client SDK : **navigation partagée** (l'URL du Core reflète la page courante, retour/avance, lien partageable ; seuls les chemins internes sont acceptés), **langue** du Core |
| `lib/egen/notify-bridge.ts`, `hooks/use-toast.ts` | **Toasts sans doublon** : embarqué, le Core est l'afficheur ; hors du Core, les toasts de l'app s'affichent comme avant |
| `app/api/egen/host-origins/route.ts`, `middleware.ts`, `lib/frame-ancestors.ts` | `EGEN_FRAME_ANCESTORS` (runtime) → `Content-Security-Policy: frame-ancestors 'self' <origines>` et origines du Shell que le client accepte (jamais `*`) |

## Ce que l'app demande, ce que l'opérateur approuve

L'app **demande** ; l'opérateur du Core **approuve** un plafond dans son `external-apps.json` ; le Core applique l'**intersection**. Exemple d'entrée côté Core :

```json
{ "embed": [ {
    "manifest": "https://design.exemple.org/egen-config.json",
    "grants": {
      "notifications": {},
      "events": { "publish": ["app.theme-studio.*"], "subscribe": ["core.*"] },
      "iframe": { "sandbox": ["allow-downloads", "allow-modals", "allow-popups-to-escape-sandbox"],
                  "allow": ["clipboard-read", "clipboard-write", "fullscreen"] }
    }
} ] }
```

Identité, session, droits, thème et appels API ne passent **pas** par le SDK (règle d'or) : l'app les obtient auprès de leurs sources (Keycloak, service de thèmes, backends).

## En local
1. `cp .env.example .env`, renseigner `DATABASE_URL`, `BETTER_AUTH_SECRET`, `EGEN_PUBLIC_URL=http://localhost:3000`, `EGEN_FRAME_ANCESTORS=http://localhost:<port du Core>` ; `pnpm dev`.
2. Core : entrée `embed` ci-dessus avec `manifest` = `http://localhost:3000/egen-config.json` (`EGEN_ALLOW_HTTP=1` pour `http` en local), puis `yarn external:sync`.

## En production (à froid)
Déployer l'image (`docker compose up -d --build`) avec `EGEN_PUBLIC_URL` (https) et `EGEN_FRAME_ANCESTORS` (origine du Shell). Dans le Core : déclarer l'entrée `embed`, `yarn external:sync`, redémarrer. Aucune publication de paquet.

## Tokens de design

Le studio gère un squelette complet de tokens (couleurs étendues, palette, typographie, layout, mouvement, composants…), exportable en CSS, registre shadcn et JSON pour TokiForge. Voir [docs/design-tokens.md](docs/design-tokens.md).
