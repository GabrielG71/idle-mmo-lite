import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Character } from '../characters/character.entity';

/**
 * Inventário de itens. Fase 0: tabela criada vazia (schema pronto).
 * Lógica de raridade/afixos/durabilidade entra na Fase 1.
 */
@Entity('items')
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
