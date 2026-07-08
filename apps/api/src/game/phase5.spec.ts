import { Rarity, WORLD_BOSS_ITEM_TEMPLATES } from '@idle/shared';
import { computeRewardShare, computeWorldBossDamage, rollWorldBossLoot } from './world-boss';

function seqRng(values: number[]): () => number {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
}

describe('computeWorldBossDamage', () => {
  it('is 1:1 with combat power', () => {
    expect(computeWorldBossDamage(150)).toBe(150);
  });

  it('floors fractional combat power', () => {
    expect(computeWorldBossDamage(150.7)).toBe(150);
  });

  it('never goes negative', () => {
    expect(computeWorldBossDamage(-10)).toBe(0);
  });
});

describe('computeRewardShare', () => {
  it('splits proportionally to contribution', () => {
    // 3 contributors: 100, 200, 700 -> shares of a 1000 pool
    expect(computeRewardShare(1000, 100, 1000)).toBe(100);
    expect(computeRewardShare(1000, 200, 1000)).toBe(200);
    expect(computeRewardShare(1000, 700, 1000)).toBe(700);
  });

  it('floors fractional shares', () => {
    // 1000 * 1 / 3 = 333.33... -> 333
    expect(computeRewardShare(1000, 1, 3)).toBe(333);
  });

  it('a single contributor takes the whole pool', () => {
    expect(computeRewardShare(500, 42, 42)).toBe(500);
  });

  it('yields zero when there is no total contribution (avoids div by zero)', () => {
    expect(computeRewardShare(1000, 0, 0)).toBe(0);
  });

  it('yields zero for a non-contributing character even if totalContribution > 0', () => {
    expect(computeRewardShare(1000, 0, 500)).toBe(0);
  });
});

describe('rollWorldBossLoot', () => {
  it('picks a template from the exclusive world boss pool', () => {
    const item = rollWorldBossLoot(seqRng([0.1, 0.5, 0.5]));
    const ids = WORLD_BOSS_ITEM_TEMPLATES.map((t) => t.id);
    expect(ids).toContain(item.templateId);
  });

  it('never rolls below Rare, even when the roll would be Common', () => {
    const item = rollWorldBossLoot(seqRng([0.1, 0.01]));
    expect(item.rarity).toBeGreaterThanOrEqual(Rarity.Rare);
  });
});
