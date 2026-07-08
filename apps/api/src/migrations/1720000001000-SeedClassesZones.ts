import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Seed v0 (decisões abertas §8): 3 classes diferenciadas + 1 zona.
 * Stats tunáveis. compute_power vive em src/game/power.ts.
 */
export class SeedClassesZones1720000001000 implements MigrationInterface {
  name = 'SeedClassesZones1720000001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Warrior: survival alto, atk médio | Mage: atk alto, survival baixo | Rogue: híbrido
    await queryRunner.query(`
      INSERT INTO "classes"
        ("id","name","base_attack","base_survivability","attack_growth","survivability_growth")
      VALUES
        (1,'Warrior', 8, 12, 1.0, 1.2),
        (2,'Mage',   14,  5, 1.6, 0.6),
        (3,'Rogue',  12,  8, 1.3, 0.9);
    `);

    await queryRunner.query(`
      INSERT INTO "zones"
        ("id","name","min_power_score","xp_rate_per_power_sec","gold_rate_per_power_sec","offline_cap_seconds")
      VALUES
        (1,'Greenwood', 0, 0.05, 0.02, 28800);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM "zones" WHERE "id" = 1;`);
    await queryRunner.query(`DELETE FROM "classes" WHERE "id" IN (1,2,3);`);
  }
}
