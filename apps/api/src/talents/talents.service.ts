import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  BuildState,
  CharacterState,
  getTalent,
  respecCost,
  talentPointsForLevel,
  talentsForClass,
} from '@idle/shared';
import { CharacterBuild } from '../characters/character-build.entity';
import { CharacterClass } from '../classes/class.entity';
import { Zone } from '../zones/zone.entity';
import { loadOwnedCharacterForUpdate } from '../characters/character-access';
import { settleAndResnapshot } from '../characters/settle-progress';
import { toBuildState, toCharacterState } from '../characters/characters.mapper';
import { aggregateBuildBonuses } from '../game/build';
import { loadEquippedItems } from '../items/equipped-items';

export interface BuildMutationResult {
  character: CharacterState;
  build: BuildState;
}

@Injectable()
export class TalentsService {
  constructor(private readonly dataSource: DataSource) {}

  /**
   * Substitui o estado-alvo dos talentos (§6.3: validado server-side).
   * Alocação é apenas aditiva em relação ao estado atual — reduzir pontos
   * exige respec.
   */
  async allocate(
    characterId: string,
    userId: string,
    target: Record<string, number>,
  ): Promise<BuildMutationResult> {
    return this.dataSource.transaction(async (manager) => {
      const character = await loadOwnedCharacterForUpdate(manager, characterId, userId);
      const cls = await manager
        .getRepository(CharacterClass)
        .findOneOrFail({ where: { id: character.classId } });
      const zone = await manager
        .getRepository(Zone)
        .findOneOrFail({ where: { id: character.currentZoneId } });
      const build = await manager
        .getRepository(CharacterBuild)
        .findOneOrFail({ where: { characterId: character.id } });

      const validIds = new Set(talentsForClass(character.classId).map((t) => t.id));
      const currentTalents = build.talents as Record<string, number>;

      for (const id of Object.keys(currentTalents)) {
        const next = target[id] ?? 0;
        if (next < currentTalents[id]) {
          throw new BadRequestException(`Cannot reduce talent ${id} without respec`);
        }
      }

      let totalSpent = 0;
      for (const [id, points] of Object.entries(target)) {
        if (!validIds.has(id)) throw new BadRequestException(`Unknown talent ${id}`);
        if (!Number.isInteger(points) || points < 0) {
          throw new BadRequestException(`Invalid points for talent ${id}`);
        }
        const def = getTalent(id)!;
        if (points > def.maxPoints) {
          throw new BadRequestException(`Talent ${id} exceeds maxPoints (${def.maxPoints})`);
        }
        totalSpent += points;
      }

      const budget = talentPointsForLevel(character.level);
      if (totalSpent > budget) {
        throw new BadRequestException(`Not enough talent points (budget ${budget})`);
      }

      const equipped = await loadEquippedItems(manager, build);
      const oldBonuses = aggregateBuildBonuses(equipped, build.talents);

      build.talents = { ...target };

      const newBonuses = aggregateBuildBonuses(equipped, build.talents);
      settleAndResnapshot(character, { now: new Date(), cls, zone, oldBonuses, newBonuses });

      await manager.save(character);
      await manager.save(build);

      return { character: toCharacterState(character), build: toBuildState(build, character.level) };
    });
  }

  /** Zera talentos e cobra gold com custo crescente (§3). */
  async respec(characterId: string, userId: string): Promise<BuildMutationResult> {
    return this.dataSource.transaction(async (manager) => {
      const character = await loadOwnedCharacterForUpdate(manager, characterId, userId);
      const cls = await manager
        .getRepository(CharacterClass)
        .findOneOrFail({ where: { id: character.classId } });
      const zone = await manager
        .getRepository(Zone)
        .findOneOrFail({ where: { id: character.currentZoneId } });
      const build = await manager
        .getRepository(CharacterBuild)
        .findOneOrFail({ where: { characterId: character.id } });

      const equipped = await loadEquippedItems(manager, build);
      const oldBonuses = aggregateBuildBonuses(equipped, build.talents);
      const newBonuses = aggregateBuildBonuses(equipped, {});

      // Liquida progresso pendente (gold farmado entra ANTES de cobrar o respec).
      settleAndResnapshot(character, { now: new Date(), cls, zone, oldBonuses, newBonuses });

      const cost = respecCost(build.respecCount);
      if (character.gold < cost) {
        throw new BadRequestException(`Not enough gold for respec (cost ${cost})`);
      }
      character.gold -= cost;
      build.talents = {};
      build.respecCount += 1;

      await manager.save(character);
      await manager.save(build);

      return { character: toCharacterState(character), build: toBuildState(build, character.level) };
    });
  }
}
