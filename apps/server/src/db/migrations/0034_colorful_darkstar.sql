CREATE TYPE "public"."player_bank_entry_type" AS ENUM('deposit', 'withdrawal', 'interest');--> statement-breakpoint
CREATE TABLE "player_bank_daily_deposits" (
	"player_id" uuid NOT NULL,
	"cycle_key" varchar(16) NOT NULL,
	"deposited_amount" numeric(16, 2) DEFAULT '0' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "player_bank_daily_deposits_player_id_cycle_key_pk" PRIMARY KEY("player_id","cycle_key")
);
--> statement-breakpoint
CREATE TABLE "player_bank_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_id" uuid NOT NULL,
	"entry_type" "player_bank_entry_type" NOT NULL,
	"gross_amount" numeric(16, 2) NOT NULL,
	"fee_amount" numeric(16, 2) DEFAULT '0' NOT NULL,
	"net_amount" numeric(16, 2) NOT NULL,
	"balance_after" numeric(16, 2) NOT NULL,
	"description" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "bank_interest_synced_at" timestamp with time zone DEFAULT now() NOT NULL;