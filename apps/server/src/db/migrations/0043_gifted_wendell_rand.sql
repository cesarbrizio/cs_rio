ALTER TABLE "config_operation_logs" ADD COLUMN "batch_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "config_operation_logs" ADD COLUMN "summary" text NOT NULL;--> statement-breakpoint
ALTER TABLE "config_operation_logs" ADD COLUMN "validation_json" jsonb;--> statement-breakpoint
ALTER TABLE "config_operation_logs" ADD COLUMN "before_json" jsonb;--> statement-breakpoint
ALTER TABLE "config_operation_logs" ADD COLUMN "after_json" jsonb;--> statement-breakpoint
ALTER TABLE "feature_flags" ADD CONSTRAINT "feature_flags_effective_window_chk" CHECK ("feature_flags"."effective_until" IS NULL OR "feature_flags"."effective_until" > "feature_flags"."effective_from");--> statement-breakpoint
ALTER TABLE "feature_flags" ADD CONSTRAINT "feature_flags_target_key_non_blank_chk" CHECK (char_length(btrim("feature_flags"."target_key")) > 0);--> statement-breakpoint
ALTER TABLE "game_config_entries" ADD CONSTRAINT "game_config_entries_effective_window_chk" CHECK ("game_config_entries"."effective_until" IS NULL OR "game_config_entries"."effective_until" > "game_config_entries"."effective_from");--> statement-breakpoint
ALTER TABLE "game_config_entries" ADD CONSTRAINT "game_config_entries_target_key_non_blank_chk" CHECK (char_length(btrim("game_config_entries"."target_key")) > 0);--> statement-breakpoint
ALTER TABLE "round_config_overrides" ADD CONSTRAINT "round_config_overrides_effective_window_chk" CHECK ("round_config_overrides"."effective_until" IS NULL OR "round_config_overrides"."effective_until" > "round_config_overrides"."effective_from");--> statement-breakpoint
ALTER TABLE "round_config_overrides" ADD CONSTRAINT "round_config_overrides_target_key_non_blank_chk" CHECK (char_length(btrim("round_config_overrides"."target_key")) > 0);--> statement-breakpoint
ALTER TABLE "round_feature_flag_overrides" ADD CONSTRAINT "round_feature_flag_overrides_effective_window_chk" CHECK ("round_feature_flag_overrides"."effective_until" IS NULL OR "round_feature_flag_overrides"."effective_until" > "round_feature_flag_overrides"."effective_from");--> statement-breakpoint
ALTER TABLE "round_feature_flag_overrides" ADD CONSTRAINT "round_feature_flag_overrides_target_key_non_blank_chk" CHECK (char_length(btrim("round_feature_flag_overrides"."target_key")) > 0);