import { ThemeStyles } from "@/types/theme";
import {
  pgTable,
  json,
  timestamp,
  boolean,
  text,
  integer,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
});

/**
 * Thème du studio. Une ligne = l'identité stable d'un thème ; son contenu historisé vit dans
 * `theme_version`. `name`, `description` et `styles` sont l'instantané de la version courante
 * (`current_version`) : ils sont réécrits dans la même transaction que la nouvelle version.
 *
 *  - `source = 'BUILT_IN'` : thème système (user_id NULL), importé au démarrage depuis les presets
 *    livrés avec le dépôt ; son id est son slug historique (ex. "modern-minimal").
 *  - `source = 'USER'` : thème créé dans le studio, propriété de `user_id`.
 *  - `deleted_at` : suppression logique, l'historique des versions est conservé.
 */
export const theme = pgTable("theme", {
  id: text("id").primaryKey(),
  userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
  source: text("source").$type<"BUILT_IN" | "USER">().notNull().default("USER"),
  name: text("name").notNull(),
  description: text("description"),
  styles: json("styles").$type<ThemeStyles>().notNull(),
  metadata: json("metadata").$type<Record<string, unknown>>().notNull().default({}),
  currentVersion: integer("current_version").notNull().default(1),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

export type ThemeVersionOrigin = "SEED" | "CREATE" | "UPDATE" | "RESTORE";

/**
 * Version immuable d'un thème : jamais modifiée après insertion. Chaque création, modification
 * validée ou restauration ajoute une ligne (numéro incrémenté par thème).
 * `content_hash` = empreinte SHA-256 du contenu (nom, description, styles) : sert à ne jamais
 * enregistrer deux versions identiques à la suite.
 */
export const themeVersion = pgTable(
  "theme_version",
  {
    id: text("id").primaryKey(),
    themeId: text("theme_id")
      .notNull()
      .references(() => theme.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    styles: json("styles").$type<ThemeStyles>().notNull(),
    metadata: json("metadata").$type<Record<string, unknown>>().notNull().default({}),
    changeNote: text("change_note"),
    origin: text("origin").$type<ThemeVersionOrigin>().notNull(),
    contentHash: text("content_hash").notNull(),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("theme_version_theme_id_version_unique").on(table.themeId, table.version),
    index("theme_version_theme_id_idx").on(table.themeId),
  ]
);

// OAuth 2.0 tables

export const oauthApp = pgTable("oauth_app", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  clientId: text("client_id").notNull().unique(),
  clientSecretHash: text("client_secret_hash").notNull(),
  redirectUris: json("redirect_uris").$type<string[]>().notNull(),
  scopes: json("scopes").$type<string[]>().notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

export const oauthAuthorizationCode = pgTable("oauth_authorization_code", {
  id: text("id").primaryKey(),
  code: text("code").notNull().unique(),
  appId: text("app_id")
    .notNull()
    .references(() => oauthApp.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  scopes: json("scopes").$type<string[]>().notNull(),
  redirectUri: text("redirect_uri").notNull(),
  codeChallenge: text("code_challenge"),
  codeChallengeMethod: text("code_challenge_method"),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").notNull(),
});

export const oauthToken = pgTable("oauth_token", {
  id: text("id").primaryKey(),
  accessTokenHash: text("access_token_hash").notNull().unique(),
  refreshTokenHash: text("refresh_token_hash").unique(),
  appId: text("app_id")
    .notNull()
    .references(() => oauthApp.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  scopes: json("scopes").$type<string[]>().notNull(),
  accessTokenExpiresAt: timestamp("access_token_expires_at").notNull(),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  revokedAt: timestamp("revoked_at"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});
