CREATE TYPE "public"."bandit_return_flavor" AS ENUM('audiencia_custodia', 'habeas_corpus', 'lili_cantou');--> statement-breakpoint
CREATE TABLE "favela_bandit_returns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"favela_id" uuid NOT NULL,
	"quantity" integer NOT NULL,
	"return_flavor" "bandit_return_flavor" NOT NULL,
	"release_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "favelas" ADD COLUMN "max_soldiers" integer DEFAULT 20 NOT NULL;--> statement-breakpoint
ALTER TABLE "favelas" ADD COLUMN "bandits_active" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "favelas" ADD COLUMN "bandits_arrested" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "favelas" ADD COLUMN "bandits_dead_recent" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "favelas" ADD COLUMN "bandits_synced_at" timestamp with time zone DEFAULT now() NOT NULL;
--> statement-breakpoint
UPDATE "favelas"
SET
  "max_soldiers" = CASE
    WHEN "population" >= 80000 OR "difficulty" >= 10 THEN 80
    WHEN "population" >= 50000 OR "difficulty" >= 9 THEN 65
    WHEN "population" >= 30000 OR "difficulty" >= 8 THEN 50
    WHEN "population" >= 15000 OR "difficulty" >= 7 THEN 36
    WHEN "population" >= 8000 OR "difficulty" >= 6 THEN 28
    ELSE 18
  END,
  "bandits_active" = CASE
    WHEN "population" >= 80000 OR "difficulty" >= 10 THEN 110
    WHEN "population" >= 50000 OR "difficulty" >= 9 THEN 88
    WHEN "population" >= 30000 OR "difficulty" >= 8 THEN 68
    WHEN "population" >= 15000 OR "difficulty" >= 7 THEN 50
    WHEN "population" >= 8000 OR "difficulty" >= 6 THEN 38
    ELSE 26
  END,
  "bandits_synced_at" = now();
