CREATE TYPE "public"."assassination_status" AS ENUM('open', 'accepted', 'completed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."chat_channel_type" AS ENUM('global', 'local', 'faction', 'private', 'trade');--> statement-breakpoint
CREATE TYPE "public"."community_supports" AS ENUM('accuser', 'accused');--> statement-breakpoint
CREATE TYPE "public"."contact_type" AS ENUM('partner', 'known');--> statement-breakpoint
CREATE TYPE "public"."crime_type" AS ENUM('solo', 'faccao', 'territorial');--> statement-breakpoint
CREATE TYPE "public"."drug_type" AS ENUM('maconha', 'lanca', 'bala', 'doce', 'md', 'cocaina', 'crack');--> statement-breakpoint
CREATE TYPE "public"."faction_rank" AS ENUM('patrao', 'general', 'gerente', 'vapor', 'soldado', 'cria');--> statement-breakpoint
CREATE TYPE "public"."game_event_type" AS ENUM('navio_docas', 'baile_cidade', 'carnaval', 'ano_novo_copa', 'operacao_policial', 'blitz_pm', 'seca_drogas', 'delacao_premiada', 'saidinha_natal', 'inspecao_trabalhista', 'bonecas_china', 'ressaca_baile', 'tribunal_trafico', 'chuva_verao', 'operacao_verao');--> statement-breakpoint
CREATE TYPE "public"."item_type" AS ENUM('weapon', 'vest', 'drug', 'consumable', 'boost', 'component', 'property_upgrade');--> statement-breakpoint
CREATE TYPE "public"."property_type" AS ENUM('boca', 'factory', 'puteiro', 'rave', 'house', 'front_store', 'slot_machine');--> statement-breakpoint
CREATE TYPE "public"."punishment" AS ENUM('aviso', 'surra', 'expulsao', 'matar', 'esquartejar', 'queimar_no_pneu');--> statement-breakpoint
CREATE TYPE "public"."region" AS ENUM('zona_sul', 'zona_norte', 'centro', 'zona_oeste', 'zona_sudoeste', 'baixada');--> statement-breakpoint
CREATE TYPE "public"."round_status" AS ENUM('scheduled', 'active', 'finished');--> statement-breakpoint
CREATE TYPE "public"."service_type" AS ENUM('gatonet', 'tvgato', 'botijao_gas', 'mototaxi', 'van', 'comercio_local');--> statement-breakpoint
CREATE TYPE "public"."soldier_type" AS ENUM('olheiro', 'soldado_rua', 'fogueteiro_alerta', 'seguranca_armado', 'mercenario');--> statement-breakpoint
CREATE TYPE "public"."tribunal_case_type" AS ENUM('roubo_entre_moradores', 'talaricagem', 'divida_jogo', 'divida_drogas', 'estupro', 'agressao', 'homicidio_nao_autorizado');--> statement-breakpoint
CREATE TYPE "public"."upgrade_type" AS ENUM('mula_nivel_1', 'mula_nivel_2', 'mula_nivel_3', 'mula_max', 'bonus_atributos_5', 'bonus_atributos_10', 'arsenal_exclusivo', 'exercito_expandido', 'qg_fortificado');--> statement-breakpoint
CREATE TYPE "public"."vocation" AS ENUM('cria', 'gerente', 'soldado', 'politico', 'empreendedor');--> statement-breakpoint
CREATE TYPE "public"."war_status" AS ENUM('declared', 'preparing', 'active', 'attacker_won', 'defender_won', 'draw', 'cancelled');--> statement-breakpoint
CREATE TABLE "assassination_contracts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"requester_id" uuid NOT NULL,
	"target_id" uuid NOT NULL,
	"reward" numeric(16, 2) NOT NULL,
	"accepted_by" uuid,
	"status" "assassination_status" DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel_type" "chat_channel_type" NOT NULL,
	"channel_id" varchar(120) NOT NULL,
	"sender_id" uuid NOT NULL,
	"message" text NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contacts" (
	"player_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"type" "contact_type" NOT NULL,
	"since" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contacts_player_id_contact_id_pk" PRIMARY KEY("player_id","contact_id")
);
--> statement-breakpoint
CREATE TABLE "crimes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(120) NOT NULL,
	"name" varchar(160) NOT NULL,
	"crime_type" "crime_type" DEFAULT 'solo' NOT NULL,
	"level_required" integer NOT NULL,
	"stamina_cost" integer NOT NULL,
	"nerve_cost" integer DEFAULT 0 NOT NULL,
	"min_power" integer NOT NULL,
	"reward_min" numeric(16, 2) NOT NULL,
	"reward_max" numeric(16, 2) NOT NULL,
	"conceito_reward" integer NOT NULL,
	"arrest_chance" integer NOT NULL,
	"cooldown_seconds" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "crimes_code_unique" UNIQUE("code"),
	CONSTRAINT "crimes_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "drugs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(80) NOT NULL,
	"name" varchar(120) NOT NULL,
	"type" "drug_type" NOT NULL,
	"stamina_recovery" integer NOT NULL,
	"moral_boost" integer NOT NULL,
	"price" numeric(16, 2) NOT NULL,
	"addiction_rate" numeric(6, 2) NOT NULL,
	"nerve_boost" integer DEFAULT 0 NOT NULL,
	"production_level" integer NOT NULL,
	CONSTRAINT "drugs_code_unique" UNIQUE("code"),
	CONSTRAINT "drugs_name_unique" UNIQUE("name"),
	CONSTRAINT "drugs_type_unique" UNIQUE("type")
);
--> statement-breakpoint
CREATE TABLE "faction_members" (
	"player_id" uuid NOT NULL,
	"faction_id" uuid NOT NULL,
	"rank" "faction_rank" DEFAULT 'cria' NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "faction_members_player_id_faction_id_pk" PRIMARY KEY("player_id","faction_id")
);
--> statement-breakpoint
CREATE TABLE "faction_upgrades" (
	"faction_id" uuid NOT NULL,
	"upgrade_type" "upgrade_type" NOT NULL,
	"level" integer DEFAULT 1 NOT NULL,
	"unlocked_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "faction_upgrades_faction_id_upgrade_type_pk" PRIMARY KEY("faction_id","upgrade_type")
);
--> statement-breakpoint
CREATE TABLE "faction_wars" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attacker_faction_id" uuid NOT NULL,
	"defender_faction_id" uuid NOT NULL,
	"favela_id" uuid NOT NULL,
	"status" "war_status" DEFAULT 'declared' NOT NULL,
	"declared_at" timestamp with time zone DEFAULT now() NOT NULL,
	"starts_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"winner_faction_id" uuid
);
--> statement-breakpoint
CREATE TABLE "factions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(120) NOT NULL,
	"abbreviation" varchar(12) NOT NULL,
	"is_fixed" boolean DEFAULT false NOT NULL,
	"leader_id" uuid,
	"initial_territory" text,
	"thematic_bonus" text,
	"bank_money" numeric(16, 2) DEFAULT '0' NOT NULL,
	"bank_drugs" integer DEFAULT 0 NOT NULL,
	"points" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "factions_name_unique" UNIQUE("name"),
	CONSTRAINT "factions_abbreviation_unique" UNIQUE("abbreviation")
);
--> statement-breakpoint
CREATE TABLE "favela_services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"favela_id" uuid NOT NULL,
	"service_type" "service_type" NOT NULL,
	"level" integer DEFAULT 1 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"installed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "favelas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(80) NOT NULL,
	"name" varchar(120) NOT NULL,
	"region_id" "region" NOT NULL,
	"population" integer NOT NULL,
	"difficulty" integer NOT NULL,
	"controlling_faction_id" uuid,
	"satisfaction" integer DEFAULT 50 NOT NULL,
	"propina_value" numeric(16, 2) DEFAULT '0' NOT NULL,
	"propina_due_date" timestamp with time zone,
	"state_controlled_until" timestamp with time zone,
	CONSTRAINT "favelas_code_unique" UNIQUE("code"),
	CONSTRAINT "favelas_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "game_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_type" "game_event_type" NOT NULL,
	"region_id" "region",
	"favela_id" uuid,
	"started_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"data_json" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "market_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"seller_id" uuid NOT NULL,
	"item_type" "item_type" NOT NULL,
	"item_id" uuid NOT NULL,
	"quantity" integer NOT NULL,
	"price_per_unit" numeric(16, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "player_inventory" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_id" uuid NOT NULL,
	"item_type" "item_type" NOT NULL,
	"item_id" uuid,
	"quantity" integer DEFAULT 1 NOT NULL,
	"durability" integer,
	"proficiency" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "players" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" text NOT NULL,
	"nickname" varchar(32) NOT NULL,
	"vocation" "vocation" NOT NULL,
	"level" integer DEFAULT 1 NOT NULL,
	"conceito" integer DEFAULT 0 NOT NULL,
	"forca" integer DEFAULT 10 NOT NULL,
	"inteligencia" integer DEFAULT 10 NOT NULL,
	"resistencia" integer DEFAULT 10 NOT NULL,
	"carisma" integer DEFAULT 10 NOT NULL,
	"stamina" integer DEFAULT 100 NOT NULL,
	"nerve" integer DEFAULT 100 NOT NULL,
	"hp" integer DEFAULT 100 NOT NULL,
	"addiction" integer DEFAULT 0 NOT NULL,
	"money" numeric(16, 2) DEFAULT '0' NOT NULL,
	"bank_money" numeric(16, 2) DEFAULT '0' NOT NULL,
	"region_id" "region" NOT NULL,
	"position_x" integer DEFAULT 0 NOT NULL,
	"position_y" integer DEFAULT 0 NOT NULL,
	"faction_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_login" timestamp with time zone,
	CONSTRAINT "players_email_unique" UNIQUE("email"),
	CONSTRAINT "players_nickname_unique" UNIQUE("nickname")
);
--> statement-breakpoint
CREATE TABLE "prison_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"sentenced_at" timestamp with time zone NOT NULL,
	"release_at" timestamp with time zone NOT NULL,
	"released_early_by" uuid
);
--> statement-breakpoint
CREATE TABLE "properties" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_id" uuid NOT NULL,
	"type" "property_type" NOT NULL,
	"region_id" "region" NOT NULL,
	"favela_id" uuid,
	"level" integer DEFAULT 1 NOT NULL,
	"soldiers_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "propina_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"faction_id" uuid NOT NULL,
	"favela_id" uuid NOT NULL,
	"amount" numeric(16, 2) NOT NULL,
	"paid_at" timestamp with time zone NOT NULL,
	"next_due" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "regions" (
	"id" "region" PRIMARY KEY NOT NULL,
	"name" varchar(80) NOT NULL,
	"wealth_index" integer NOT NULL,
	"density_index" integer NOT NULL,
	"operation_cost_multiplier" numeric(6, 2) DEFAULT '1.00' NOT NULL,
	"police_pressure" integer DEFAULT 50 NOT NULL,
	"domination_bonus" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "regions_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "round" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" integer NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"status" "round_status" DEFAULT 'scheduled' NOT NULL,
	CONSTRAINT "round_number_unique" UNIQUE("number")
);
--> statement-breakpoint
CREATE TABLE "round_rankings" (
	"round_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	"final_conceito" integer NOT NULL,
	"final_rank" integer NOT NULL,
	CONSTRAINT "round_rankings_round_id_player_id_pk" PRIMARY KEY("round_id","player_id")
);
--> statement-breakpoint
CREATE TABLE "soldier_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(80) NOT NULL,
	"type" "soldier_type" NOT NULL,
	"name" varchar(120) NOT NULL,
	"power" integer NOT NULL,
	"daily_cost" numeric(16, 2) NOT NULL,
	"level_required" integer NOT NULL,
	CONSTRAINT "soldier_templates_code_unique" UNIQUE("code"),
	CONSTRAINT "soldier_templates_type_unique" UNIQUE("type"),
	CONSTRAINT "soldier_templates_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "soldiers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"type" "soldier_type" NOT NULL,
	"power" integer NOT NULL,
	"daily_cost" numeric(16, 2) NOT NULL,
	"hired_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_id" uuid NOT NULL,
	"type" varchar(80) NOT NULL,
	"amount" numeric(16, 2) NOT NULL,
	"description" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tribunal_cases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"favela_id" uuid NOT NULL,
	"case_type" "tribunal_case_type" NOT NULL,
	"accuser_charisma_community" integer NOT NULL,
	"accuser_charisma_faction" integer NOT NULL,
	"accused_charisma_community" integer NOT NULL,
	"accused_charisma_faction" integer NOT NULL,
	"community_supports" "community_supports" NOT NULL,
	"antigao_hint" text NOT NULL,
	"punishment_chosen" "punishment",
	"moral_moradores_impact" integer,
	"moral_facao_impact" integer,
	"conceito_impact" integer,
	"judged_by" uuid,
	"judged_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "vests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(80) NOT NULL,
	"name" varchar(120) NOT NULL,
	"defense" integer NOT NULL,
	"durability_max" integer NOT NULL,
	"level_required" integer NOT NULL,
	"price" numeric(16, 2) NOT NULL,
	CONSTRAINT "vests_code_unique" UNIQUE("code"),
	CONSTRAINT "vests_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "weapons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(80) NOT NULL,
	"name" varchar(120) NOT NULL,
	"power" integer NOT NULL,
	"durability_max" integer NOT NULL,
	"level_required" integer NOT NULL,
	"price" numeric(16, 2) NOT NULL,
	CONSTRAINT "weapons_code_unique" UNIQUE("code"),
	CONSTRAINT "weapons_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "x9_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"favela_id" uuid NOT NULL,
	"triggered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"soldiers_arrested" integer DEFAULT 0 NOT NULL,
	"drugs_lost" integer DEFAULT 0 NOT NULL,
	"weapons_lost" integer DEFAULT 0 NOT NULL,
	"money_lost" numeric(16, 2) DEFAULT '0' NOT NULL
);
