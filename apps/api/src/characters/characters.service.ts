import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  BuildState,
  CharacterState,
  CollectResult,
  PendingProgress,
  ZoneId,
} from '@idle/shared';
import { Character } from './character.entity';
import { CharacterBuild } from './character-build.entity';
import { CharacterClass } from '../classes/class.entity';
import { Zone } from '../zones/zone.entity';
import { Item } from '../items/item.entity';
import { computePower } from '../game/power';
import { calculateProgress } from '../game/progress';
import { aggregateBuildBonuses } from '../game/build';
import { rollLoot } from '../game/loot';
import { toBuildState, toCharacterState } from './characters.mapper';
import { toItemState } from '../items/items.mapper';
import { loadOwnedCharacter, loadOwnedCharacterForUpdate } from './character-access';
import { loadEquippedItems } from '../items/equipped-items';
import { settleAndResnapshot } from './settle-progress';

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

  async listForUser(userId: string): Promise<CharacterState[]> {
    const characters = await this.characters.find({
      where: { userId },
      order: { createdAt: 'ASC' },
    });
    return characters.map(toCharacterState);
  }

  /** Estado + preview do progresso pendente (sem coletar). */
  async getState(
    id: string,
    userId: string,
  ): Promise<CharacterState & { pending: PendingProgress }> {
    const character = await loadOwnedCharacter(this.dataSource.manager, id, userId);
    const build = await this.dataSource.manager
      .getRepository(CharacterBuild)
      .findOneOrFail({ where: { characterId: character.id } });
    const equipped = await loadEquippedItems(this.dataSource.manager, build);
    const bonuses = aggregateBuildBonuses(equipped, build.talents);

    const elapsedSeconds = this.elapsedSeconds(character.lastCollectedAt);
    const progress = calculateProgress({
      elapsedSeconds,
      combatPower: character.combatPower,
      zone: character.currentZone,
      xpMultiplier: 1 + bonuses.pctXp / 100,
      goldMultiplier: 1 + bonuses.pctGold / 100,
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
   * Viagem entre zonas (§4: gate por power score, não level). Liquida o
   * progresso pendente nas taxas da zona ATUAL antes de trocar — a mudança
   * de zona nunca re-precifica retroativamente o farm já acumulado.
   */
  async travelToZone(id: string, userId: string, zoneId: number): Promise<CharacterState> {
    return this.dataSource.transaction(async (manager) => {
      const character = await loadOwnedCharacterForUpdate(manager, id, userId);

      const targetZone = await manager.getRepository(Zone).findOne({ where: { id: zoneId } });
      if (!targetZone) throw new BadRequestException('Invalid zoneId');

      const currentZone = await manager
        .getRepository(Zone)
        .findOneOrFail({ where: { id: character.currentZoneId } });
      const cls = await manager
        .getRepository(CharacterClass)
        .findOneOrFail({ where: { id: character.classId } });
      const build = await manager
        .getRepository(CharacterBuild)
        .findOneOrFail({ where: { characterId: character.id } });
      const equipped = await loadEquippedItems(manager, build);
      const bonuses = aggregateBuildBonuses(equipped, build.talents);

      // Banca o pendente nas taxas da zona atual antes de trocar.
      settleAndResnapshot(character, {
        now: new Date(),
        cls,
        zone: currentZone,
        oldBonuses: bonuses,
        newBonuses: bonuses,
      });

      if (character.combatPower < targetZone.minPowerScore) {
        throw new BadRequestException(
          `Not enough power for ${targetZone.name} (needs ${targetZone.minPowerScore})`,
        );
      }

      character.currentZoneId = targetZone.id;
      const saved = await manager.save(character);
      return toCharacterState(saved);
    });
  }

  async getBuild(id: string, userId: string): Promise<BuildState> {
    const character = await loadOwnedCharacter(this.dataSource.manager, id, userId);
    const build = await this.dataSource.manager
      .getRepository(CharacterBuild)
      .findOneOrFail({ where: { characterId: character.id } });
    return toBuildState(build, character.level);
  }

  /**
   * Coleta autoritativa (§6.3). Transação + pessimistic write lock; liquida
   * progresso com o combat_power vigente (já reflete a build atual), rola
   * loot proporcional ao tempo coberto e persiste os itens.
   */
  async collect(id: string, userId: string): Promise<CollectResult> {
    return this.dataSource.transaction(async (manager) => {
      const character = await loadOwnedCharacterForUpdate(manager, id, userId);

      const zone = await manager
        .getRepository(Zone)
        .findOneOrFail({ where: { id: character.currentZoneId } });
      const cls = await manager
        .getRepository(CharacterClass)
        .findOneOrFail({ where: { id: character.classId } });
      const build = await manager
        .getRepository(CharacterBuild)
        .findOneOrFail({ where: { characterId: character.id } });
      const equipped = await loadEquippedItems(manager, build);
      const bonuses = aggregateBuildBonuses(equipped, build.talents);

      const { progress, levelBefore, levelAfter, leveledUp } = settleAndResnapshot(
        character,
        {
          now: new Date(),
          cls,
          zone,
          oldBonuses: bonuses,
          newBonuses: bonuses, // build não muda durante collect
        },
      );

      const rolled = rollLoot({ cappedElapsedSeconds: progress.cappedElapsedSeconds });
      const itemRepo = manager.getRepository(Item);
      const droppedItems = rolled.length
        ? await itemRepo.save(
            rolled.map((r) =>
              itemRepo.create({
                characterId: character.id,
                templateId: r.templateId,
                rarity: r.rarity,
                affixes: r.affixes,
              }),
            ),
          )
        : [];

      const saved = await manager.save(character);

      return {
        collectedXp: progress.deltaXp,
        collectedGold: progress.deltaGold,
        cappedElapsedSeconds: progress.cappedElapsedSeconds,
        capReached: progress.capReached,
        levelBefore,
        levelAfter,
        leveledUp,
        droppedItems: droppedItems.map((item) => toItemState(item)),
        character: toCharacterState(saved),
      };
    });
  }

  private elapsedSeconds(from: Date, to: Date = new Date()): number {
    return Math.max(0, Math.floor((to.getTime() - from.getTime()) / 1000));
  }
}
