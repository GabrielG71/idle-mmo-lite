import {
  AffixType,
  PRESTIGE_BONUS_PCT_PER_TIER,
  RARITY_CONFIG,
  Rarity,
  getItemTemplate,
  getTalent,
} from '@idle/shared';

/** Bônus agregados da build (itens equipados + talentos). Tudo aditivo. */
export interface BuildBonuses {
  flatAttack: number;
  pctAttack: number;
  flatSurvivability: number;
  pctSurvivability: number;
  pctXp: number;
  pctGold: number;
}

export const ZERO_BONUSES: BuildBonuses = Object.freeze({
  flatAttack: 0,
  pctAttack: 0,
  flatSurvivability: 0,
  pctSurvivability: 0,
  pctXp: 0,
  pctGold: 0,
});

/** Shape mínimo de um item p/ agregação (entity Item satisfaz). */
export interface EquippedItemLike {
  templateId: number;
  rarity: number;
  affixes: Record<string, unknown>;
}

function addAffix(acc: BuildBonuses, type: string, value: number): void {
  switch (type) {
    case AffixType.FlatAttack:
      acc.flatAttack += value;
      break;
    case AffixType.PctAttack:
      acc.pctAttack += value;
      break;
    case AffixType.FlatSurvivability:
      acc.flatSurvivability += value;
      break;
    case AffixType.PctSurvivability:
      acc.pctSurvivability += value;
      break;
    case AffixType.PctXp:
      acc.pctXp += value;
      break;
    case AffixType.PctGold:
      acc.pctGold += value;
      break;
    default:
      break; // afixo desconhecido (versão antiga) — ignora, nunca quebra
  }
}

/**
 * Agrega bônus de itens equipados + talentos alocados + prestígio (Fase 3).
 * Puro e determinístico. Stats base do template entram como flat, escalados
 * pelo statMultiplier da raridade; afixos já foram rolados com multiplicador
 * na criação do item; prestígio soma um bônus percentual permanente que
 * escala com o tier (`PRESTIGE_BONUS_PCT_PER_TIER`).
 */
export function aggregateBuildBonuses(
  equippedItems: readonly EquippedItemLike[],
  talents: Record<string, number>,
  prestigeTier = 0,
): BuildBonuses {
  const acc: BuildBonuses = { ...ZERO_BONUSES };

  for (const item of equippedItems) {
    const template = getItemTemplate(item.templateId);
    if (!template) continue; // template removido do catálogo — item inerte
    const mult = RARITY_CONFIG[item.rarity as Rarity]?.statMultiplier ?? 1;
    acc.flatAttack += template.baseAttack * mult;
    acc.flatSurvivability += template.baseSurvivability * mult;
    for (const [type, value] of Object.entries(item.affixes)) {
      if (typeof value === 'number' && Number.isFinite(value)) {
        addAffix(acc, type, value);
      }
    }
  }

  for (const [talentId, points] of Object.entries(talents)) {
    const talent = getTalent(talentId);
    if (!talent || points <= 0) continue;
    const capped = Math.min(points, talent.maxPoints);
    addAffix(acc, talent.effect.type, talent.effect.valuePerPoint * capped);
  }

  if (prestigeTier > 0) {
    const bonus = PRESTIGE_BONUS_PCT_PER_TIER * prestigeTier;
    acc.pctAttack += bonus;
    acc.pctSurvivability += bonus;
  }

  return acc;
}
