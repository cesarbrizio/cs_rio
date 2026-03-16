CREATE TYPE "property_sabotage_state" AS ENUM ('normal', 'damaged', 'destroyed');--> statement-breakpoint
CREATE TYPE "property_sabotage_outcome" AS ENUM ('damaged', 'destroyed', 'failure_clean', 'failure_hard');--> statement-breakpoint
CREATE TYPE "property_sabotage_owner_alert_mode" AS ENUM ('anonymous', 'identified');--> statement-breakpoint

ALTER TABLE "properties"
  ADD COLUMN "sabotage_state" "property_sabotage_state" DEFAULT 'normal' NOT NULL,
  ADD COLUMN "sabotage_resolved_at" timestamp with time zone,
  ADD COLUMN "sabotage_recovery_ready_at" timestamp with time zone;--> statement-breakpoint

CREATE TABLE "property_sabotage_logs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "property_id" uuid NOT NULL,
  "attacker_player_id" uuid NOT NULL,
  "attacker_faction_id" uuid,
  "owner_player_id" uuid NOT NULL,
  "owner_faction_id" uuid,
  "region_id" "region" NOT NULL,
  "favela_id" uuid,
  "type" "property_type" NOT NULL,
  "outcome" "property_sabotage_outcome" NOT NULL,
  "owner_alert_mode" "property_sabotage_owner_alert_mode" NOT NULL,
  "attack_score" numeric(10, 2) NOT NULL,
  "defense_score" numeric(10, 2) NOT NULL,
  "attack_ratio" numeric(10, 4) NOT NULL,
  "heat_delta" integer DEFAULT 0 NOT NULL,
  "prison_minutes" integer,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
