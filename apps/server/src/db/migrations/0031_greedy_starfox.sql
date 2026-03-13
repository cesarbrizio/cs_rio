ALTER TABLE "players" ADD COLUMN "credits" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "prison_records" ADD COLUMN "allow_bribe" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "prison_records" ADD COLUMN "allow_bail" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "prison_records" ADD COLUMN "allow_escape" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "prison_records" ADD COLUMN "allow_faction_rescue" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "prison_records" ADD COLUMN "escape_attempted_at" timestamp with time zone;