import { Inject, Injectable } from '@nestjs/common';
import { DataSource, In } from 'typeorm';
import type { Redis } from 'ioredis';
import { LeaderboardEntry } from '@idle/shared';
import { Character } from '../characters/character.entity';
import { REDIS_CLIENT } from '../redis/redis.module';

const LEADERBOARD_KEY = 'leaderboard:combat_power';
const LEADERBOARD_TMP_KEY = `${LEADERBOARD_KEY}:tmp`;
const MAX_TRACKED = 500;

/**
 * Leaderboard global por combat_power (Fase 5, §6.1: "Redis — leaderboards,
 * cache de hot state"). Postgres é a fonte de verdade; o sorted set é
 * reconstruído periodicamente (ver LeaderboardProcessor), nunca escrito em
 * tempo real a cada mudança de combat_power.
 */
@Injectable()
export class LeaderboardService {
  constructor(
    private readonly dataSource: DataSource,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  /** Reconstrói o sorted set a partir do Postgres. Swap atômico via RENAME. */
  async refresh(): Promise<void> {
    const characters = await this.dataSource.manager.getRepository(Character).find({
      order: { combatPower: 'DESC' },
      take: MAX_TRACKED,
      select: ['id', 'combatPower'],
    });

    const pipeline = this.redis.pipeline();
    pipeline.del(LEADERBOARD_TMP_KEY);
    for (const c of characters) {
      pipeline.zadd(LEADERBOARD_TMP_KEY, c.combatPower, c.id);
    }
    if (characters.length > 0) {
      pipeline.rename(LEADERBOARD_TMP_KEY, LEADERBOARD_KEY);
    } else {
      pipeline.del(LEADERBOARD_KEY);
    }
    await pipeline.exec();
  }

  /** Top N do ranking, hidratado com dados de exibição vindos do Postgres. */
  async getTop(limit: number): Promise<LeaderboardEntry[]> {
    const raw = await this.redis.zrevrange(LEADERBOARD_KEY, 0, limit - 1, 'WITHSCORES');
    const ranked: { characterId: string; combatPower: number }[] = [];
    for (let i = 0; i < raw.length; i += 2) {
      ranked.push({ characterId: raw[i], combatPower: Number(raw[i + 1]) });
    }
    if (ranked.length === 0) return [];

    const characters = await this.dataSource.manager.getRepository(Character).find({
      where: { id: In(ranked.map((r) => r.characterId)) },
    });
    const byId = new Map(characters.map((c) => [c.id, c]));

    return ranked
      .map((r, index) => {
        const c = byId.get(r.characterId);
        if (!c) return null;
        return {
          rank: index + 1,
          characterId: c.id,
          nickname: c.nickname,
          classId: c.classId,
          level: c.level,
          prestigeTier: c.prestigeTier,
          combatPower: r.combatPower,
        };
      })
      .filter((e): e is LeaderboardEntry => e !== null);
  }
}
