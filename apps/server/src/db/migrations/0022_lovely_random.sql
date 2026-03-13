ALTER TYPE "public"."faction_bank_entry_type" ADD VALUE 'service_income';--> statement-breakpoint
ALTER TYPE "public"."faction_bank_origin_type" ADD VALUE 'favela_service';--> statement-breakpoint
ALTER TABLE "favela_services" ADD COLUMN "gross_revenue_total" numeric(16, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "favela_services" ADD COLUMN "last_revenue_at" timestamp with time zone DEFAULT now() NOT NULL;