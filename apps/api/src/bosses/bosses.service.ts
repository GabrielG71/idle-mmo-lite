import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, In } from 'typeorm';
import { BOSSES, BossKillResult, BossStatus, getBoss } from '@idle/shared';
import { ZoneBossCooldown } from '../characters/zone-boss-cooldown.entity';
import { CharacterBuild } from '../characters/character-build.entity';
import { CharacterClass } from '../classes/class.entity';
import { Zone } from '../zones/zone.entity';
import { Item } from '../items/item.entity';
import { loadOwnedCharacter, loadOwnedCharacterForUpdate } from '../characters/character-access';
import { settleAndResnapshot } from '../characters/settle-progress';
import { toCharacterState } from '../characters/characters.mapper';
import { toItemState } from '../items/items.mapper';
import { loadEquippedItems } from '../items/equipped-items';
import { aggregateBuildBonuses } from '../game/build';
import { bossCooldownRemainingSeconds, rollBossLoot } from '../game/boss';

@Injectable()
export class BossesService {
  constructor(private readonly dataSource: DataSource) {}

  /** Status de TODOS os bosses do jogo (mapa completo), não só a zona atual. */
  async listStatus(characterId: string, userId: string): Promise<BossStatus[]> {
    const manager = this.dataSource.manager;
    const character = await loadOwnedCharacter(manager, characterId, userId);

    const bossIds = BOSSES.map((b) => b.id);
    const cooldowns = await manager
      .getRepository(ZoneBossCooldown)
      .find({ where: { characterId: character.id, bossId: In(bossIds) } });
    const lastKillById = new Map(cooldowns.map((c) => [c.bossId, c.lastKillAt]));

    const now = new Date();
    return BOSSES.map((boss) => {
      const remaining = bossCooldownRemainingSeconds(
        lastKillById.get(boss.id) ?? null,
        boss.cooldownHours,
        now,
      );
      const inCurrentZone = character.currentZoneId === boss.zoneId;
      const powerSufficient = character.combatPower >= boss.minPowerScore;
      return {
        bossId: boss.id,
        zoneId: boss.zoneId,
        name: boss.name,
        minPowerScore: boss.minPowerScore,
        cooldownHours: boss.cooldownHours,
        inCurrentZone,
        powerSufficient,
        onCooldownUntil:
          remaining > 0 ? new Date(now.getTime() + remaining * 1000).toISOString() : null,
        canChallenge: inCurrentZone && powerSufficient && remaining === 0,
      };
    });
  }

  /**
   * Desafia um boss (§4: cooldown por personagem, loot exclusivo). Liquida o
   * farm passivo pendente e credita XP/gold do boss num único re-snapshot
   * (via `settleAndResnapshot` com extraXp/extraGold).
   */
  async kill(characterId: string, userId: string, bossId: number): Promise<BossKillResult> {
    return this.dataSource.transaction(async (manager) => {
      const character = await loadOwnedCharacterForUpdate(manager, characterId, userId);

      const boss = getBoss(bossId);
      if (!boss) throw new NotFoundException('Boss not found');
      if (character.currentZoneId !== boss.zoneId) {
        throw new BadRequestException(`Must be in ${boss.name}'s zone to challenge it`);
      }
      if (character.combatPower < boss.minPowerScore) {
        throw new BadRequestException(
          `Not enough power to challenge ${boss.name} (needs ${boss.minPowerScore})`,
        );
      }

      const cooldownRepo = manager.getRepository(ZoneBossCooldown);
      const cooldown = await cooldownRepo.findOne({
        where: { characterId: character.id, bossId: boss.id },
      });
      const now = new Date();
      const remaining = bossCooldownRemainingSeconds(
        cooldown?.lastKillAt ?? null,
        boss.cooldownHours,
        now,
      );
      if (remaining > 0) {
        throw new BadRequestException(`${boss.name} is on cooldown for ${remaining}s`);
      }

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
      const bonuses = aggregateBuildBonuses(equipped, build.talents, character.prestigeTier);

      const { levelBefore, levelAfter, leveledUp } = settleAndResnapshot(character, {
        now,
        cls,
        zone,
        oldBonuses: bonuses,
        newBonuses: bonuses, // build não muda na luta contra o boss
        extraXp: boss.xpReward,
        extraGold: boss.goldReward,
      });

      const rolled = rollBossLoot(boss.lootTemplateIds);
      const itemRepo = manager.getRepository(Item);
      const droppedItems = await itemRepo.save(
        rolled.map((r) =>
          itemRepo.create({
            characterId: character.id,
            templateId: r.templateId,
            rarity: r.rarity,
            affixes: r.affixes,
          }),
        ),
      );

      await cooldownRepo.upsert(
        { characterId: character.id, bossId: boss.id, lastKillAt: now },
        ['characterId', 'bossId'],
      );

      const saved = await manager.save(character);

      return {
        xpAwarded: boss.xpReward,
        goldAwarded: boss.goldReward,
        levelBefore,
        levelAfter,
        leveledUp,
        droppedItems: droppedItems.map((item) => toItemState(item)),
        cooldownUntil: new Date(now.getTime() + boss.cooldownHours * 3600 * 1000).toISOString(),
        character: toCharacterState(saved),
      };
    });
  }
}
