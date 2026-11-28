# Persistance, états, versions et propriété des thèmes

Le studio gère lui-même ses thèmes en base PostgreSQL, indépendamment de TokiForge. Le navigateur
(localStorage / IndexedDB) ne sert qu'à la continuité d'édition ; la vérité est en base.

## Modèle « à la GitHub »

| Notion | Table | Équivalent Git | Règle |
|---|---|---|---|
| **État** | `theme_revision` | commit | Chaque enregistrement ajoute un état (1, 2, 3…, sans trou, immuable, `parent_revision`, `message`, auteur). Un contenu identique à l'état courant ne crée rien. |
| **Version** | `theme_version` | tag / release | Étiquette numérotée posée sur **un état précis** (`revision_id`, notes). Un état porte au plus une version ; un numéro n'est jamais réutilisé. |
| **Thème** | `theme` | branche | Identité + instantané de l'état courant (`current_revision`) + dernière version publiée (`current_version`, NULL si aucune). |

Une modification n'est donc **pas forcément une nouvelle version** : elle crée un état ; on pose une
version quand on le décide, sur l'état voulu (le dernier ou un ancien). La **restauration** d'un état
crée un nouvel état (comme `git revert`) : l'historique n'est jamais réécrit.

Invariants (une transaction par écriture, thème verrouillé — `lib/themes/`) : l'instantané du thème
= contenu de l'état courant ; numéros sans trou ; unicité `(theme_id, revision)` et `(theme_id, version)`.

## Propriété et auteurs (projets personnels)

- **Thèmes système** (`source = BUILT_IN`, auteur = le système) : les 42 thèmes livrés + le **thème par
  défaut**. Lisibles par tous, chargés dans le studio quel que soit l'utilisateur, **jamais modifiables**.
- **Thèmes utilisateur** (`source = USER`) : visibles, modifiables, versionnables, restaurables et
  supprimables **uniquement par leur propriétaire**. Toute tentative d'un autre utilisateur est refusée
  comme « introuvable » (on ne révèle pas leur existence).
- **Dériver** : enregistrer une modification d'un thème système (ou « Save as a new theme ») crée un
  thème **appartenant à l'utilisateur**, auteur = cet utilisateur, avec `derivedFrom`
  (thème, état et version d'origine, relevés par le serveur).
- **Auteurs dans les métadonnées** : `metadata.author = { type: "system"|"user", id, name }` sur le thème
  et sur chaque état (l'auteur de CETTE modification). Les clés `author`, `derivedFrom`,
  `restoredFromRevision` sont réservées au serveur : le client ne peut pas les fournir.
- Les règles sont centralisées dans `lib/themes/permissions.ts` : quand la notion de **projet** arrivera,
  c'est là que seront branchées les permissions de projet (qui modifie, qui crée des versions…).

## Thème par défaut

Un thème système comme les autres (`id = "default"`), repéré par l'attribut **`is_default`** (au plus
un, garanti par un index unique partiel). Le studio prend par défaut celui dont l'attribut est coché
(`defaultPresetId` dans le store) ; changer l'attribut change le thème par défaut.

## Seed des thèmes système

`utils/theme-presets.ts` est la **source du seed**, plus un chargement à l'exécution. Au démarrage
(`node migrate.cjs` dans le conteneur, `pnpm db:migrate` / `pnpm db:seed` en dev) : 42 thèmes + le thème
par défaut, chacun en **état 1 + version 1**. Idempotent (clé primaire = slug, `ON CONFLICT DO NOTHING`,
verrou consultatif, une transaction) ; un thème déjà présent n'est **jamais réécrit**. Les 19 presets
sans date sont ancrés au 2025-04-01 (`metadata.seed.createdAtEstimated`).

## Studio

- **Enregistrer** : sur son thème → « Save a state » (nom, description, *What changed?*, case « Also
  create version N ») ou « Save as a new theme » ; sur un thème système → copie dérivée.
- **History** : onglet *States* (ouvrir dans l'éditeur sans enregistrer, restaurer, créer une version sur
  un état) et onglet *Versions*. Les thèmes système y sont en lecture seule.
- **Theme details** (panneau de gauche, sous le sélecteur) : nom, type, auteur, version (+ états non
  publiés), versions, état courant, dates de création/modification, provenance, description, métadonnées.
- Code : `components/editor/theme-history/`, `components/editor/theme-info/`, `hooks/themes/`.

## API

- Server actions (`actions/themes.ts`) : `getSystemThemes`, `getThemes`, `getTheme`, `getThemeForEditor`,
  `getThemeDetails`, `getThemeRevisions`, `getThemeRevision`, `getThemeVersions`, `createTheme`,
  `saveThemeState`, `createThemeVersion`, `restoreThemeRevision`, `deleteTheme`.
- `GET /r/themes/<id>.json` : état courant depuis la base (thème par défaut compris), 404 si inconnu.
- `GET /api/v1/themes[/<id>]` : ajoute `description`, `version`, `revision`, `metadata` ; seulement les
  thèmes de l'utilisateur autorisé (pas les thèmes système).

## Tests

`__tests__/themes/` (PGlite, toutes les migrations) : reprise d'une base existante (0000→0002), seed,
états, versions, propriété/dérivation, fiche d'identité, store, lignes affichées.
