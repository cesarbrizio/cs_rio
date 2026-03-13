CREATE TYPE "public"."game_config_scope" AS ENUM('global', 'round', 'region', 'favela', 'faction_template', 'event_type', 'robbery_type');--> statement-breakpoint
CREATE TYPE "public"."game_config_status" AS ENUM('active', 'inactive');--> statement-breakpoint
CREATE TABLE "feature_flags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"config_set_id" uuid NOT NULL,
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
CREATE TABLE "game_config_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"config_set_id" uuid NOT NULL,
	"scope" "game_config_scope" DEFAULT 'global' NOT NULL,
	"target_key" varchar(120) DEFAULT '*' NOT NULL,
	"key" varchar(160) NOT NULL,
	"value_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" "game_config_status" DEFAULT 'active' NOT NULL,
	"effective_from" timestamp with time zone DEFAULT now() NOT NULL,
	"effective_until" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "game_config_sets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(80) NOT NULL,
	"name" varchar(160) NOT NULL,
	"description" text,
	"status" "game_config_status" DEFAULT 'active' NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "game_config_sets_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "round_config_overrides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"round_id" uuid NOT NULL,
	"scope" "game_config_scope" DEFAULT 'global' NOT NULL,
	"target_key" varchar(120) DEFAULT '*' NOT NULL,
	"key" varchar(160) NOT NULL,
	"value_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" "game_config_status" DEFAULT 'active' NOT NULL,
	"effective_from" timestamp with time zone DEFAULT now() NOT NULL,
	"effective_until" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "feature_flags_config_scope_target_key_key_idx" ON "feature_flags" USING btree ("config_set_id","scope","target_key","key");--> statement-breakpoint
CREATE UNIQUE INDEX "game_config_entries_config_scope_target_key_key_idx" ON "game_config_entries" USING btree ("config_set_id","scope","target_key","key");--> statement-breakpoint
CREATE UNIQUE INDEX "round_config_overrides_round_scope_target_key_key_idx" ON "round_config_overrides" USING btree ("round_id","scope","target_key","key");