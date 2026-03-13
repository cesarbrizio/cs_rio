ALTER TYPE "public"."faction_bank_origin_type" ADD VALUE 'propina';--> statement-breakpoint
ALTER TABLE "favelas" ADD COLUMN "propina_discount_rate" numeric(6, 4) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "favelas" ADD COLUMN "propina_last_paid_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "favelas" ADD COLUMN "propina_negotiated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "favelas" ADD COLUMN "propina_negotiated_by_player_id" uuid;