import { Zone } from '../zones/zone.entity';

export interface ProgressInput {
  elapsedSeconds: number;
  combatPower: number;
  zone: Pick<
    Zone,
    'xpRatePerPowerSec' | 'goldRatePerPowerSec' | 'offlineCapSeconds'
  >;
  /** Multiplicadores da build (ex: 1.05 = +5% de pctXp). Default 1. */
  xpMultiplier?: number;
  goldMultiplier?: number;
}

export interface ProgressResult {
  cappedElapsedSeconds: number;
  capReached: boolean;
  deltaXp: number;
  deltaGold: number;
}

/**
 * Cálculo de progresso offline (§2.1). O(1), determinístico, server-side.
 * Faz clamp de elapsed ao cap da zona — ausências longas não geram valor
 * além do cap (perda de oportunidade, nunca de progresso base).
 *
 * deltaXp   = floor(combatPower * xpRatePerPowerSec   * cappedElapsed)
 * deltaGold = floor(combatPower * goldRatePerPowerSec * cappedElapsed)
 */
export function calculateProgress(input: ProgressInput): ProgressResult {
  const { combatPower, zone } = input;
  const xpMult = input.xpMultiplier ?? 1;
  const goldMult = input.goldMultiplier ?? 1;
  const elapsed = Math.max(0, Math.floor(input.elapsedSeconds));
  const cap = zone.offlineCapSeconds;
  const cappedElapsed = Math.min(elapsed, cap);
  const capReached = elapsed >= cap;

  const deltaXp = Math.floor(
    combatPower * zone.xpRatePerPowerSec * cappedElapsed * xpMult,
  );
  const deltaGold = Math.floor(
    combatPower * zone.goldRatePerPowerSec * cappedElapsed * goldMult,
  );

  return { cappedElapsedSeconds: cappedElapsed, capReached, deltaXp, deltaGold };
}
