CREATE TYPE "public"."hospital_stat_item_code" AS ENUM('cerebrina', 'pocao_carisma', 'creatina', 'deca_durabolin');--> statement-breakpoint
CREATE TABLE "player_hospital_stat_purchases" (
	"player_id" uuid NOT NULL,
	"cycle_key" varchar(32) NOT NULL,
	"item_code" "hospital_stat_item_code" NOT NULL,
	"quantity" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "player_hospital_stat_purchases_player_id_cycle_key_item_code_pk" PRIMARY KEY("player_id","cycle_key","item_code")
);
--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "has_dst" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "dst_recovers_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "health_plan_cycle_key" varchar(32);