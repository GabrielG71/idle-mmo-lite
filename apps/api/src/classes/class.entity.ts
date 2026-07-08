import { Column, Entity, PrimaryColumn } from 'typeorm';

/** Catálogo de classes jogáveis. Seedado (Warrior/Mage/Rogue). */
@Entity('classes')
export class CharacterClass {
  @PrimaryColumn({ type: 'smallint' })
  id!: number;

  @Column({ type: 'text' })
  name!: string;

  @Column({ name: 'base_attack', type: 'real' })
  baseAttack!: number;

  @Column({ name: 'base_survivability', type: 'real' })
  baseSurvivability!: number;

  @Column({ name: 'attack_growth', type: 'real' })
  attackGrowth!: number;

  @Column({ name: 'survivability_growth', type: 'real' })
  survivabilityGrowth!: number;
}
