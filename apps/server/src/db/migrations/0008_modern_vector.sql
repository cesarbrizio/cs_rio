CREATE TABLE "boca_drug_stocks" (
	"property_id" uuid NOT NULL,
	"drug_id" uuid NOT NULL,
	"quantity" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "boca_drug_stocks_property_id_drug_id_pk" PRIMARY KEY("property_id","drug_id")
);
--> statement-breakpoint
CREATE TABLE "boca_operations" (
	"property_id" uuid PRIMARY KEY NOT NULL,
	"cash_balance" numeric(16, 2) DEFAULT '0' NOT NULL,
	"gross_revenue_total" numeric(16, 2) DEFAULT '0' NOT NULL,
	"faction_commission_total" numeric(16, 2) DEFAULT '0' NOT NULL,
	"last_sale_at" timestamp with time zone NOT NULL,
	"last_collected_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
