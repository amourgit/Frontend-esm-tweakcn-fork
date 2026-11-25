# Squelette de tokens EGEN

Le studio manipule désormais **tous** les tokens d'un thème, pas seulement les 44 variables de shadcn : couleurs étendues (statuts, états, surfaces, bordures, liens…), rampes de palette, typographie, tailles, radius, bordures, ombres, layout, composants, mouvement, effets, z-index, icônes, accessibilité.

Principe directeur : **un thème ne renseigne que ce qu'il veut personnaliser.** Tout le reste est dérivé de ses propres couleurs ou vient du squelette de référence. Les 40 presets existants, les thèmes enregistrés en base et l'état persisté dans le navigateur n'ont pas changé de forme.

## Architecture

| Couche | Fichier | Rôle |
|---|---|---|
| Défauts | `config/tokens/defaults.ts` | Valeurs neutres des tokens indépendants du mode |
| Dérivations | `utils/tokens/derive.ts` | 82 couleurs étendues et leur règle de calcul |
| Résolveur | `utils/tokens/resolve.ts` | `resolveTheme(styles)` : défauts ← dérivations ← overrides |
| Catalogue | `utils/tokens/registry.ts` | Métadonnées de chaque token (type, groupe, libellé) pour l'éditeur |
| Variables CSS | `utils/tokens/css-vars.ts` | Source unique des variables émises (code, live, registre) |
| Édition | `utils/tokens/edit.ts` | Opérations pures utilisées par l'éditeur |
| Échange | `utils/tokens/export-json.ts` | Export/import `egen-tokens.json`, minimisation |
| Référence | `config/tokens/egen-theme-skeleton.json` | Thème par défaut entièrement résolu |

## Forme d'un thème

Inchangée et rétro-compatible : `{ light, dark }` plats en kebab-case, plus un objet `tokens` **optionnel**.

```jsonc
{
  "light": { "primary": "#7033ff", "...": "44 clés tweakcn", "success": "#16a34a" },  // extras optionnels
  "dark":  { "...": "..." },
  "tokens": { "motion": { "duration": { "fast": "80ms" } } }                           // optionnel
}
```

- Les 44 clés tweakcn restent toujours présentes (comme avant).
- Une clé étendue présente dans `light`/`dark` est un **override** ; absente, elle est **dérivée** des couleurs du thème (`primary-hover` d'un preset violet est violet).
- `tokens` est un arbre partiel fusionné sur les défauts. Une chaîne vide = « non renseigné ».
- Les clés inconnues sont conservées (couleurs propres à un thème).

## Nommage des variables CSS

`tokens.<groupe>.<chemin>` → `--<groupe>-<chemin>` en kebab-case (`tokens.motion.duration.fast` → `--motion-duration-fast`). Les clés de `light`/`dark` → `--<clé>`. Les booléens sortent en `1`/`0`.

Cas particuliers : `tokens.shadow.override.<taille>` remplace l'ombre calculée par tweakcn (`--shadow-md`…) ; `meta` ne produit aucune variable.

## Dans l'éditeur

- **Colors** : les groupes tweakcn, puis les groupes étendus. Chaque ligne indique *Auto* (dérivée) ou *Custom* (override, avec reset). Un reset par groupe.
- **Tokens** (nouvel onglet) : tous les tokens du catalogue, avec un contrôle adapté (valeur + unité, liste, interrupteur, texte, easing) et une recherche (`--motion-easing`, `sidebar`…). Éditeur de rampes 50→950 pour la palette.
- **Aperçu** : menu « More previews » → *Design Tokens* (statuts, états, surfaces, typographie, radius, ombres, mouvement, composants, palette…) ; *Color Palette* affiche aussi les couleurs étendues.
- **Contrôle de contraste** : 15 paires supplémentaires (statuts, header, tooltip, lien…).
- **Import** : CSS (`:root` / `.dark`, y compris les nouvelles variables) ou JSON `egen-tokens.json`, partiel ou complet.

## Exports

| Sortie | Standard | Complet |
|---|---|---|
| Code CSS / config Tailwind | variables shadcn historiques (**identique à avant**) | + couleurs étendues, tokens, correspondances Tailwind (`bg-success`, `text-lg`, `ease-spring`…) |
| Registre shadcn | `/r/themes/<id>.json` | `/r/themes/<id>.complete.json` |
| JSON d'échange | — | onglet `egen-tokens.json` |

Le choix se fait dans le panneau de code (« Complete / Standard »). Les URL `.complete.json` existent pour les thèmes intégrés et enregistrés.

## Contrat pour TokiForge : `egen-tokens.json`

```jsonc
{
  "meta":   { "name": "…", "version": "1.0.0", "tenantId": "default", "priority": 1, "extends": null, "naming": "…" },
  "light":  { "background": "…", "primary-hover": "…", "...": "126 clés résolues" },
  "dark":   { "...": "126 clés résolues" },
  "tokens": { "palette": {}, "typography": {}, "layout": {}, "motion": {}, "…": "arbre résolu" }
}
```

Toujours **résolu** à l'export (rien à deviner côté récepteur) ; à l'import, tout ce qui est identique à la valeur dérivée est retiré pour retrouver la forme minimale du thème. Les valeurs sont du CSS prêt à l'emploi ; les références `var(--…)` entre tokens sont conservées.

## Ajouter un token

1. Valeur par défaut dans `config/tokens/defaults.ts` (ou règle dans `derive.ts` pour une couleur étendue).
2. `pnpm tokens:skeleton` pour régénérer la référence.
3. `pnpm test` : le catalogue, l'éditeur, les exports et l'import le prennent en compte automatiquement.

Rien d'autre à brancher : le type du contrôle est déduit de la valeur par défaut.

## Tests

`pnpm test` (Vitest) : résolution des 43 thèmes, non-régression de l'export standard (empreintes générées avec le code d'avant l'intégration), couverture complète des exports, validité shadcn du registre, aller-retour JSON, import CSS, schéma serveur, alpha, application live dans le DOM, composants de l'éditeur et vrai `ThemeControlPanel` sur le vrai store.

## Limites connues

- Le script anti-flash (`ThemeScript`) applique les clés tweakcn avant l'hydratation ; couleurs étendues et tokens sont appliqués dès l'hydratation React.
- L'import CSS convertit les couleurs en hex (comportement historique) : les couleurs hors gamut sRGB sont écrêtées.
- Les tokens `typography.tracking.*` sont exposés en variables ; les utilitaires Tailwind `tracking-*` restent pilotés par `letter-spacing`.
