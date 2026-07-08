import { MigrationInterface, QueryRunner } from 'typeorm';

/** Schema inicial da Fase 0 + tabelas placeholder (items, zone_boss_cooldowns). */
export class InitSchema1720000000000 implements MigrationInterface {
  name = 'InitSchema1720000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);

    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "email" text NOT NULL,
        "password_hash" text NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_users" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_users_email" UNIQUE ("email")
      );
    `);

    await queryRunner.query(`
      CREATE TABLE "classes" (
        "id" smallint NOT NULL,
        "name" text NOT NULL,
        "base_attack" real NOT NULL,
        "base_survivability" real NOT NULL,
        "attack_growth" real NOT NULL,
        "survivability_growth" real NOT NULL,
        CONSTRAINT "PK_classes" PRIMARY KEY ("id")
      );
    `);

    await queryRunner.query(`
      CREATE TABLE "zones" (
        "id" smallint NOT NULL,
        "name" text NOT NULL,
        "min_power_score" bigint NOT NULL DEFAULT 0,
        "xp_rate_per_power_sec" real NOT NULL,
        "gold_rate_per_power_sec" real NOT NULL,
        "offline_cap_seconds" integer NOT NULL DEFAULT 28800,
        CONSTRAINT "PK_zones" PRIMARY KEY ("id")
      );
    `);

    await queryRunner.query(`
      CREATE TABLE "characters" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "class_id" smallint NOT NULL,
        "level" integer NOT NULL DEFAULT 1,
        "xp" bigint NOT NULL DEFAULT 0,
        "gold" bigint NOT NULL DEFAULT 0,
        "prestige_tier" smallint NOT NULL DEFAULT 0,
        "current_zone_id" smallint NOT NULL,
        "combat_power" bigint NOT NULL DEFAULT 0,
        "last_collected_at" timestamptz NOT NULL DEFAULT now(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_characters" PRIMARY KEY ("id"),
        CONSTRAINT "FK_characters_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_characters_class" FOREIGN KEY ("class_id")
          REFERENCES "classes"("id"),
        CONSTRAINT "FK_characters_zone" FOREIGN KEY ("current_zone_id")
          REFERENCES "zones"("id")
      );
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_characters_collect" ON "characters" ("id", "last_collected_at");
    `);

    await queryRunner.query(`
      CREATE TABLE "character_builds" (
        "character_id" uuid NOT NULL,
        "talents" jsonb NOT NULL DEFAULT '{}',
        "equipped_items" jsonb NOT NULL DEFAULT '{}',
        "active_consumables" jsonb NOT NULL DEFAULT '[]',
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_character_builds" PRIMARY KEY ("character_id"),
        CONSTRAINT "FK_character_builds_character" FOREIGN KEY ("character_id")
          REFERENCES "characters"("id") ON DELETE CASCADE
      );
    `);

    await queryRunner.query(`
      CREATE TABLE "items" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "character_id" uuid NOT NULL,
        "template_id" smallint NOT NULL,
        "rarity" smallint NOT NULL,
        "affixes" jsonb NOT NULL DEFAULT '{}',
        "durability" smallint NOT NULL DEFAULT 100,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_items" PRIMARY KEY ("id"),
        CONSTRAINT "FK_items_character" FOREIGN KEY ("character_id")
          REFERENCES "characters"("id") ON DELETE CASCADE
      );
    `);

    await queryRunner.query(`
      CREATE TABLE "zone_boss_cooldowns" (
        "character_id" uuid NOT NULL,
        "boss_id" smallint NOT NULL,
        "last_kill_at" timestamptz NOT NULL,
        CONSTRAINT "PK_zone_boss_cooldowns" PRIMARY KEY ("character_id", "boss_id"),
        CONSTRAINT "FK_zbc_character" FOREIGN KEY ("character_id")
          REFERENCES "characters"("id") ON DELETE CASCADE
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "zone_boss_cooldowns";`);
    await queryRunner.query(`DROP TABLE "items";`);
    await queryRunner.query(`DROP TABLE "character_builds";`);
    await queryRunner.query(`DROP INDEX "idx_characters_collect";`);
    await queryRunner.query(`DROP TABLE "characters";`);
    await queryRunner.query(`DROP TABLE "zones";`);
    await queryRunner.query(`DROP TABLE "classes";`);
    await queryRunner.query(`DROP TABLE "users";`);
  }
}
