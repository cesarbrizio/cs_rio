CREATE TYPE "public"."university_course_code" AS ENUM('mao_leve', 'corrida_de_fuga', 'olho_clinico', 'rei_da_rua', 'logistica_de_boca', 'rede_de_distribuicao', 'quimico_mestre', 'magnata_do_po', 'tiro_certeiro', 'emboscada_perfeita', 'instinto_de_sobrevivencia', 'maquina_de_guerra', 'labia_de_politico', 'rede_de_contatos', 'manipulacao_de_massa', 'poderoso_chefao', 'engenharia_financeira', 'faro_para_negocios', 'mercado_paralelo', 'imperio_do_crime');--> statement-breakpoint
CREATE TABLE "university_enrollments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_id" uuid NOT NULL,
	"course_code" "university_course_code" NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
