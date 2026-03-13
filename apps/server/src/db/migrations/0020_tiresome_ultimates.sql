CREATE TYPE "public"."favela_control_state" AS ENUM('neutral', 'controlled', 'at_war', 'state');--> statement-breakpoint
ALTER TABLE "favelas" ADD COLUMN "state" "favela_control_state" DEFAULT 'neutral' NOT NULL;--> statement-breakpoint
ALTER TABLE "favelas" ADD COLUMN "contesting_faction_id" uuid;--> statement-breakpoint
ALTER TABLE "favelas" ADD COLUMN "war_declared_at" timestamp with time zone;