CREATE TYPE "public"."config_operation_type" AS ENUM('activate_set', 'upsert_set_entry', 'upsert_round_override', 'upsert_feature_flag', 'upsert_round_feature_flag');--> statement-breakpoint
CREATE TABLE "config_operation_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"operation_type" "config_operation_type" NOT NULL,
	"actor" varchar(120) DEFAULT 'local' NOT NULL,
	"origin" varchar(120) DEFAULT 'manual_cli' NOT NULL,
	"config_set_id" uuid,
	"round_id" uuid,
	"affected_record_id" uuid,
	"scope" "game_config_scope",
	"target_key" varchar(120),
	"key" varchar(160),
	"status" "game_config_status",
	"payload_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "config_runtime_state" (
	"singleton_key" varchar(32) PRIMARY KEY NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"last_operation_id" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
