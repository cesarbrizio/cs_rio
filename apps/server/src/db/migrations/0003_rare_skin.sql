CREATE TYPE "public"."market_order_side" AS ENUM('buy', 'sell');--> statement-breakpoint
CREATE TYPE "public"."market_order_status" AS ENUM('open', 'filled', 'cancelled');--> statement-breakpoint
ALTER TABLE "market_orders" RENAME COLUMN "seller_id" TO "player_id";--> statement-breakpoint
ALTER TABLE "market_orders" ADD COLUMN "side" "market_order_side" NOT NULL;--> statement-breakpoint
ALTER TABLE "market_orders" ADD COLUMN "status" "market_order_status" DEFAULT 'open' NOT NULL;--> statement-breakpoint
ALTER TABLE "market_orders" ADD COLUMN "remaining_quantity" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "market_orders" ADD COLUMN "durability_snapshot" integer;--> statement-breakpoint
ALTER TABLE "market_orders" ADD COLUMN "proficiency_snapshot" integer DEFAULT 0 NOT NULL;