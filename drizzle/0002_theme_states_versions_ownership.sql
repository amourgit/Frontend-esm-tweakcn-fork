-- États (theme_revision) ≠ versions (theme_version, étiquettes posées sur un état) ; thème par défaut ; auteurs.

-- 1) Ce que 0001 appelait « version » était en réalité un état : on renomme sans perdre de donnée.
ALTER TABLE "theme_version" RENAME TO "theme_revision";--> statement-breakpoint
ALTER TABLE "theme_revision" RENAME COLUMN "version" TO "revision";--> statement-breakpoint
ALTER TABLE "theme_revision" RENAME COLUMN "change_note" TO "message";--> statement-breakpoint
ALTER TABLE "theme_revision" ADD COLUMN "parent_revision" integer;--> statement-breakpoint
ALTER TABLE "theme_revision" RENAME CONSTRAINT "theme_version_theme_id_theme_id_fk" TO "theme_revision_theme_id_theme_id_fk";--> statement-breakpoint
ALTER TABLE "theme_revision" RENAME CONSTRAINT "theme_version_created_by_user_id_fk" TO "theme_revision_created_by_user_id_fk";--> statement-breakpoint
ALTER INDEX "theme_version_theme_id_version_unique" RENAME TO "theme_revision_theme_id_revision_unique";--> statement-breakpoint
ALTER INDEX "theme_version_theme_id_idx" RENAME TO "theme_revision_theme_id_idx";--> statement-breakpoint
UPDATE "theme_revision" SET "origin" = 'SAVE' WHERE "origin" = 'UPDATE';--> statement-breakpoint
UPDATE "theme_revision" SET "parent_revision" = "revision" - 1 WHERE "revision" > 1;--> statement-breakpoint

-- 2) Le thème : état courant, dernière version publiée, thème par défaut.
ALTER TABLE "theme" RENAME COLUMN "current_version" TO "current_revision";--> statement-breakpoint
ALTER TABLE "theme" ADD COLUMN "current_version" integer;--> statement-breakpoint
ALTER TABLE "theme" ADD COLUMN "is_default" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "theme_single_default_idx" ON "theme" USING btree ("is_default") WHERE "theme"."is_default" = true;--> statement-breakpoint

-- 3) Les versions (étiquettes sur un état).
CREATE TABLE "theme_version" (
	"id" text PRIMARY KEY NOT NULL,
	"theme_id" text NOT NULL,
	"version" integer NOT NULL,
	"revision_id" text NOT NULL,
	"notes" text,
	"created_by" text,
	"created_at" timestamp NOT NULL
);--> statement-breakpoint
ALTER TABLE "theme_version" ADD CONSTRAINT "theme_version_theme_id_theme_id_fk" FOREIGN KEY ("theme_id") REFERENCES "public"."theme"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "theme_version" ADD CONSTRAINT "theme_version_revision_id_theme_revision_id_fk" FOREIGN KEY ("revision_id") REFERENCES "public"."theme_revision"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "theme_version" ADD CONSTRAINT "theme_version_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "theme_version_theme_id_version_unique" ON "theme_version" USING btree ("theme_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "theme_version_revision_id_unique" ON "theme_version" USING btree ("revision_id");--> statement-breakpoint

-- 4) Reprise : chaque état déjà enregistré était présenté comme une version ; on conserve ces versions.
INSERT INTO "theme_version" ("id", "theme_id", "version", "revision_id", "notes", "created_by", "created_at")
SELECT 'tv2_' || md5("id"), "theme_id", "revision", "id", "message", "created_by", "created_at" FROM "theme_revision";--> statement-breakpoint
UPDATE "theme" SET "current_version" = "current_revision";--> statement-breakpoint

-- 5) Auteurs dans les métadonnées (thème et états) : système pour les thèmes livrés, utilisateur sinon.
UPDATE "theme" SET "metadata" = ("metadata"::jsonb || jsonb_build_object('author', jsonb_build_object('type', 'system', 'id', NULL, 'name', 'system')))::json
WHERE "source" = 'BUILT_IN';--> statement-breakpoint
UPDATE "theme" t SET "metadata" = (t."metadata"::jsonb || jsonb_build_object('author', jsonb_build_object('type', 'user', 'id', u."id", 'name', u."name")))::json
FROM "user" u WHERE t."source" = 'USER' AND t."user_id" = u."id";--> statement-breakpoint
UPDATE "theme_revision" r SET "metadata" = (r."metadata"::jsonb || jsonb_build_object('author', jsonb_build_object('type', 'user', 'id', u."id", 'name', u."name")))::json
FROM "user" u WHERE r."created_by" = u."id";--> statement-breakpoint
UPDATE "theme_revision" SET "metadata" = ("metadata"::jsonb || jsonb_build_object('author', jsonb_build_object('type', 'system', 'id', NULL, 'name', 'system')))::json
WHERE "created_by" IS NULL;
