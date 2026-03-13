ALTER TABLE "faction_wars" ADD COLUMN "declared_by_player_id" uuid;--> statement-breakpoint
ALTER TABLE "faction_wars" ADD COLUMN "preparation_ends_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "faction_wars" ADD COLUMN "next_round_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "faction_wars" ADD COLUMN "cooldown_ends_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "faction_wars" ADD COLUMN "attacker_preparation_json" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "faction_wars" ADD COLUMN "defender_preparation_json" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "faction_wars" ADD COLUMN "round_results_json" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "faction_wars" ADD COLUMN "attacker_score" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "faction_wars" ADD COLUMN "defender_score" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "faction_wars" ADD COLUMN "rounds_resolved" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "faction_wars" ADD COLUMN "rounds_total" integer DEFAULT 3 NOT NULL;--> statement-breakpoint
ALTER TABLE "faction_wars" ADD COLUMN "loot_money" numeric(16, 2) DEFAULT '0' NOT NULL;