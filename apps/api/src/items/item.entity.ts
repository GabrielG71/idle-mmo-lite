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

/**
 * Inventário de itens (Fase 1: raridade/afixos ativos; durabilidade adiada).
 */
@Entity('items')
@Index('idx_items_character', ['characterId'])
export class Item {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'character_id', type: 'uuid' })
  characterId!: string;

  @ManyToOne(() => Character, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'character_id' })
  character!: Character;

  @Column({ name: 'template_id', type: 'smallint' })
  templateId!: number;

  @Column({ type: 'smallint' })
  rarity!: number;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  affixes!: Record<string, unknown>;

  @Column({ type: 'smallint', default: 100 })
  durability!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
