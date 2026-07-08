import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Character } from '../characters/character.entity';
import { bigintTransformer } from '../common/bigint.transformer';

/**
 * Recompensa de world boss ainda não reivindicada (Fase 5). Gerada pelo job
 * `finalize` a partir das contribuições no Redis; só vira XP/gold/item real
 * no personagem quando ele resgata (mesmo padrão de "settle on next
 * authoritative action" usado no farm offline).
 */
@Entity('world_boss_rewards')
@Index('idx_world_boss_rewards_character_claimed', ['characterId', 'claimed'])
export class WorldBossReward {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'character_id', type: 'uuid' })
  characterId!: string;

  @ManyToOne(() => Character, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'character_id' })
  character!: Character;

  @Column({ name: 'event_id', type: 'text' })
  eventId!: string;

  @Column({ name: 'gold_awarded', type: 'bigint', default: 0, transformer: bigintTransformer })
  goldAwarded!: number;

  @Column({ name: 'xp_awarded', type: 'bigint', default: 0, transformer: bigintTransformer })
  xpAwarded!: number;

  @Column({ name: 'item_template_id', type: 'smallint', nullable: true })
  itemTemplateId!: number | null;

  @Column({ name: 'item_rarity', type: 'smallint', nullable: true })
  itemRarity!: number | null;

  @Column({ name: 'item_affixes', type: 'jsonb', nullable: true })
  itemAffixes!: Record<string, number> | null;

  @Column({ type: 'boolean', default: false })
  claimed!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
