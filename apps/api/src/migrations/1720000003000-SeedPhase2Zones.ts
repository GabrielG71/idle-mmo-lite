import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Fase 2: 2 zonas novas com gate por power score crescente (§4). Bosses
 * ficam só em código compartilhado (@idle/shared) — `zone_boss_cooldowns`
 * já existe desde a Fase 0, sem mudança de schema aqui.
 */
export class SeedPhase2Zones1720000003000 implements MigrationInterface {
  name = 'SeedPhase2Zones1720000003000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "zones"
        ("id","name","min_power_score","xp_rate_per_power_sec","gold_rate_per_power_sec","offline_cap_seconds")
      VALUES
        (2,'Ashen Ridge', 40, 0.08, 0.035, 28800),
        (3,'Shattered Peaks', 120, 0.12, 0.05, 28800);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM "zones" WHERE "id" IN (2,3);`);
  }
}
