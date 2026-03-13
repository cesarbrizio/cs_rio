CREATE TYPE "public"."bicho_bet_mode" AS ENUM('cabeca', 'grupo', 'dezena');--> statement-breakpoint
CREATE TYPE "public"."bicho_bet_status" AS ENUM('pending', 'won', 'lost');--> statement-breakpoint
CREATE TABLE "bicho_bets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_id" uuid NOT NULL,
	"draw_id" uuid NOT NULL,
	"mode" "bicho_bet_mode" NOT NULL,
	"animal_number" integer,
	"dozen" integer,
	"amount" numeric(16, 2) NOT NULL,
	"payout" numeric(16, 2) DEFAULT '0' NOT NULL,
	"status" "bicho_bet_status" DEFAULT 'pending' NOT NULL,
	"placed_at" timestamp with time zone NOT NULL,
	"settled_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "bicho_draws" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sequence" integer NOT NULL,
	"opens_at" timestamp with time zone NOT NULL,
	"closes_at" timestamp with time zone NOT NULL,
	"winning_animal_number" integer,
	"winning_dozen" integer,
	"total_bet_amount" numeric(16, 2) DEFAULT '0' NOT NULL,
	"total_payout_amount" numeric(16, 2) DEFAULT '0' NOT NULL,
	"settled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
