CREATE TYPE "public"."assassination_notification_type" AS ENUM('accepted', 'completed', 'expired', 'target_warned');--> statement-breakpoint
ALTER TYPE "public"."assassination_status" ADD VALUE 'expired';--> statement-breakpoint
CREATE TABLE "assassination_contract_notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	"type" "assassination_notification_type" NOT NULL,
	"title" varchar(120) NOT NULL,
	"message" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "assassination_contracts" ADD COLUMN "accepted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "assassination_contracts" ADD COLUMN "resolved_at" timestamp with time zone;