import { BuildState, CharacterState, respecCost, talentPointsForLevel } from '@idle/shared';
import { Character } from './character.entity';
import { CharacterBuild } from './character-build.entity';
import { xpRequired } from '../game/xp';

/** Projeta a entidade Character no DTO exposto ao cliente. */
export function toCharacterState(c: Character): CharacterState {
  return {
    id: c.id,
    nickname: c.nickname,
    classId: c.classId,
    level: c.level,
    xp: c.xp,
    xpToNextLevel: Math.max(0, xpRequired(c.level) - c.xp),
    prestigeTier: c.prestigeTier,
    gold: c.gold,
    currentZoneId: c.currentZoneId,
    combatPower: c.combatPower,
    lastCollectedAt: c.lastCollectedAt.toISOString(),
  };
}

/** Projeta a build (talentos + equipamento) no DTO exposto ao cliente. */
export function toBuildState(build: CharacterBuild, level: number): BuildState {
  const talentPointsSpent = Object.values(build.talents).reduce(
    (sum: number, v: number) => sum + v,
    0,
  );
  return {
    talents: build.talents,
    equippedItems: build.equippedItems,
    talentPointsTotal: talentPointsForLevel(level),
    talentPointsSpent,
    respecCount: build.respecCount,
    respecCost: respecCost(build.respecCount),
  };
}
