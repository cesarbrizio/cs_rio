CREATE TYPE "public"."faction_bank_entry_type" AS ENUM('deposit', 'withdrawal', 'business_commission');--> statement-breakpoint
CREATE TYPE "public"."faction_bank_origin_type" AS ENUM('manual', 'boca', 'rave', 'puteiro', 'front_store', 'slot_machine');--> statement-breakpoint
CREATE TABLE "faction_bank_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"faction_id" uuid NOT NULL,
	"player_id" uuid,
	"property_id" uuid,
	"entry_type" "faction_bank_entry_type" NOT NULL,
	"origin_type" "faction_bank_origin_type" NOT NULL,
	"gross_amount" numeric(16, 2) DEFAULT '0' NOT NULL,
	"commission_amount" numeric(16, 2) DEFAULT '0' NOT NULL,
	"net_amount" numeric(16, 2) DEFAULT '0' NOT NULL,
	"balance_after" numeric(16, 2) NOT NULL,
	"description" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
