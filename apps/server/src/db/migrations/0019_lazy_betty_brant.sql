CREATE TYPE "public"."faction_leadership_election_status" AS ENUM('petitioning', 'active', 'resolved');--> statement-breakpoint
CREATE TABLE "faction_leadership_challenges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"faction_id" uuid NOT NULL,
	"challenger_player_id" uuid NOT NULL,
	"challenger_won" boolean NOT NULL,
	"challenger_power" integer NOT NULL,
	"defender_player_id" uuid,
	"defender_was_npc" boolean DEFAULT false NOT NULL,
	"defender_power" integer NOT NULL,
	"success_chance_percent" integer NOT NULL,
	"challenger_hp_delta" integer NOT NULL,
	"challenger_conceito_delta" integer NOT NULL,
	"defender_hp_delta" integer NOT NULL,
	"defender_conceito_delta" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone NOT NULL,
	"cooldown_ends_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "faction_leadership_election_supports" (
	"election_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	"supported_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "faction_leadership_election_supports_election_id_player_id_pk" PRIMARY KEY("election_id","player_id")
);
--> statement-breakpoint
CREATE TABLE "faction_leadership_election_votes" (
	"election_id" uuid NOT NULL,
	"voter_player_id" uuid NOT NULL,
	"candidate_player_id" uuid NOT NULL,
	"voted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "faction_leadership_election_votes_election_id_voter_player_id_pk" PRIMARY KEY("election_id","voter_player_id")
);
--> statement-breakpoint
CREATE TABLE "faction_leadership_elections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"faction_id" uuid NOT NULL,
	"requested_by_player_id" uuid,
	"status" "faction_leadership_election_status" DEFAULT 'petitioning' NOT NULL,
	"support_threshold" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"resolved_at" timestamp with time zone,
	"cooldown_ends_at" timestamp with time zone,
	"winner_player_id" uuid
);
