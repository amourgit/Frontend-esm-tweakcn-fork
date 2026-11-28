import { ThemeStyles } from "@/types/theme";
import { sql } from "drizzle-orm";
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
 * Thème du studio — modèle à la GitHub :
 *
 *  - `theme_revision` = un **état** : chaque enregistrement d'une modification ajoute un état
 *    (comme un commit). Tous les états sont conservés, numérotés 1, 2, 3… par thème.
 *  - `theme_version`  = une **version** : étiquette (comme un tag/release) posée sur UN état précis.
 *    Une modification n'est donc pas forcément une nouvelle version.
 *
 * Cette table porte l'identité du thème et l'instantané de son état courant (`current_revision`) :
 * `name`, `description`, `styles` sont réécrits dans la même transaction que le nouvel état.
 * `current_version` = numéro de la dernière version publiée (NULL tant qu'aucune).
 *
 *  - `source = 'BUILT_IN'` : thème système (user_id NULL, auteur = le système), lisible par tous,
 *    jamais modifiable : on en tire une copie dérivée qui appartient à l'utilisateur.
 *  - `source = 'USER'` : thème d'un utilisateur, que lui seul peut modifier.
 *  - `is_default` : thème pris par défaut par le studio (au plus un, garanti par un index unique partiel).
 *  - `deleted_at` : suppression logique, l'historique est conservé.
 */
export const theme = pgTable(
  "theme",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
    source: text("source").$type<"BUILT_IN" | "USER">().notNull().default("USER"),
    name: text("name").notNull(),
    description: text("description"),
    styles: json("styles").$type<ThemeStyles>().notNull(),
    metadata: json("metadata").$type<Record<string, unknown>>().notNull().default({}),
    isDefault: boolean("is_default").notNull().default(false),
    currentRevision: integer("current_revision").notNull().default(1),
    currentVersion: integer("current_version"),
    deletedAt: timestamp("deleted_at"),
    createdAt: timestamp("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("theme_single_default_idx")
      .on(table.isDefault)
      .where(sql`${table.isDefault} = true`),
  ]
);

export type ThemeRevisionOrigin = "SEED" | "CREATE" | "DERIVE" | "SAVE" | "RESTORE";

/**
 * Un état d'un thème : immuable, jamais modifié après insertion.
 * `parent_revision` = l'état dont il découle (NULL pour le premier). `content_hash` = empreinte
 * SHA-256 du contenu (nom, description, styles) : sert à ne jamais enregistrer deux états
 * consécutifs identiques.
 */
export const themeRevision = pgTable(
  "theme_revision",
  {
    id: text("id").primaryKey(),
    themeId: text("theme_id")
      .notNull()
      .references(() => theme.id, { onDelete: "cascade" }),
    revision: integer("revision").notNull(),
    parentRevision: integer("parent_revision"),
    name: text("name").notNull(),
    description: text("description"),
    styles: json("styles").$type<ThemeStyles>().notNull(),
    metadata: json("metadata").$type<Record<string, unknown>>().notNull().default({}),
    message: text("message"),
    origin: text("origin").$type<ThemeRevisionOrigin>().notNull(),
    contentHash: text("content_hash").notNull(),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("theme_revision_theme_id_revision_unique").on(table.themeId, table.revision),
    index("theme_revision_theme_id_idx").on(table.themeId),
  ]
);

/**
 * Une version : étiquette numérotée (1, 2, 3…) posée sur un état précis d'un thème.
 * Un état porte au plus une version (unicité sur `revision_id`), un numéro n'est jamais réutilisé.
 */
export const themeVersion = pgTable(
  "theme_version",
  {
    id: text("id").primaryKey(),
    themeId: text("theme_id")
      .notNull()
      .references(() => theme.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    revisionId: text("revision_id")
      .notNull()
      .references(() => themeRevision.id, { onDelete: "cascade" }),
    notes: text("notes"),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("theme_version_theme_id_version_unique").on(table.themeId, table.version),
    uniqueIndex("theme_version_revision_id_unique").on(table.revisionId),
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
