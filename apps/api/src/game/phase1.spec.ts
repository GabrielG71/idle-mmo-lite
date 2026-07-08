import {
  AffixType,
  DROP_INTERVAL_SECONDS,
  ITEM_TEMPLATES,
  MAX_DROPS_PER_COLLECT,
  RARITY_CONFIG,
  Rarity,
} from '@idle/shared';
import { aggregateBuildBonuses, ZERO_BONUSES } from './build';
import { rollLoot } from './loot';
import { computePower } from './power';
import { calculateProgress } from './progress';

const MAGE = {
  baseAttack: 14,
  baseSurvivability: 5,
  attackGrowth: 1.6,
  survivabilityGrowth: 0.6,
};

const GREENWOOD = {
  xpRatePerPowerSec: 0.05,
  goldRatePerPowerSec: 0.02,
  offlineCapSeconds: 28800,
};

/** rng determinístico que devolve a sequência dada, repetindo o último valor. */
function seqRng(values: number[]): () => number {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
}

describe('aggregateBuildBonuses', () => {
  it('empty build yields zero bonuses', () => {
    expect(aggregateBuildBonuses([], {})).toEqual(ZERO_BONUSES);
  });

  it('sums template base stats scaled by rarity multiplier', () => {
    // Soldier Sword (id 2): baseAttack 7. Rare = x1.35 -> flatAttack 9.45
    const bonuses = aggregateBuildBonuses(
      [{ templateId: 2, rarity: Rarity.Rare, affixes: {} }],
      {},
    );
    expect(bonuses.flatAttack).toBeCloseTo(7 * RARITY_CONFIG[Rarity.Rare].statMultiplier);
    expect(bonuses.flatSurvivability).toBe(0);
  });

  it('sums rolled affixes across items', () => {
    const bonuses = aggregateBuildBonuses(
      [
        { templateId: 4, rarity: Rarity.Common, affixes: { [AffixType.PctAttack]: 3 } },
        { templateId: 7, rarity: Rarity.Common, affixes: { [AffixType.PctAttack]: 2, [AffixType.PctGold]: 4 } },
      ],
      {},
    );
    expect(bonuses.pctAttack).toBe(5);
    expect(bonuses.pctGold).toBe(4);
  });

  it('applies talent effects and caps at maxPoints', () => {
    // mage_arcane_power: +2.5% atk/pt, max 10 — 99 pontos devem ser clampados
    const bonuses = aggregateBuildBonuses([], { mage_arcane_power: 99 });
    expect(bonuses.pctAttack).toBe(25);
  });

  it('ignores unknown templates, talents and malformed affixes', () => {
    const bonuses = aggregateBuildBonuses(
      [{ templateId: 999, rarity: Rarity.Common, affixes: { bogus: 5, [AffixType.PctXp]: 'NaN' } }],
      { unknown_talent: 5 },
    );
    expect(bonuses).toEqual(ZERO_BONUSES);
  });
});

describe('computePower with build bonuses', () => {
  it('without bonuses matches Fase 0 behavior', () => {
    expect(computePower(MAGE, 1)).toBe(15);
  });

  it('flat and pct attack increase power', () => {
    const flat = computePower(MAGE, 1, { ...ZERO_BONUSES, flatAttack: 10 });
    const pct = computePower(MAGE, 1, { ...ZERO_BONUSES, pctAttack: 50 });
    expect(flat).toBeGreaterThan(computePower(MAGE, 1));
    // (14 * 1.5) * (1 + 5/100) = 22.05 -> 22
    expect(pct).toBe(22);
  });

  it('survivability bonuses increase power multiplicatively', () => {
    const boosted = computePower(MAGE, 1, { ...ZERO_BONUSES, flatSurvivability: 95 });
    // 14 * (1 + 100/100) = 28
    expect(boosted).toBe(28);
  });
});

describe('calculateProgress multipliers', () => {
  it('applies xp/gold multipliers from build', () => {
    const base = calculateProgress({ elapsedSeconds: 100, combatPower: 10, zone: GREENWOOD });
    const boosted = calculateProgress({
      elapsedSeconds: 100,
      combatPower: 10,
      zone: GREENWOOD,
      xpMultiplier: 1.1,
      goldMultiplier: 1.5,
    });
    expect(boosted.deltaXp).toBe(Math.floor(base.deltaXp * 1.1));
    expect(boosted.deltaGold).toBe(Math.floor(base.deltaGold * 1.5));
  });
});

describe('rollLoot', () => {
  it('guarantees floor(elapsed / interval) drops', () => {
    // rng 0.99 nunca concede o drop fracionário
    const drops = rollLoot({
      cappedElapsedSeconds: DROP_INTERVAL_SECONDS * 3,
      rng: seqRng([0.99]),
    });
    expect(drops).toHaveLength(3);
  });

  it('fractional part grants extra drop when rng hits', () => {
    // elapsed = 0.5 intervalo; rng 0.1 < 0.5 -> 1 drop
    const drops = rollLoot({
      cappedElapsedSeconds: DROP_INTERVAL_SECONDS / 2,
      rng: seqRng([0.1, 0.5, 0.5, 0.5]),
    });
    expect(drops).toHaveLength(1);
  });

  it('clamps at MAX_DROPS_PER_COLLECT', () => {
    const drops = rollLoot({
      cappedElapsedSeconds: DROP_INTERVAL_SECONDS * (MAX_DROPS_PER_COLLECT + 10),
      rng: seqRng([0.99]),
    });
    expect(drops).toHaveLength(MAX_DROPS_PER_COLLECT);
  });

  it('zero elapsed yields no drops', () => {
    expect(rollLoot({ cappedElapsedSeconds: 0, rng: seqRng([0.99]) })).toHaveLength(0);
  });

  it('rolled items reference valid templates and rarity config', () => {
    const drops = rollLoot({
      cappedElapsedSeconds: DROP_INTERVAL_SECONDS * 10,
      rng: seqRng([0.99, 0.01, 0.02, 0.03, 0.5, 0.7, 0.9, 0.2, 0.4, 0.6]),
    });
    const templateIds = new Set(ITEM_TEMPLATES.map((t) => t.id));
    for (const drop of drops) {
      expect(templateIds.has(drop.templateId)).toBe(true);
      const config = RARITY_CONFIG[drop.rarity];
      expect(config).toBeDefined();
      expect(Object.keys(drop.affixes).length).toBeLessThanOrEqual(config.affixCount);
    }
  });

  it('low rng rolls common, high rng rolls rarer', () => {
    // count=1 garantido (rng[0]=0.99 nega fracionário? não: floor=1, frac=0)
    const common = rollLoot({
      cappedElapsedSeconds: DROP_INTERVAL_SECONDS,
      rng: seqRng([0.5, 0.0, 0.0]),
    });
    expect(common[0].rarity).toBe(Rarity.Common);

    const rare = rollLoot({
      cappedElapsedSeconds: DROP_INTERVAL_SECONDS,
      rng: seqRng([0.5, 0.0, 0.9999]),
    });
    expect(rare[0].rarity).toBeGreaterThan(Rarity.Common);
  });
});
