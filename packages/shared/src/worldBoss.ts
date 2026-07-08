/**
 * World boss (Fase 5, §7 do roadmap): evento global único, agendado via
 * BullMQ. HP e contribuições vivem só no Redis (efêmero); recompensa é
 * creditada de forma assíncrona e reivindicada pelo personagem depois.
 */

export const WORLD_BOSS_MAX_HP = 500_000;
export const WORLD_BOSS_DURATION_MINUTES = 15;
export const WORLD_BOSS_SPAWN_INTERVAL_MINUTES = 30;

/** Pool total dividido proporcionalmente à contribuição de dano de cada personagem. */
export const WORLD_BOSS_GOLD_POOL = 50_000;
export const WORLD_BOSS_XP_POOL = 200_000;

/** Só concedido ao top 3 contribuidores, e só se o boss foi derrotado. */
export const WORLD_BOSS_TOP_CONTRIBUTORS_ITEM_COUNT = 3;

export interface WorldBossStatus {
  active: boolean;
  id: string | null;
  hp: number;
  maxHp: number;
  endsAt: string | null; // ISO
  defeated: boolean;
}

export interface WorldBossReward {
  id: string;
  eventId: string;
  goldAwarded: number;
  xpAwarded: number;
  itemTemplateId: number | null;
  itemRarity: number | null;
  itemAffixes: Record<string, number> | null;
  claimed: boolean;
  createdAt: string; // ISO
}

export interface WorldBossAttackResult {
  damageDealt: number;
  hpRemaining: number;
  defeated: boolean;
}
