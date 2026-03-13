CREATE TABLE "market_system_offers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(120) NOT NULL,
	"item_type" "item_type" NOT NULL,
	"item_id" uuid NOT NULL,
	"label" varchar(160) NOT NULL,
	"price_per_unit" numeric(16, 2) NOT NULL,
	"stock_available" integer DEFAULT 0 NOT NULL,
	"stock_max" integer NOT NULL,
	"restock_amount" integer NOT NULL,
	"restock_interval_game_days" integer DEFAULT 1 NOT NULL,
	"last_restocked_round_id" uuid,
	"last_restocked_game_day" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "market_system_offers_code_unique" UNIQUE("code"),
	CONSTRAINT "market_system_offers_stock_available_non_negative_chk" CHECK ("market_system_offers"."stock_available" >= 0),
	CONSTRAINT "market_system_offers_restock_amount_positive_chk" CHECK ("market_system_offers"."restock_amount" > 0),
	CONSTRAINT "market_system_offers_restock_interval_positive_chk" CHECK ("market_system_offers"."restock_interval_game_days" > 0),
	CONSTRAINT "market_system_offers_stock_max_positive_chk" CHECK ("market_system_offers"."stock_max" > 0),
	CONSTRAINT "market_system_offers_stock_available_within_max_chk" CHECK ("market_system_offers"."stock_available" <= "market_system_offers"."stock_max")
);
--> statement-breakpoint
CREATE TABLE "player_operation_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	"actor" varchar(120) DEFAULT 'local' NOT NULL,
	"origin" varchar(120) DEFAULT 'manual_cli' NOT NULL,
	"operation_type" varchar(80) NOT NULL,
	"summary" text NOT NULL,
	"payload_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"before_json" jsonb,
	"after_json" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "world_operation_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" uuid NOT NULL,
	"actor" varchar(120) DEFAULT 'local' NOT NULL,
	"origin" varchar(120) DEFAULT 'manual_cli' NOT NULL,
	"operation_type" varchar(80) NOT NULL,
	"target_type" varchar(80) NOT NULL,
	"player_id" uuid,
	"faction_id" uuid,
	"favela_id" uuid,
	"property_id" uuid,
	"summary" text NOT NULL,
	"payload_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"before_json" jsonb,
	"after_json" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
