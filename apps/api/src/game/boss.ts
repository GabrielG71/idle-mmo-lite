import { Rarity } from '@idle/shared';
import { rollAffixes, rollRarity, RolledItem } from './loot';

/**
 * Segundos restantes de cooldown (0 se nunca matou ou já expirou).
 * Puro e determinístico — server-side, nunca confia em input do cliente.
 */
export function bossCooldownRemainingSeconds(
  lastKillAt: Date | null,
  cooldownHours: number,
  now: Date,
): number {
  if (!lastKillAt) return 0;
  const readyAt = lastKillAt.getTime() + cooldownHours * 3600 * 1000;
  return Math.max(0, Math.ceil((readyAt - now.getTime()) / 1000));
}

/**
 * Loot exclusivo de boss (§4: "loot exclusivo"). Garante 1 drop de CADA
 * template da pool, com piso de raridade Rare — reaproveita o mesmo sorteio
 * de raridade/afixos do farm comum, só eleva o piso.
 */
export function rollBossLoot(
  lootTemplateIds: readonly number[],
  rng: () => number = Math.random,
): RolledItem[] {
  return lootTemplateIds.map((templateId) => {
    const rarity = Math.max(rollRarity(rng), Rarity.Rare) as Rarity;
    return {
      templateId,
      rarity,
      affixes: rollAffixes(rarity, rng),
    };
  });
}
