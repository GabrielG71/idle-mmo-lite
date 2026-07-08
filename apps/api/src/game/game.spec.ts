import { computePower } from './power';
import { applyXp, xpRequired } from './xp';
import { calculateProgress } from './progress';
import { BASE_XP } from '@idle/shared';

const WARRIOR = {
  baseAttack: 8,
  baseSurvivability: 12,
  attackGrowth: 1.0,
  survivabilityGrowth: 1.2,
};
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

describe('computePower', () => {
  it('level 1 differs per class (DPS-weighted)', () => {
    // Warrior: 8 * (1 + 12/100) = 8.96 -> 9
    expect(computePower(WARRIOR, 1)).toBe(9);
    // Mage: 14 * (1 + 5/100) = 14.7 -> 15
    expect(computePower(MAGE, 1)).toBe(15);
  });

  it('scales with level', () => {
    expect(computePower(WARRIOR, 10)).toBeGreaterThan(computePower(WARRIOR, 1));
  });

  it('never below 1', () => {
    expect(computePower({ baseAttack: 0, baseSurvivability: 0, attackGrowth: 0, survivabilityGrowth: 0 }, 1)).toBe(1);
  });
});

describe('xpRequired', () => {
  it('level 1 requires BASE_XP', () => {
    expect(xpRequired(1)).toBe(BASE_XP);
  });
  it('grows exponentially', () => {
    expect(xpRequired(2)).toBeGreaterThan(xpRequired(1));
    expect(xpRequired(10)).toBeGreaterThan(xpRequired(9));
  });
});

describe('applyXp', () => {
  it('no level up when below threshold', () => {
    const r = applyXp(1, 0, 50);
    expect(r.level).toBe(1);
    expect(r.xp).toBe(50);
    expect(r.leveledUp).toBe(false);
  });

  it('single level up carries remainder', () => {
    const r = applyXp(1, 0, xpRequired(1) + 10);
    expect(r.level).toBe(2);
    expect(r.xp).toBe(10);
    expect(r.leveledUp).toBe(true);
  });

  it('resolves multiple level ups in one delta', () => {
    const needed = xpRequired(1) + xpRequired(2) + xpRequired(3);
    const r = applyXp(1, 0, needed + 5);
    expect(r.level).toBe(4);
    expect(r.xp).toBe(5);
  });

  it('ignores negative delta', () => {
    const r = applyXp(3, 20, -100);
    expect(r.level).toBe(3);
    expect(r.xp).toBe(20);
  });
});

describe('calculateProgress', () => {
  it('computes xp/gold from power, rate and time', () => {
    const r = calculateProgress({ elapsedSeconds: 100, combatPower: 10, zone: GREENWOOD });
    // xp = floor(10 * 0.05 * 100) = 50 ; gold = floor(10 * 0.02 * 100) = 20
    expect(r.deltaXp).toBe(50);
    expect(r.deltaGold).toBe(20);
    expect(r.capReached).toBe(false);
    expect(r.cappedElapsedSeconds).toBe(100);
  });

  it('clamps elapsed to zone offline cap', () => {
    const beyond = GREENWOOD.offlineCapSeconds + 10_000;
    const r = calculateProgress({ elapsedSeconds: beyond, combatPower: 10, zone: GREENWOOD });
    expect(r.cappedElapsedSeconds).toBe(GREENWOOD.offlineCapSeconds);
    expect(r.capReached).toBe(true);
    expect(r.deltaXp).toBe(Math.floor(10 * 0.05 * GREENWOOD.offlineCapSeconds));
  });

  it('zero elapsed yields zero gain (idempotency baseline)', () => {
    const r = calculateProgress({ elapsedSeconds: 0, combatPower: 999, zone: GREENWOOD });
    expect(r.deltaXp).toBe(0);
    expect(r.deltaGold).toBe(0);
  });

  it('clamps negative elapsed to zero', () => {
    const r = calculateProgress({ elapsedSeconds: -50, combatPower: 10, zone: GREENWOOD });
    expect(r.deltaXp).toBe(0);
    expect(r.cappedElapsedSeconds).toBe(0);
  });
});
