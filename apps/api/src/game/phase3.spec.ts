import { AffixType, Rarity } from '@idle/shared';
import { aggregateBuildBonuses, ZERO_BONUSES } from './build';
import { computePower } from './power';

describe('aggregateBuildBonuses prestige bonus', () => {
  it('tier 0 adds nothing (backward compatible default)', () => {
    expect(aggregateBuildBonuses([], {})).toEqual(ZERO_BONUSES);
  });

  it('each tier adds PRESTIGE_BONUS_PCT_PER_TIER to pctAttack and pctSurvivability', () => {
    const bonuses = aggregateBuildBonuses([], {}, 1);
    expect(bonuses.pctAttack).toBe(10);
    expect(bonuses.pctSurvivability).toBe(10);
  });

  it('scales linearly with tier', () => {
    const bonuses = aggregateBuildBonuses([], {}, 3);
    expect(bonuses.pctAttack).toBe(30);
    expect(bonuses.pctSurvivability).toBe(30);
  });

  it('stacks additively with item and talent bonuses', () => {
    const bonuses = aggregateBuildBonuses(
      [{ templateId: 4, rarity: Rarity.Common, affixes: { [AffixType.PctAttack]: 5 } }],
      { mage_arcane_power: 2 }, // +2.5%/pt -> +5%
      1, // +10%
    );
    expect(bonuses.pctAttack).toBe(5 + 5 + 10);
  });
});

describe('computePower with prestige bonus', () => {
  const WARRIOR = { baseAttack: 8, baseSurvivability: 12, attackGrowth: 1.0, survivabilityGrowth: 1.2 };

  it('a fresh level-1 prestiged character is stronger than a non-prestiged one', () => {
    const base = computePower(WARRIOR, 1);
    const prestiged = computePower(WARRIOR, 1, aggregateBuildBonuses([], {}, 1));
    expect(prestiged).toBeGreaterThan(base);
  });
});
