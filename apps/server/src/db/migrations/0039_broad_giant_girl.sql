ALTER TABLE "factions" ADD COLUMN "template_code" varchar(64);--> statement-breakpoint
ALTER TABLE "factions" ADD COLUMN "sort_order" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "factions" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "favelas" ADD COLUMN "sort_order" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "favelas" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "favelas" ADD COLUMN "base_bandit_target" integer DEFAULT 26 NOT NULL;--> statement-breakpoint
ALTER TABLE "favelas" ADD COLUMN "default_satisfaction" integer DEFAULT 50 NOT NULL;--> statement-breakpoint
ALTER TABLE "regions" ADD COLUMN "sort_order" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "regions" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "regions" ADD COLUMN "is_default_spawn" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "regions" ADD COLUMN "wealth_label" varchar(32) DEFAULT 'media' NOT NULL;--> statement-breakpoint
ALTER TABLE "regions" ADD COLUMN "density_label" varchar(32) DEFAULT 'media' NOT NULL;--> statement-breakpoint
ALTER TABLE "regions" ADD COLUMN "spawn_position_x" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "regions" ADD COLUMN "spawn_position_y" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "regions" ADD COLUMN "default_police_pressure" integer DEFAULT 50 NOT NULL;