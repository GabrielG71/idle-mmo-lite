import { Character } from './character.entity';
import { CharacterClass } from '../classes/class.entity';
import { Zone } from '../zones/zone.entity';
import { computePower } from '../game/power';
import { applyXp } from '../game/xp';
import { calculateProgress, ProgressResult } from '../game/progress';
import { BuildBonuses } from '../game/build';

export interface SettleOptions {
  now: Date;
  cls: Pick<
    CharacterClass,
    'baseAttack' | 'attackGrowth' | 'baseSurvivability' | 'survivabilityGrowth'
  >;
  zone: Pick<Zone, 'xpRatePerPowerSec' | 'goldRatePerPowerSec' | 'offlineCapSeconds'>;
  /** Bônus vigentes durante a janela que está sendo liquidada. */
  oldBonuses: BuildBonuses;
  /** Bônus da build já mutada — usados para o re-snapshot de combat_power. */
  newBonuses: BuildBonuses;
  /** Recompensa adicional fora do farm passivo (ex: kill de boss). */
  extraXp?: number;
  extraGold?: number;
}

export interface SettleResult {
  /** Reflete só o farm passivo (elapsed x rates), sem extraXp/extraGold. */
  progress: ProgressResult;
  /** Total realmente aplicado (farm passivo + extraXp/extraGold). */
  appliedXp: number;
  appliedGold: number;
  levelBefore: number;
  levelAfter: number;
  leveledUp: boolean;
}

/**
 * Liquida o progresso pendente usando o combat_power ATUAL (reflete os
 * bônus vigentes até agora) e só então re-snapshotta combat_power com os
 * bônus novos. Usado por collect e por toda mutação de build (equip/
 * unequip/talentos/respec) — garante que trocar de build nunca re-precifica
 * retroativamente a janela offline (mesma invariante do §6.3/CLAUDE.md).
 * Muta `character` in-place; caller é responsável por persistir.
 */
export function settleAndResnapshot(
  character: Character,
  options: SettleOptions,
): SettleResult {
  const elapsedSeconds = Math.max(
    0,
    Math.floor((options.now.getTime() - character.lastCollectedAt.getTime()) / 1000),
  );
  const progress = calculateProgress({
    elapsedSeconds,
    combatPower: character.combatPower,
    zone: options.zone,
    xpMultiplier: 1 + options.oldBonuses.pctXp / 100,
    goldMultiplier: 1 + options.oldBonuses.pctGold / 100,
  });

  const appliedXp = progress.deltaXp + Math.max(0, options.extraXp ?? 0);
  const appliedGold = progress.deltaGold + Math.max(0, options.extraGold ?? 0);

  const levelBefore = character.level;
  const applied = applyXp(character.level, character.xp, appliedXp);

  character.level = applied.level;
  character.xp = applied.xp;
  character.gold += appliedGold;
  character.lastCollectedAt = options.now;
  character.combatPower = computePower(options.cls, character.level, options.newBonuses);

  return {
    progress,
    appliedXp,
    appliedGold,
    levelBefore,
    levelAfter: character.level,
    leveledUp: applied.leveledUp,
  };
}
