CREATE TYPE "public"."gp_type" AS ENUM('novinha', 'experiente', 'premium', 'vip', 'diamante');--> statement-breakpoint
CREATE TYPE "public"."puteiro_gp_status" AS ENUM('active', 'escaped', 'deceased');--> statement-breakpoint
CREATE TABLE "puteiro_gps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"type" "gp_type" NOT NULL,
	"status" "puteiro_gp_status" DEFAULT 'active' NOT NULL,
	"has_dst" boolean DEFAULT false NOT NULL,
	"dst_recovers_at" timestamp with time zone,
	"purchased_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_incident_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "puteiro_operations" (
	"property_id" uuid PRIMARY KEY NOT NULL,
	"cash_balance" numeric(16, 2) DEFAULT '0' NOT NULL,
	"gross_revenue_total" numeric(16, 2) DEFAULT '0' NOT NULL,
	"faction_commission_total" numeric(16, 2) DEFAULT '0' NOT NULL,
	"total_escapes" integer DEFAULT 0 NOT NULL,
	"total_deaths" integer DEFAULT 0 NOT NULL,
	"total_dst_incidents" integer DEFAULT 0 NOT NULL,
	"last_revenue_at" timestamp with time zone NOT NULL,
	"last_collected_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
