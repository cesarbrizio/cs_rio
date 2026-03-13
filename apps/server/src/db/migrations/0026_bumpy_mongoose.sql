CREATE TABLE "favela_bailes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"favela_id" uuid NOT NULL,
	"faction_id" uuid NOT NULL,
	"organized_by_player_id" uuid NOT NULL,
	"budget" numeric(16, 2) NOT NULL,
	"entry_price" numeric(16, 2) NOT NULL,
	"mc_tier" varchar(24) NOT NULL,
	"result_tier" varchar(24) NOT NULL,
	"satisfaction_delta" integer NOT NULL,
	"faction_points_delta" integer NOT NULL,
	"stamina_boost_percent" integer NOT NULL,
	"incident_code" varchar(40),
	"organized_at" timestamp with time zone DEFAULT now() NOT NULL,
	"baile_ends_at" timestamp with time zone,
	"hangover_ends_at" timestamp with time zone,
	"cooldown_ends_at" timestamp with time zone NOT NULL
);
