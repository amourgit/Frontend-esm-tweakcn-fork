CREATE TABLE "theme_version" (
	"id" text PRIMARY KEY NOT NULL,
	"theme_id" text NOT NULL,
	"version" integer NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"styles" json NOT NULL,
	"metadata" json DEFAULT '{}'::json NOT NULL,
	"change_note" text,
	"origin" text NOT NULL,
	"content_hash" text NOT NULL,
	"created_by" text,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "theme" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "theme" ADD COLUMN "source" text DEFAULT 'USER' NOT NULL;--> statement-breakpoint
ALTER TABLE "theme" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "theme" ADD COLUMN "metadata" json DEFAULT '{}'::json NOT NULL;--> statement-breakpoint
ALTER TABLE "theme" ADD COLUMN "current_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "theme" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "theme_version" ADD CONSTRAINT "theme_version_theme_id_theme_id_fk" FOREIGN KEY ("theme_id") REFERENCES "public"."theme"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "theme_version" ADD CONSTRAINT "theme_version_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "theme_version_theme_id_version_unique" ON "theme_version" USING btree ("theme_id","version");--> statement-breakpoint
CREATE INDEX "theme_version_theme_id_idx" ON "theme_version" USING btree ("theme_id");--> statement-breakpoint
-- Reprise de l'existant : chaque thème déjà enregistré reçoit sa version 1 (contenu actuel).
-- content_hash historique = SHA-256 du JSON stocké ; la déduplication applicative recalcule
-- l'empreinte depuis le contenu courant, elle ne dépend donc pas de cette valeur.
INSERT INTO "theme_version" ("id", "theme_id", "version", "name", "description", "styles", "metadata", "change_note", "origin", "content_hash", "created_by", "created_at")
SELECT 'tv_' || md5("theme"."id"), "theme"."id", 1, "theme"."name", "theme"."description", "theme"."styles", '{}'::json,
       'Version initiale (reprise de l''existant)', 'CREATE',
       encode(sha256(convert_to("theme"."styles"::text, 'UTF8')), 'hex'), "theme"."user_id", "theme"."created_at"
FROM "theme"
WHERE NOT EXISTS (SELECT 1 FROM "theme_version" WHERE "theme_version"."theme_id" = "theme"."id");
