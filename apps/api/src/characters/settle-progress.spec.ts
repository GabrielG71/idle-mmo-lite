import { ZERO_BONUSES } from '../game/build';
import { settleAndResnapshot } from './settle-progress';
import { Character } from './character.entity';

const MAGE = {
  baseAttack: 14,
  baseSurvivability: 5,
  attackGrowth: 1.6,
  survivabilityGrowth: 0.6,
};
const GREENWOOD = { xpRatePerPowerSec: 0.05, goldRatePerPowerSec: 0.02, offlineCapSeconds: 28800 };

function makeCharacter(overrides: Partial<Character> = {}): Character {
  return {
    id: 'c1',
    userId: 'u1',
    classId: 2,
    level: 1,
    xp: 0,
    gold: 0,
    prestigeTier: 0,
    currentZoneId: 1,
    combatPower: 15,
    lastCollectedAt: new Date('2026-01-01T00:00:00Z'),
    createdAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  } as Character;
}

describe('settleAndResnapshot', () => {
  it('settles elapsed progress using old bonuses and current combatPower', () => {
    const now = new Date('2026-01-01T00:01:40Z'); // +100s
    const character = makeCharacter();
    const result = settleAndResnapshot(character, {
      now,
      cls: MAGE,
      zone: GREENWOOD,
      oldBonuses: ZERO_BONUSES,
      newBonuses: ZERO_BONUSES,
    });
    expect(result.progress.deltaXp).toBe(Math.floor(15 * 0.05 * 100));
    expect(character.gold).toBe(Math.floor(15 * 0.02 * 100));
    expect(character.lastCollectedAt).toEqual(now);
  });

  it('applies oldBonuses xp/gold multipliers to the settled window, not newBonuses', () => {
    const now = new Date('2026-01-01T00:01:40Z');
    const character = makeCharacter();
    const result = settleAndResnapshot(character, {
      now,
      cls: MAGE,
      zone: GREENWOOD,
      oldBonuses: { ...ZERO_BONUSES, pctGold: 100 },
      newBonuses: ZERO_BONUSES, // build mutation removes the gold bonus going forward
    });
    expect(character.gold).toBe(Math.floor(15 * 0.02 * 100 * 2));
    expect(result.progress.deltaGold).toBe(character.gold);
  });

  it('re-snapshots combat_power with newBonuses after settling', () => {
    const character = makeCharacter({ lastCollectedAt: new Date('2026-01-01T00:00:00Z') });
    settleAndResnapshot(character, {
      now: new Date('2026-01-01T00:00:00Z'), // zero elapsed
      cls: MAGE,
      zone: GREENWOOD,
      oldBonuses: ZERO_BONUSES,
      newBonuses: { ...ZERO_BONUSES, flatAttack: 10 },
    });
    // (14 + 10) * (1 + 5/100) = 25.2 -> 25
    expect(character.combatPower).toBe(25);
  });

  it('adds extraXp/extraGold on top of the passive farm delta (boss reward)', () => {
    const now = new Date('2026-01-01T00:00:10Z'); // +10s -> farm xp=7, gold=3 (combatPower=15)
    const character = makeCharacter();
    const result = settleAndResnapshot(character, {
      now,
      cls: MAGE,
      zone: GREENWOOD,
      oldBonuses: ZERO_BONUSES,
      newBonuses: ZERO_BONUSES,
      extraXp: 50, // < xpRequired(1)=100, sem level up de propósito
      extraGold: 200,
    });
    expect(result.progress.deltaXp).toBe(7); // farm passivo isolado, sem o extra
    expect(result.appliedXp).toBe(7 + 50);
    expect(result.appliedGold).toBe(3 + 200);
    expect(character.xp).toBe(7 + 50);
    expect(character.gold).toBe(3 + 200);
    expect(result.leveledUp).toBe(false);
  });

  it('ignores negative extraXp/extraGold', () => {
    const now = new Date('2026-01-01T00:00:00Z'); // zero elapsed
    const character = makeCharacter();
    const result = settleAndResnapshot(character, {
      now,
      cls: MAGE,
      zone: GREENWOOD,
      oldBonuses: ZERO_BONUSES,
      newBonuses: ZERO_BONUSES,
      extraXp: -50,
      extraGold: -50,
    });
    expect(result.appliedXp).toBe(0);
    expect(result.appliedGold).toBe(0);
  });

  it('resolves level ups from settled xp', () => {
    const character = makeCharacter({ combatPower: 100000 });
    const result = settleAndResnapshot(character, {
      now: new Date('2026-01-01T01:00:00Z'), // +3600s
      cls: MAGE,
      zone: GREENWOOD,
      oldBonuses: ZERO_BONUSES,
      newBonuses: ZERO_BONUSES,
    });
    expect(result.leveledUp).toBe(true);
    expect(character.level).toBeGreaterThan(1);
  });
});
