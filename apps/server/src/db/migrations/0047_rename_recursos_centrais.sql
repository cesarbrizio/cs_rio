ALTER TABLE "players" RENAME COLUMN "stamina" TO "cansaco";
ALTER TABLE "players" RENAME COLUMN "nerve" TO "disposicao";
ALTER TABLE "players" RENAME COLUMN "morale" TO "brisa";

ALTER TABLE "crimes" RENAME COLUMN "stamina_cost" TO "cansaco_cost";
ALTER TABLE "crimes" RENAME COLUMN "nerve_cost" TO "disposicao_cost";

ALTER TABLE "drugs" RENAME COLUMN "stamina_recovery" TO "cansaco_recovery";
ALTER TABLE "drugs" RENAME COLUMN "moral_boost" TO "brisa_boost";
ALTER TABLE "drugs" RENAME COLUMN "nerve_boost" TO "disposicao_boost";

ALTER TABLE "training_sessions" RENAME COLUMN "cost_stamina" TO "cost_cansaco";

ALTER TABLE "favela_bailes" RENAME COLUMN "stamina_boost_percent" TO "cansaco_boost_percent";
