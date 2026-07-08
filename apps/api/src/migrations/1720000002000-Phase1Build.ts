import { MigrationInterface, QueryRunner } from 'typeorm';

/** Fase 1: contador de respec na build + índice de lookup de itens por personagem. */
export class Phase1Build1720000002000 implements MigrationInterface {
  name = 'Phase1Build1720000002000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "character_builds"
        ADD COLUMN "respec_count" smallint NOT NULL DEFAULT 0;
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_items_character" ON "items" ("character_id");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "idx_items_character";`);
    await queryRunner.query(`
      ALTER TABLE "character_builds" DROP COLUMN "respec_count";
    `);
  }
}
