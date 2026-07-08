import { CharacterClass } from '../classes/class.entity';

/**
 * combat_power v0 (§8, tunável): DPS-weighted, deriva de stats de classe + nível.
 *   attack        = baseAttack        + attackGrowth        * (level - 1)
 *   survivability = baseSurvivability + survivabilityGrowth * (level - 1)
 *   combatPower   = round(attack * (1 + survivability / 100))
 *
 * Puro e determinístico. Snapshot persistido; NUNCA computado de input do cliente.
 * Fase 1 somará bônus de itens/talentos aqui.
 */
export function computePower(
  cls: Pick<
    CharacterClass,
    'baseAttack' | 'attackGrowth' | 'baseSurvivability' | 'survivabilityGrowth'
  >,
  level: number,
): number {
  const lvlSteps = Math.max(0, level - 1);
  const attack = cls.baseAttack + cls.attackGrowth * lvlSteps;
  const survivability = cls.baseSurvivability + cls.survivabilityGrowth * lvlSteps;
  const survivabilityFactor = 1 + survivability / 100;
  return Math.max(1, Math.round(attack * survivabilityFactor));
}
