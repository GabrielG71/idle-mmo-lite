import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { DataSource } from 'typeorm';
import type { Redis } from 'ioredis';
import { WorldBossAttackResult, WorldBossClaimResult, WorldBossStatus } from '@idle/shared';
import { WorldBossReward } from './world-boss-reward.entity';
import { CharacterClass } from '../classes/class.entity';
import { Zone } from '../zones/zone.entity';
import { CharacterBuild } from '../characters/character-build.entity';
import { loadOwnedCharacter, loadOwnedCharacterForUpdate } from '../characters/character-access';
import { loadEquippedItems } from '../items/equipped-items';
import { aggregateBuildBonuses } from '../game/build';
import { computeWorldBossDamage } from '../game/world-boss';
import { settleAndResnapshot } from '../characters/settle-progress';
import { toCharacterState } from '../characters/characters.mapper';
import { REDIS_CLIENT } from '../redis/redis.module';
import { FINALIZE_JOB } from './world-boss.constants';

const CURRENT_KEY = 'worldboss:current';
export const contributionsKey = (eventId: string) => `worldboss:contributions:${eventId}`;

/**
 * Decrementa HP e credita a contribuição do atacante atomicamente — evita
 * contenção quando vários personagens atacam ao mesmo tempo (nenhum lock de
 * Postgres, todo o estado mutável do ataque é efêmero no Redis).
 * Retorna [newHp, justDefeated] — justDefeated só é 1 na chamada que
 * derrubou o HP de >0 pra <=0 (edge-trigger, evita finalizar 2x).
 */
const ATTACK_SCRIPT = `
local hp = tonumber(redis.call('HGET', KEYS[1], 'hp'))
if not hp then return {-1, 0} end
local wasAlive = hp > 0
local dmg = tonumber(ARGV[1])
local newHp = hp - dmg
if newHp < 0 then newHp = 0 end
redis.call('HSET', KEYS[1], 'hp', newHp)
redis.call('ZINCRBY', KEYS[2], dmg, ARGV[2])
local justDefeated = 0
if wasAlive and newHp <= 0 then
  justDefeated = 1
  redis.call('HSET', KEYS[1], 'defeated', 1)
end
return {newHp, justDefeated}
`;

@Injectable()
export class WorldBossService {
  constructor(
    private readonly dataSource: DataSource,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    @InjectQueue('world-boss') private readonly queue: Queue,
  ) {}

  async getStatus(): Promise<WorldBossStatus> {
    const data = await this.redis.hgetall(CURRENT_KEY);
    if (!data.id) {
      return { active: false, id: null, hp: 0, maxHp: 0, endsAt: null, defeated: false };
    }
    const endsAtMs = Number(data.endsAt);
    const active = Date.now() < endsAtMs && data.defeated !== '1';
    return {
      active,
      id: data.id,
      hp: Number(data.hp),
      maxHp: Number(data.maxHp),
      endsAt: new Date(endsAtMs).toISOString(),
      defeated: data.defeated === '1',
    };
  }

  /**
   * Ataca o world boss ativo. Leitura (sem lock de Postgres) — dano escala
   * com combat_power, mas todo o estado mutável (HP, contribuição) vive só
   * no Redis, então ataques concorrentes de personagens diferentes nunca
   * disputam a mesma row do Postgres.
   */
  async attack(characterId: string, userId: string): Promise<WorldBossAttackResult> {
    const character = await loadOwnedCharacter(this.dataSource.manager, characterId, userId);

    const data = await this.redis.hgetall(CURRENT_KEY);
    if (!data.id) throw new BadRequestException('No active world boss');
    const endsAtMs = Number(data.endsAt);
    if (Date.now() >= endsAtMs || data.defeated === '1') {
      throw new BadRequestException('World boss event has ended');
    }

    const damage = computeWorldBossDamage(character.combatPower);
    const [newHp, justDefeated] = (await this.redis.eval(
      ATTACK_SCRIPT,
      2,
      CURRENT_KEY,
      contributionsKey(data.id),
      damage,
      characterId,
    )) as [number, number];

    if (newHp === -1) throw new BadRequestException('No active world boss');

    if (justDefeated === 1) {
      await this.queue.add(FINALIZE_JOB, { eventId: data.id, defeated: true });
    }

    return { damageDealt: damage, hpRemaining: newHp, defeated: justDefeated === 1 };
  }

  async listRewards(characterId: string, userId: string) {
    await loadOwnedCharacter(this.dataSource.manager, characterId, userId);
    const rewards = await this.dataSource.manager.getRepository(WorldBossReward).find({
      where: { characterId },
      order: { createdAt: 'DESC' },
    });
    return rewards.map((r) => ({
      id: r.id,
      eventId: r.eventId,
      goldAwarded: r.goldAwarded,
      xpAwarded: r.xpAwarded,
      itemTemplateId: r.itemTemplateId,
      itemRarity: r.itemRarity,
      claimed: r.claimed,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  /**
   * Soma todas as recompensas não reivindicadas e credita via
   * settleAndResnapshot (mesmo padrão do kill de boss normal) — mesmo
   * personagem pode ter acumulado recompensa de vários eventos offline.
   */
  async claimRewards(characterId: string, userId: string): Promise<WorldBossClaimResult> {
    return this.dataSource.transaction(async (manager) => {
      const character = await loadOwnedCharacterForUpdate(manager, characterId, userId);

      const rewardRepo = manager.getRepository(WorldBossReward);
      const unclaimed = await rewardRepo.find({ where: { characterId, claimed: false } });
      if (unclaimed.length === 0) {
        throw new BadRequestException('No unclaimed world boss rewards');
      }

      const totalGold = unclaimed.reduce((sum, r) => sum + r.goldAwarded, 0);
      const totalXp = unclaimed.reduce((sum, r) => sum + r.xpAwarded, 0);

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
        now: new Date(),
        cls,
        zone,
        oldBonuses: bonuses,
        newBonuses: bonuses,
        extraXp: totalXp,
        extraGold: totalGold,
      });

      // TODO(Fase 5, WIP): itens de world boss (itemTemplateId/itemRarity/
      // itemAffixes em `unclaimed`) ainda não são instanciados como `Item`
      // no claim — só gold/xp são creditados por enquanto. Ver CLAUDE.md.
      await rewardRepo
        .createQueryBuilder()
        .update()
        .set({ claimed: true })
        .whereInIds(unclaimed.map((r) => r.id))
        .execute();

      const saved = await manager.save(character);

      return {
        claimedGold: totalGold,
        claimedXp: totalXp,
        levelBefore,
        levelAfter,
        leveledUp,
        character: toCharacterState(saved),
      };
    });
  }
}
