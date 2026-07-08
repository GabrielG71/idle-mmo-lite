/**
 * Catálogo de bosses de zona (Fase 2, §4 do spec). Vive em código
 * compartilhado, igual a items/talents — o DB só guarda o cooldown por
 * personagem (`zone_boss_cooldowns`), não a definição do boss.
 */

export interface BossDef {
  id: number;
  zoneId: number;
  name: string;
  /** Power score mínimo pra desafiar (pode ser maior que o gate da zona). */
  minPowerScore: number;
  cooldownHours: number;
  xpReward: number;
  goldReward: number;
  /** Pool de itens exclusivos — cada kill dropa 1 de cada id desta lista. */
  lootTemplateIds: readonly number[];
}

/** 1 boss por zona, escalando com o gate de power e o cooldown. */
export const BOSSES: readonly BossDef[] = [
  {
    id: 1,
    zoneId: 1, // Greenwood
    name: 'Bramblehide Alpha',
    minPowerScore: 20,
    cooldownHours: 4,
    xpReward: 500,
    goldReward: 200,
    lootTemplateIds: [10, 11],
  },
  {
    id: 2,
    zoneId: 2, // Ashen Ridge
    name: 'Cinder Warden',
    minPowerScore: 60,
    cooldownHours: 8,
    xpReward: 2500,
    goldReward: 1000,
    lootTemplateIds: [12, 13],
  },
  {
    id: 3,
    zoneId: 3, // Shattered Peaks
    name: 'Peakbound Wyrm',
    minPowerScore: 150,
    cooldownHours: 12,
    xpReward: 12000,
    goldReward: 5000,
    lootTemplateIds: [14, 15],
  },
] as const;

export function getBoss(id: number): BossDef | undefined {
  return BOSSES.find((b) => b.id === id);
}

export function bossesForZone(zoneId: number): BossDef[] {
  return BOSSES.filter((b) => b.zoneId === zoneId);
}
