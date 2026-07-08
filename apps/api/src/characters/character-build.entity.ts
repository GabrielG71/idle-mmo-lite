import {
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Character } from './character.entity';

/**
 * Build separada de `characters` p/ não inchar a tabela principal (§6.2).
 * Fase 0: criada vazia; lógica de talentos/itens/consumíveis vem na Fase 1.
 */
@Entity('character_builds')
export class CharacterBuild {
  @PrimaryColumn({ name: 'character_id', type: 'uuid' })
  characterId!: string;

  @OneToOne(() => Character, (character) => character.build, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'character_id' })
  character!: Character;

  /** talentId -> pontos alocados. */
  @Column({ type: 'jsonb', default: () => "'{}'" })
  talents!: Record<string, number>;

  @Column({ name: 'equipped_items', type: 'jsonb', default: () => "'{}'" })
  equippedItems!: Record<string, string>;

  @Column({ name: 'active_consumables', type: 'jsonb', default: () => "'[]'" })
  activeConsumables!: unknown[];

  /** Incrementado a cada respec de talentos; usado p/ custo crescente (§3). */
  @Column({ name: 'respec_count', type: 'smallint', default: 0 })
  respecCount!: number;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
