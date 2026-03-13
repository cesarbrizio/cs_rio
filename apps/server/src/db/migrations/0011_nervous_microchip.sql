CREATE TYPE "public"."front_store_batch_status" AS ENUM('pending', 'completed', 'seized');--> statement-breakpoint
CREATE TYPE "public"."front_store_kind" AS ENUM('lava_rapido', 'barbearia', 'igreja', 'acai', 'oficina');--> statement-breakpoint
CREATE TABLE "front_store_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"invested_amount" numeric(16, 2) NOT NULL,
	"expected_clean_return" numeric(16, 2) NOT NULL,
	"resolved_clean_amount" numeric(16, 2) DEFAULT '0' NOT NULL,
	"seized_amount" numeric(16, 2) DEFAULT '0' NOT NULL,
	"investigation_risk" numeric(6, 4) NOT NULL,
	"status" "front_store_batch_status" DEFAULT 'pending' NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"completes_at" timestamp with time zone NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "front_store_operations" (
	"property_id" uuid PRIMARY KEY NOT NULL,
	"store_kind" "front_store_kind",
	"cash_balance" numeric(16, 2) DEFAULT '0' NOT NULL,
	"gross_revenue_total" numeric(16, 2) DEFAULT '0' NOT NULL,
	"faction_commission_total" numeric(16, 2) DEFAULT '0' NOT NULL,
	"total_laundered_clean" numeric(16, 2) DEFAULT '0' NOT NULL,
	"total_seized_amount" numeric(16, 2) DEFAULT '0' NOT NULL,
	"investigations_total" integer DEFAULT 0 NOT NULL,
	"last_revenue_at" timestamp with time zone NOT NULL,
	"last_collected_at" timestamp with time zone,
	"investigation_active_until" timestamp with time zone,
	"last_investigation_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
