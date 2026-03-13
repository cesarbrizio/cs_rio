CREATE TABLE "slot_machine_operations" (
	"property_id" uuid PRIMARY KEY NOT NULL,
	"machines_installed" integer DEFAULT 0 NOT NULL,
	"house_edge" numeric(6, 4) DEFAULT '0.2200' NOT NULL,
	"jackpot_chance" numeric(6, 4) DEFAULT '0.0100' NOT NULL,
	"min_bet" numeric(16, 2) DEFAULT '100.00' NOT NULL,
	"max_bet" numeric(16, 2) DEFAULT '1000.00' NOT NULL,
	"cash_balance" numeric(16, 2) DEFAULT '0' NOT NULL,
	"gross_revenue_total" numeric(16, 2) DEFAULT '0' NOT NULL,
	"faction_commission_total" numeric(16, 2) DEFAULT '0' NOT NULL,
	"last_play_at" timestamp with time zone NOT NULL,
	"last_collected_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
