import { CharacterState } from '@idle/shared';
import { Character } from './character.entity';
import { xpRequired } from '../game/xp';

/** Projeta a entidade Character no DTO exposto ao cliente. */
export function toCharacterState(c: Character): CharacterState {
  return {
    id: c.id,
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
