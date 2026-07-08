import { CharacterClass } from '../classes/class.entity';
import { BuildBonuses, ZERO_BONUSES } from './build';

/**
 * combat_power / power score (§3, §8 — tunável): DPS-weighted, deriva de
 * stats de classe + nível + bônus de build (itens equipados + talentos, Fase 1):
 *   attack        = (baseAttack + attackGrowth * (level-1) + flatAttack) * (1 + pctAttack/100)
 *   survivability = (baseSurv   + survGrowth   * (level-1) + flatSurv)   * (1 + pctSurv/100)
 *   combatPower   = round(attack * (1 + survivability / 100))
 *
 * Puro e determinístico. Snapshot persistido; NUNCA computado de input do cliente.
 */
export function computePower(
  cls: Pick<
    CharacterClass,
    'baseAttack' | 'attackGrowth' | 'baseSurvivability' | 'survivabilityGrowth'
  >,
  level: number,
  bonuses: BuildBonuses = ZERO_BONUSES,
): number {
  const lvlSteps = Math.max(0, level - 1);
  const attack =
    (cls.baseAttack + cls.attackGrowth * lvlSteps + bonuses.flatAttack) *
    (1 + bonuses.pctAttack / 100);
  const survivability =
    (cls.baseSurvivability +
      cls.survivabilityGrowth * lvlSteps +
      bonuses.flatSurvivability) *
    (1 + bonuses.pctSurvivability / 100);
  const survivabilityFactor = 1 + survivability / 100;
  return Math.max(1, Math.round(attack * survivabilityFactor));
}
