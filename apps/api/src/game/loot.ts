import {
  AFFIX_RANGES,
  AffixType,
  DROP_INTERVAL_SECONDS,
  ITEM_TEMPLATES,
  MAX_DROPS_PER_COLLECT,
  RARITY_CONFIG,
  Rarity,
} from '@idle/shared';

/** Item rolado, ainda sem id/dono (persistência é responsabilidade do service). */
export interface RolledItem {
  templateId: number;
  rarity: Rarity;
  affixes: Record<string, number>;
}

export interface RollLootInput {
  cappedElapsedSeconds: number;
  /** Injetável p/ testes determinísticos. Deve retornar [0, 1). */
  rng?: () => number;
}

const RARITIES = Object.keys(RARITY_CONFIG).map(Number) as Rarity[];
const TOTAL_RARITY_WEIGHT = RARITIES.reduce(
  (sum, r) => sum + RARITY_CONFIG[r].weight,
  0,
);

export function rollRarity(rng: () => number): Rarity {
  let roll = rng() * TOTAL_RARITY_WEIGHT;
  for (const rarity of RARITIES) {
    roll -= RARITY_CONFIG[rarity].weight;
    if (roll < 0) return rarity;
  }
  return RARITIES[RARITIES.length - 1];
}

export function rollAffixes(rarity: Rarity, rng: () => number): Record<string, number> {
  const { affixCount, statMultiplier } = RARITY_CONFIG[rarity];
  const pool = Object.values(AffixType);
  const affixes: Record<string, number> = {};
  for (let i = 0; i < affixCount && pool.length > 0; i++) {
    const type = pool.splice(Math.floor(rng() * pool.length), 1)[0];
    const { min, max } = AFFIX_RANGES[type];
    const value = min + rng() * (max - min);
    affixes[type] = Math.round(value * statMultiplier * 10) / 10;
  }
  return affixes;
}

/**
 * Loot de farm comum (§4: taxa de drop constante por tempo). Contagem tem piso
 * determinístico — floor(elapsed / DROP_INTERVAL) drops garantidos + 1
 * probabilístico pela fração restante — clamp em MAX_DROPS_PER_COLLECT.
 * Template e raridade uniformes/ponderados via rng injetado.
 */
export function rollLoot(input: RollLootInput): RolledItem[] {
  const rng = input.rng ?? Math.random;
  const elapsed = Math.max(0, input.cappedElapsedSeconds);

  const expected = elapsed / DROP_INTERVAL_SECONDS;
  let count = Math.floor(expected);
  if (rng() < expected - count) count += 1;
  count = Math.min(count, MAX_DROPS_PER_COLLECT);

  const drops: RolledItem[] = [];
  for (let i = 0; i < count; i++) {
    const template = ITEM_TEMPLATES[Math.floor(rng() * ITEM_TEMPLATES.length)];
    const rarity = rollRarity(rng);
    drops.push({
      templateId: template.id,
      rarity,
      affixes: rollAffixes(rarity, rng),
    });
  }
  return drops;
}
