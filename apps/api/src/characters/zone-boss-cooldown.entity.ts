import { Column, Entity, PrimaryColumn } from 'typeorm';

/**
 * Cooldown de boss por personagem. Fase 0: tabela criada vazia (schema pronto).
 * Lógica de bosses entra na Fase 2.
 */
@Entity('zone_boss_cooldowns')
export class ZoneBossCooldown {
  @PrimaryColumn({ name: 'character_id', type: 'uuid' })
  characterId!: string;

  @PrimaryColumn({ name: 'boss_id', type: 'smallint' })
  bossId!: number;

  @Column({ name: 'last_kill_at', type: 'timestamptz' })
  lastKillAt!: Date;
}
