CREATE TYPE "public"."training_type" AS ENUM('basic', 'advanced', 'intensive');--> statement-breakpoint
CREATE TABLE "training_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_id" uuid NOT NULL,
	"type" "training_type" NOT NULL,
	"cost_money" numeric(16, 2) NOT NULL,
	"cost_stamina" integer NOT NULL,
	"diminishing_multiplier" numeric(6, 4) NOT NULL,
	"streak_index" integer DEFAULT 0 NOT NULL,
	"forca_gain" integer NOT NULL,
	"inteligencia_gain" integer NOT NULL,
	"resistencia_gain" integer NOT NULL,
	"carisma_gain" integer NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"claimed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
