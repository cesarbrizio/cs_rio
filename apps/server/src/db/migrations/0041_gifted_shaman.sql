CREATE TABLE "round_feature_flag_overrides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"round_id" uuid NOT NULL,
	"scope" "game_config_scope" DEFAULT 'global' NOT NULL,
	"target_key" varchar(120) DEFAULT '*' NOT NULL,
	"key" varchar(160) NOT NULL,
	"status" "game_config_status" DEFAULT 'inactive' NOT NULL,
	"payload_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"effective_from" timestamp with time zone DEFAULT now() NOT NULL,
	"effective_until" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "round_feature_flag_overrides_round_scope_target_key_key_idx" ON "round_feature_flag_overrides" USING btree ("round_id","scope","target_key","key");