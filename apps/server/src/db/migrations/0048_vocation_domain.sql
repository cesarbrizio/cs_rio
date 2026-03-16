ALTER TABLE "players"
  ADD COLUMN "vocation_changed_at" timestamp with time zone,
  ADD COLUMN "vocation_target" "vocation",
  ADD COLUMN "vocation_transition_ends_at" timestamp with time zone;
