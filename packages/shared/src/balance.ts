/**
 * Balanceamento v0 — decisões abertas do PROJECT_SPEC.md §8.
 * Tunável. Front e back consomem daqui. Não hardcode fórmula espalhada.
 */

/** Curva de XP: xpRequired(n) = floor(BASE_XP * GROWTH^(n-1)). */
export const BASE_XP = 100;
export const GROWTH = 1.15;

/** Cap de acumulação offline default por zona (8h). */
export const DEFAULT_OFFLINE_CAP_SECONDS = 8 * 60 * 60; // 28800

/** Nível máximo suportado v0 (evita loops infinitos em ganhos absurdos). */
export const MAX_LEVEL = 9999;

/**
 * XP total necessário para subir DO nível `level` para `level + 1`.
 * Determinístico e puro — fonte única da curva.
 */
export function xpRequired(level: number): number {
  return Math.floor(BASE_XP * Math.pow(GROWTH, level - 1));
}

/**
 * Fase 3 — prestígio (§2.2): reset de nível/XP + bônus permanente, desbloqueado
 * por conteúdo (derrotar um boss específico), não por tempo.
 */
/** Boss cujo primeiro kill (histórico, independe do cooldown atual) libera o prestígio. */
export const PRESTIGE_UNLOCK_BOSS_ID = 3; // Peakbound Wyrm (Shattered Peaks)
/** +X% permanente em pctAttack e pctSurvivability por tier de prestígio (combat_power). */
export const PRESTIGE_BONUS_PCT_PER_TIER = 10;
