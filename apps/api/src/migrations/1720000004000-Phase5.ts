import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Fase 5: apelido opcional (identidade no leaderboard) + tabela de
 * recompensas de world boss (não reivindicadas até o personagem resgatar).
 * HP/contribuições do evento em si vivem só no Redis — efêmero, sem schema.
 */
export class Phase51720000004000 implements MigrationInterface {
  name = 'Phase51720000004000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "characters" ADD COLUMN "nickname" text;
    `);

    await queryRunner.query(`
      CREATE TABLE "world_boss_rewards" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "character_id" uuid NOT NULL,
        "event_id" text NOT NULL,
        "gold_awarded" bigint NOT NULL DEFAULT 0,
        "xp_awarded" bigint NOT NULL DEFAULT 0,
        "item_template_id" smallint,
        "item_rarity" smallint,
        "item_affixes" jsonb,
        "claimed" boolean NOT NULL DEFAULT false,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_world_boss_rewards" PRIMARY KEY ("id"),
        CONSTRAINT "FK_world_boss_rewards_character" FOREIGN KEY ("character_id")
          REFERENCES "characters"("id") ON DELETE CASCADE
      );
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_world_boss_rewards_character_claimed"
        ON "world_boss_rewards" ("character_id", "claimed");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "idx_world_boss_rewards_character_claimed";`);
    await queryRunner.query(`DROP TABLE "world_boss_rewards";`);
    await queryRunner.query(`ALTER TABLE "characters" DROP COLUMN "nickname";`);
  }
}
