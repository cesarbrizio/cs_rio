CREATE TYPE "public"."market_auction_notification_type" AS ENUM('outbid', 'returned', 'sold', 'won');--> statement-breakpoint
CREATE TYPE "public"."market_auction_status" AS ENUM('open', 'settled', 'expired');--> statement-breakpoint
CREATE TABLE "market_auction_bids" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"auction_id" uuid NOT NULL,
	"bidder_player_id" uuid NOT NULL,
	"amount" numeric(16, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "market_auction_notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_id" uuid NOT NULL,
	"auction_id" uuid NOT NULL,
	"type" "market_auction_notification_type" NOT NULL,
	"title" varchar(160) NOT NULL,
	"message" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "market_auctions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_id" uuid NOT NULL,
	"status" "market_auction_status" DEFAULT 'open' NOT NULL,
	"item_type" "item_type" NOT NULL,
	"item_id" uuid NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"starting_bid" numeric(16, 2) NOT NULL,
	"current_bid" numeric(16, 2),
	"buyout_price" numeric(16, 2),
	"leading_bidder_id" uuid,
	"durability_snapshot" integer,
	"proficiency_snapshot" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"settled_at" timestamp with time zone
);
