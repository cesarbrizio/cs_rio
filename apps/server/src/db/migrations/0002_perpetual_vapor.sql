CREATE TYPE "public"."inventory_equip_slot" AS ENUM('weapon', 'vest');--> statement-breakpoint
ALTER TABLE "drugs" ADD COLUMN "weight" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "player_inventory" ADD COLUMN "equipped_slot" "inventory_equip_slot";--> statement-breakpoint
ALTER TABLE "vests" ADD COLUMN "weight" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "weapons" ADD COLUMN "weight" integer DEFAULT 1 NOT NULL;