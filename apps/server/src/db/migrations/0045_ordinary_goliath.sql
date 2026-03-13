CREATE TABLE "round_operation_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" uuid NOT NULL,
	"actor" varchar(120) DEFAULT 'local' NOT NULL,
	"origin" varchar(120) DEFAULT 'manual_cli' NOT NULL,
	"operation_type" varchar(80) NOT NULL,
	"round_id" uuid,
	"event_type" "game_event_type",
	"region_id" "region",
	"favela_id" uuid,
	"summary" text NOT NULL,
	"payload_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"before_json" jsonb,
	"after_json" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
