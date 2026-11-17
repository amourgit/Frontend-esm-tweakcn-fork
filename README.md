# EGEN Theme Studio

Éditeur de thèmes de l'écosystème **EGEN**, édité par **CIVITAS**. Service indépendant : il se déploie seul (image Docker + PostgreSQL) et n'est pas embarqué dans le core ni dans le framework.

Il permet de concevoir des thèmes (shadcn/ui, Tailwind CSS v4), de les prévisualiser en direct, de les enregistrer et de les exporter.

> Fork de [tweakcn](https://github.com/jnsahaj/tweakcn) (Apache-2.0) — voir [`LICENSE`](LICENSE) et [`NOTICE`](NOTICE).
> Retirés : page d'accueil et pages commerciales, paiement, génération IA, thèmes communautaires, export Figma, télémétrie, intégration v0.
> Conservés : éditeur complet, thèmes prédéfinis, import/export, thèmes enregistrés, API `v1`, OAuth, registre shadcn.

## Prérequis

- Node.js ≥ 20.9 (`.nvmrc` : 22)
- pnpm 10 — **seul gestionnaire supporté** (`npm install` est refusé avec un message explicite)
- PostgreSQL 14+ (fourni par `docker compose` en déploiement)

## Déploiement avec Docker (recommandé)

```bash
cp .env.example .env
# Éditer .env : BASE_URL, NEXT_PUBLIC_APP_URL, POSTGRES_PASSWORD, BETTER_AUTH_SECRET,
#               et au moins un fournisseur de connexion (GitHub ou Google).
docker compose up -d --build
```

- L'application applique elle-même les migrations au démarrage (idempotent) et attend que la base soit prête.
- Santé : `curl http://localhost:3000/api/health` → `{"status":"ok"}`
- Logs : `docker compose logs -f app`
- Mise à jour : `git pull && docker compose up -d --build`
- Les données sont dans le volume `pgdata`. Sauvegarde : `docker compose exec db pg_dump -U studio egen_theme_studio > sauvegarde.sql`

### Image seule (registre)

`NEXT_PUBLIC_APP_URL` est inlinée **au build** : construire une image par URL publique.

```bash
docker build -t egen-theme-studio:latest --build-arg NEXT_PUBLIC_APP_URL=https://studio.example.org .
docker run -d --name egen-theme-studio -p 3000:3000 \
  -e DATABASE_URL="postgresql://user:motdepasse@hote:5432/base" \
  -e BETTER_AUTH_SECRET="..." -e BASE_URL="https://studio.example.org" \
  -e GITHUB_CLIENT_ID="..." -e GITHUB_CLIENT_SECRET="..." \
  egen-theme-studio:latest
```

Pour une base distante qui impose SSL, ajouter `?sslmode=require` à `DATABASE_URL`.

## Connexion

Le service utilise Better Auth avec **GitHub** et **Google** (pas d'email/mot de passe). URL de callback à déclarer chez le fournisseur :
`<BASE_URL>/api/auth/callback/github` et `<BASE_URL>/api/auth/callback/google`.

## Développement local

```bash
corepack enable                      # ou : npm install -g pnpm@10.34.9
pnpm install --frozen-lockfile
cp .env.example .env                 # DATABASE_URL pointe vers votre PostgreSQL local
pnpm db:migrate
pnpm dev                             # http://localhost:3000
```

PostgreSQL jetable pour le développement :

```bash
docker run -d --name studio-db -p 5432:5432 -e POSTGRES_USER=studio \
  -e POSTGRES_PASSWORD=CHANGER_MOI -e POSTGRES_DB=egen_theme_studio postgres:16-alpine
```

Build de production sans Docker : `pnpm build && pnpm db:migrate && pnpm start`.

## Applications OAuth (accès API `v1`, ex. TokiForge)

Créer une application cliente (le secret n'est affiché qu'une fois) :

```bash
# Avec Docker
docker compose exec app node create-oauth-app.cjs --name "TokiForge" --redirect-uris "https://toki.example.org/callback"
# En développement
pnpm tsx scripts/create-oauth-app.ts --name "TokiForge" --redirect-uris "http://localhost:4000/callback"
```

Voir [`docs/oauth-api.md`](docs/oauth-api.md).

## Remarques d'exploitation

- Le service charge les polices depuis Google Fonts (sortie Internet requise côté navigateur).
- Schéma de base : migration initiale unique `drizzle/0000_init.sql`. Après un changement de `db/schema.ts` : `pnpm exec drizzle-kit generate`.
- Le service n'est pas indexé par les moteurs de recherche (`noindex`).
