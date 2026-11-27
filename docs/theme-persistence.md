# Persistance et versionnement des thèmes

Le studio gère lui-même ses thèmes en base PostgreSQL, indépendamment de TokiForge : chaque thème est
tracé, versionné et restaurable. Le `localStorage` / IndexedDB du navigateur ne sert qu'à la continuité
d'édition (brouillon, annuler/rétablir) ; la vérité est en base.

## Modèle de données

| Table | Rôle |
|---|---|
| `theme` | Identité d'un thème + **instantané de la version courante** (`name`, `description`, `styles`, `metadata`, `current_version`). `source` = `BUILT_IN` (thème système, `user_id` NULL) ou `USER`. `deleted_at` = suppression logique. |
| `theme_version` | Historique **immuable** : une ligne par version (`version` 1, 2, 3…, sans trou). Contient `name`, `description`, `styles`, `metadata` (JSON libre), `change_note`, `origin` (`SEED` / `CREATE` / `UPDATE` / `RESTORE`), `content_hash`, `created_by`, `created_at`. |

Invariants (garantis dans une transaction à chaque écriture, voir `lib/themes/service.ts`) :
`theme.current_version` = plus grand numéro de version ; l'instantané = contenu de cette version ;
unicité `(theme_id, version)` ; jamais deux versions consécutives de contenu identique.

## Cycle de vie

- **Création** (« Save as a new theme ») : thème `USER` + version 1.
- **Modification validée** (« New version of … ») : nouvelle version sur le **même** thème, avec nom,
  description et note de changement saisis pour cette version. Un contenu identique à la version
  courante ne crée rien. `baseVersion` détecte une modification concurrente (conflit explicite).
- **Historique** (bouton *History* de l'éditeur) : consulter, ouvrir une version dans l'éditeur sans
  l'enregistrer, ou la **restaurer** (crée une nouvelle version ; l'historique n'est jamais réécrit).
- **Suppression** d'un thème utilisateur : logique, l'historique est conservé. Un thème système ne se supprime pas.

## Thèmes livrés avec le dépôt (42)

`utils/theme-presets.ts` est désormais la **source du seed**, plus un chargement à l'exécution :
au démarrage (`node migrate.cjs` dans le conteneur, ou `pnpm db:migrate` / `pnpm db:seed` en dev),
chaque preset est importé comme thème système en **version 1**, avec ses métadonnées
(`origin: "tweakcn-official"`, `seed.key`, `seed.file`).

- L'`id` du thème est son slug historique (`modern-minimal`…) : les URLs `?theme=…`, `/r/themes/<slug>.json`
  et les états déjà persistés continuent de fonctionner.
- **Idempotent** : `ON CONFLICT DO NOTHING` + verrou consultatif ; redémarrages et instances
  simultanées ne créent aucun doublon. Un thème déjà présent n'est **jamais réécrit** : la base fait foi,
  même si le fichier source change.
- Le studio charge ces thèmes depuis la base (page éditeur → `ThemeCatalogProvider` → store de presets).
- Les 19 presets sans date sont ancrés au 2025-04-01 (`metadata.seed.createdAtEstimated`) pour ne pas
  apparaître « nouveaux » dans le sélecteur.

## Droits

- Thème `USER` : visible et modifiable par son propriétaire uniquement.
- Thème `BUILT_IN` : lisible par tous ; une nouvelle version peut être enregistrée par tout utilisateur
  connecté (l'auteur est tracé dans `created_by` ; toute version est restaurable).

## API

- Server actions (`actions/themes.ts`) : `getBuiltInThemes`, `getThemes`, `getTheme`, `createTheme`,
  `updateTheme`, `deleteTheme`, `getThemeVersions`, `getThemeVersion`, `restoreThemeVersion`.
- `GET /r/themes/<id>.json` (registre shadcn) : sert désormais la **version courante** depuis la base
  (plus de JSON statiques générés au build).
- `GET /api/v1/themes` et `/api/v1/themes/<id>` : exposent en plus `description`, `version` et `metadata`
  (additif, rétro-compatible) ; les thèmes supprimés sont exclus. Ces routes ne renvoient que les thèmes
  de l'utilisateur autorisé (pas les thèmes système).

## Tests

`__tests__/themes/` : PostgreSQL en mémoire (PGlite) avec **toutes** les migrations — reprise de
l'existant, seed (idempotence, concurrence, parité avec l'ancien chargement fichier), versionnement,
conflits, restauration, droits, suppression logique ; plus le store de presets.
