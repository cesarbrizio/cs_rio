CREATE TYPE "public"."x9_event_status" AS ENUM('warning', 'pending_desenrolo', 'jailed', 'resolved');--> statement-breakpoint
ALTER TABLE "favelas" ADD COLUMN "last_x9_roll_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "x9_events" ADD COLUMN "status" "x9_event_status" DEFAULT 'warning' NOT NULL;--> statement-breakpoint
ALTER TABLE "x9_events" ADD COLUMN "warning_ends_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "x9_events" ADD COLUMN "incursion_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "x9_events" ADD COLUMN "soldiers_release_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "x9_events" ADD COLUMN "soldier_impact_json" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "x9_events" ADD COLUMN "desenrolo_base_money_cost" numeric(16, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "x9_events" ADD COLUMN "desenrolo_base_points_cost" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "x9_events" ADD COLUMN "desenrolo_money_spent" numeric(16, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "x9_events" ADD COLUMN "desenrolo_points_spent" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "x9_events" ADD COLUMN "desenrolo_negotiator_player_id" uuid;--> statement-breakpoint
ALTER TABLE "x9_events" ADD COLUMN "desenrolo_attempted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "x9_events" ADD COLUMN "desenrolo_succeeded" boolean;--> statement-breakpoint
ALTER TABLE "x9_events" ADD COLUMN "resolved_at" timestamp with time zone;