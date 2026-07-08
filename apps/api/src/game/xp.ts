import { MAX_LEVEL, xpRequired } from '@idle/shared';

export { xpRequired };

export interface XpApplyResult {
  level: number;
  xp: number; // xp restante dentro do nível atual
  leveledUp: boolean;
}

/**
 * Aplica um ganho de XP resolvendo múltiplos level-ups de uma vez.
 * `xp` é o progresso DENTRO do nível corrente (não acumulado total).
 * Puro e determinístico. O(nº de níveis subidos) — limitado por MAX_LEVEL.
 */
export function applyXp(
  level: number,
  xp: number,
  deltaXp: number,
): XpApplyResult {
  let curLevel = level;
  let curXp = xp + Math.max(0, deltaXp);

  while (curLevel < MAX_LEVEL) {
    const needed = xpRequired(curLevel);
    if (curXp < needed) break;
    curXp -= needed;
    curLevel += 1;
  }

  if (curLevel >= MAX_LEVEL) {
    curLevel = MAX_LEVEL;
    curXp = 0;
  }

  return { level: curLevel, xp: curXp, leveledUp: curLevel > level };
}
