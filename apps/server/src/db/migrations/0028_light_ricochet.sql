ALTER TABLE "tribunal_cases" ADD COLUMN "accuser_name" varchar(120) NOT NULL;--> statement-breakpoint
ALTER TABLE "tribunal_cases" ADD COLUMN "accused_name" varchar(120) NOT NULL;--> statement-breakpoint
ALTER TABLE "tribunal_cases" ADD COLUMN "accuser_statement" text NOT NULL;--> statement-breakpoint
ALTER TABLE "tribunal_cases" ADD COLUMN "accused_statement" text NOT NULL;--> statement-breakpoint
ALTER TABLE "tribunal_cases" ADD COLUMN "truth_side" "community_supports" NOT NULL;--> statement-breakpoint
ALTER TABLE "tribunal_cases" ADD COLUMN "antigao_suggested_punishment" "punishment" NOT NULL;--> statement-breakpoint
ALTER TABLE "tribunal_cases" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;