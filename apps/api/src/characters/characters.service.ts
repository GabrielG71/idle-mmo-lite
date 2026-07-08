import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  CharacterState,
  CollectResult,
  PendingProgress,
  ZoneId,
} from '@idle/shared';
import { Character } from './character.entity';
import { CharacterBuild } from './character-build.entity';
import { CharacterClass } from '../classes/class.entity';
import { Zone } from '../zones/zone.entity';
import { computePower } from '../game/power';
import { applyXp } from '../game/xp';
import { calculateProgress } from '../game/progress';
import { toCharacterState } from './characters.mapper';

@Injectable()
export class CharactersService {
  constructor(
    @InjectRepository(Character)
    private readonly characters: Repository<Character>,
    @InjectRepository(CharacterClass)
    private readonly classes: Repository<CharacterClass>,
    @InjectRepository(Zone)
    private readonly zones: Repository<Zone>,
    private readonly dataSource: DataSource,
  ) {}

  async create(userId: string, classId: number): Promise<CharacterState> {
    const cls = await this.classes.findOne({ where: { id: classId } });
    if (!cls) throw new BadRequestException('Invalid classId');

    const zoneId = ZoneId.Greenwood;
    const zone = await this.zones.findOne({ where: { id: zoneId } });
    if (!zone) throw new BadRequestException('Default zone missing (run seeds)');

    // combat_power inicial = snapshot server-side (nunca do cliente).
    const combatPower = computePower(cls, 1);

    const saved = await this.dataSource.transaction(async (manager) => {
      const character = manager.create(Character, {
        userId,
        classId,
        currentZoneId: zoneId,
        level: 1,
        xp: 0,
        gold: 0,
        combatPower,
        lastCollectedAt: new Date(),
      });
      const persisted = await manager.save(character);
      await manager.save(
        manager.create(CharacterBuild, { characterId: persisted.id }),
      );
      return persisted;
    });

    return toCharacterState(saved);
  }

  private async loadOwned(id: string, userId: string): Promise<Character> {
    const character = await this.characters.findOne({
      where: { id },
      relations: { class: true, currentZone: true },
    });
    if (!character) throw new NotFoundException('Character not found');
    if (character.userId !== userId) throw new ForbiddenException();
    return character;
  }

  /** Estado + preview do progresso pendente (sem coletar). */
  async getState(
    id: string,
    userId: string,
  ): Promise<CharacterState & { pending: PendingProgress }> {
    const character = await this.loadOwned(id, userId);
    const elapsedSeconds = this.elapsedSeconds(character.lastCollectedAt);
    const progress = calculateProgress({
      elapsedSeconds,
      combatPower: character.combatPower,
      zone: character.currentZone,
    });

    return {
      ...toCharacterState(character),
      pending: {
        elapsedSeconds,
        cappedElapsedSeconds: progress.cappedElapsedSeconds,
        pendingXp: progress.deltaXp,
        pendingGold: progress.deltaGold,
        capReached: progress.capReached,
      },
    };
  }

  /**
   * Coleta autoritativa (§6.3). Transação + pessimistic write lock na row do
   * character: cursor last_collected_at é lido, aplicado e avançado atomicamente,
   * impedindo double-collect em requisições concorrentes.
   */
  async collect(id: string, userId: string): Promise<CollectResult> {
    return this.dataSource.transaction(async (manager) => {
      const character = await manager
        .getRepository(Character)
        .createQueryBuilder('c')
        .setLock('pessimistic_write')
        .where('c.id = :id', { id })
        .getOne();

      if (!character) throw new NotFoundException('Character not found');
      if (character.userId !== userId) throw new ForbiddenException();

      const zone = await manager
        .getRepository(Zone)
        .findOneOrFail({ where: { id: character.currentZoneId } });
      const cls = await manager
        .getRepository(CharacterClass)
        .findOneOrFail({ where: { id: character.classId } });

      const now = new Date();
      const elapsedSeconds = this.elapsedSeconds(character.lastCollectedAt, now);
      const progress = calculateProgress({
        elapsedSeconds,
        combatPower: character.combatPower,
        zone,
      });

      const levelBefore = character.level;
      const applied = applyXp(character.level, character.xp, progress.deltaXp);

      character.level = applied.level;
      character.xp = applied.xp;
      character.gold += progress.deltaGold;
      character.lastCollectedAt = now;
      // combat_power depende do nível -> re-snapshot em level up.
      if (applied.leveledUp) {
        character.combatPower = computePower(cls, character.level);
      }

      const saved = await manager.save(character);

      return {
        collectedXp: progress.deltaXp,
        collectedGold: progress.deltaGold,
        cappedElapsedSeconds: progress.cappedElapsedSeconds,
        capReached: progress.capReached,
        levelBefore,
        levelAfter: saved.level,
        leveledUp: applied.leveledUp,
        character: toCharacterState(saved),
      };
    });
  }

  private elapsedSeconds(from: Date, to: Date = new Date()): number {
    return Math.max(0, Math.floor((to.getTime() - from.getTime()) / 1000));
  }
}
