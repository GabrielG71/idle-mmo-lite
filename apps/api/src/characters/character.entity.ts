import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../users/user.entity';
import { CharacterClass } from '../classes/class.entity';
import { Zone } from '../zones/zone.entity';
import { CharacterBuild } from './character-build.entity';
import { bigintTransformer } from '../common/bigint.transformer';

/**
 * Estado core do personagem. Sem dados derivados exceto `combatPower`
 * (snapshot recalculado só em mudança de build). Ver PROJECT_SPEC §6.2.
 */
@Entity('characters')
@Index('idx_characters_collect', ['id', 'lastCollectedAt'])
export class Character {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  /** Opcional (Fase 5) — identidade no leaderboard; fallback é "Classe Lv.N". */
  @Column({ type: 'text', nullable: true })
  nickname!: string | null;

  @ManyToOne(() => User, (user) => user.characters, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ name: 'class_id', type: 'smallint' })
  classId!: number;

  @ManyToOne(() => CharacterClass)
  @JoinColumn({ name: 'class_id' })
  class!: CharacterClass;

  @Column({ type: 'int', default: 1 })
  level!: number;

  @Column({ type: 'bigint', default: 0, transformer: bigintTransformer })
  xp!: number;

  @Column({ type: 'bigint', default: 0, transformer: bigintTransformer })
  gold!: number;

  @Column({ name: 'prestige_tier', type: 'smallint', default: 0 })
  prestigeTier!: number;

  @Column({ name: 'current_zone_id', type: 'smallint' })
  currentZoneId!: number;

  @ManyToOne(() => Zone)
  @JoinColumn({ name: 'current_zone_id' })
  currentZone!: Zone;

  @Column({
    name: 'combat_power',
    type: 'bigint',
    default: 0,
    transformer: bigintTransformer,
  })
  combatPower!: number;

  @Column({ name: 'last_collected_at', type: 'timestamptz', default: () => 'now()' })
  lastCollectedAt!: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @OneToOne(() => CharacterBuild, (build) => build.character)
  build!: CharacterBuild;
}
