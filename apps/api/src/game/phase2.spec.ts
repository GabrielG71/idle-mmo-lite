import { Rarity } from '@idle/shared';
import { bossCooldownRemainingSeconds, rollBossLoot } from './boss';

function seqRng(values: number[]): () => number {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
}

describe('bossCooldownRemainingSeconds', () => {
  it('is zero when the boss was never killed', () => {
    expect(bossCooldownRemainingSeconds(null, 4, new Date())).toBe(0);
  });

  it('is zero once the cooldown window has passed', () => {
    const lastKillAt = new Date('2026-01-01T00:00:00Z');
    const now = new Date('2026-01-01T04:00:00Z'); // exatamente 4h depois
    expect(bossCooldownRemainingSeconds(lastKillAt, 4, now)).toBe(0);
  });

  it('returns remaining seconds while still on cooldown', () => {
    const lastKillAt = new Date('2026-01-01T00:00:00Z');
    const now = new Date('2026-01-01T01:00:00Z'); // 1h depois de um cooldown de 4h
    expect(bossCooldownRemainingSeconds(lastKillAt, 4, now)).toBe(3 * 3600);
  });
});

describe('rollBossLoot', () => {
  it('drops exactly one item per template id in the pool', () => {
    const drops = rollBossLoot([10, 11], seqRng([0.99, 0.5, 0.99, 0.5]));
    expect(drops).toHaveLength(2);
    expect(drops.map((d) => d.templateId)).toEqual([10, 11]);
  });

  it('never drops below Rare, even when the roll would be Common', () => {
    // rng baixo -> rollRarity sortearia Common normalmente
    const drops = rollBossLoot([10], seqRng([0.01]));
    expect(drops[0].rarity).toBeGreaterThanOrEqual(Rarity.Rare);
  });

  it('preserves a higher rarity roll instead of clamping down', () => {
    // rng alto -> rollRarity sorteia Legendary; nunca deve rebaixar pra Rare
    const drops = rollBossLoot([10], seqRng([0.9999]));
    expect(drops[0].rarity).toBe(Rarity.Legendary);
  });

  it('empty pool yields no drops', () => {
    expect(rollBossLoot([])).toHaveLength(0);
  });
});
