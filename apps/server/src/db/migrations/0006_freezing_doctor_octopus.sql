CREATE TABLE "components" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(80) NOT NULL,
	"name" varchar(120) NOT NULL,
	"price" numeric(16, 2) NOT NULL,
	"weight" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "components_code_unique" UNIQUE("code"),
	CONSTRAINT "components_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "drug_factories" (
	"property_id" uuid PRIMARY KEY NOT NULL,
	"drug_id" uuid NOT NULL,
	"stored_output" integer DEFAULT 0 NOT NULL,
	"last_cycle_at" timestamp with time zone NOT NULL,
	"last_maintenance_at" timestamp with time zone NOT NULL,
	"impulse_multiplier" numeric(6, 2) DEFAULT '1.00' NOT NULL,
	"suspended" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drug_factory_component_stocks" (
	"property_id" uuid NOT NULL,
	"component_id" uuid NOT NULL,
	"quantity" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "drug_factory_component_stocks_property_id_component_id_pk" PRIMARY KEY("property_id","component_id")
);
--> statement-breakpoint
CREATE TABLE "drug_factory_recipe_components" (
	"drug_id" uuid NOT NULL,
	"component_id" uuid NOT NULL,
	"quantity_required" integer NOT NULL,
	CONSTRAINT "drug_factory_recipe_components_drug_id_component_id_pk" PRIMARY KEY("drug_id","component_id")
);
--> statement-breakpoint
CREATE TABLE "drug_factory_recipes" (
	"drug_id" uuid PRIMARY KEY NOT NULL,
	"base_production" integer NOT NULL,
	"cycle_minutes" integer DEFAULT 60 NOT NULL,
	"daily_maintenance_cost" numeric(16, 2) NOT NULL
);
