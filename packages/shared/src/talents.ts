/**
 * Árvores de talento por classe (Fase 1). Pontos alocáveis manualmente,
 * respec com custo crescente (spec §3 — decisão tem peso, sem respec grátis).
 */

import { AffixType } from './items';
import { ClassId } from './types';

export interface TalentDef {
  id: string;
  classId: ClassId;
  name: string;
  description: string;
  maxPoints: number;
  effect: { type: AffixType; valuePerPoint: number };
}

/** Coerente com a identidade das classes seedadas (ver SeedClassesZones). */
export const TALENTS: readonly TalentDef[] = [
  // Warrior — survival alto, atk médio
  { id: 'war_toughness', classId: ClassId.Warrior, name: 'Toughness', description: '+2% survivability por ponto', maxPoints: 10, effect: { type: AffixType.PctSurvivability, valuePerPoint: 2 } },
  { id: 'war_weapon_mastery', classId: ClassId.Warrior, name: 'Weapon Mastery', description: '+1.5% attack por ponto', maxPoints: 10, effect: { type: AffixType.PctAttack, valuePerPoint: 1.5 } },
  { id: 'war_plunderer', classId: ClassId.Warrior, name: 'Plunderer', description: '+1.5% gold por ponto', maxPoints: 5, effect: { type: AffixType.PctGold, valuePerPoint: 1.5 } },
  // Mage — atk alto, survival baixo
  { id: 'mage_arcane_power', classId: ClassId.Mage, name: 'Arcane Power', description: '+2.5% attack por ponto', maxPoints: 10, effect: { type: AffixType.PctAttack, valuePerPoint: 2.5 } },
  { id: 'mage_barrier', classId: ClassId.Mage, name: 'Mana Barrier', description: '+1.5% survivability por ponto', maxPoints: 10, effect: { type: AffixType.PctSurvivability, valuePerPoint: 1.5 } },
  { id: 'mage_fast_learner', classId: ClassId.Mage, name: 'Fast Learner', description: '+1% XP por ponto', maxPoints: 5, effect: { type: AffixType.PctXp, valuePerPoint: 1 } },
  // Rogue — híbrido ofensivo
  { id: 'rogue_lethality', classId: ClassId.Rogue, name: 'Lethality', description: '+2% attack por ponto', maxPoints: 10, effect: { type: AffixType.PctAttack, valuePerPoint: 2 } },
  { id: 'rogue_evasion', classId: ClassId.Rogue, name: 'Evasion', description: '+1.5% survivability por ponto', maxPoints: 10, effect: { type: AffixType.PctSurvivability, valuePerPoint: 1.5 } },
  { id: 'rogue_treasure_hunter', classId: ClassId.Rogue, name: 'Treasure Hunter', description: '+2% gold por ponto', maxPoints: 5, effect: { type: AffixType.PctGold, valuePerPoint: 2 } },
] as const;

export function getTalent(id: string): TalentDef | undefined {
  return TALENTS.find((t) => t.id === id);
}

export function talentsForClass(classId: number): TalentDef[] {
  return TALENTS.filter((t) => t.classId === classId);
}

/** Pontos ganhos por nível (nível 1 já concede 1 ponto). */
export const TALENT_POINTS_PER_LEVEL = 1;

export function talentPointsForLevel(level: number): number {
  return Math.max(0, level * TALENT_POINTS_PER_LEVEL);
}

/** Respec: custo em gold dobra a cada uso. */
export const RESPEC_BASE_COST = 100;
export const RESPEC_COST_GROWTH = 2;

export function respecCost(respecCount: number): number {
  return Math.floor(RESPEC_BASE_COST * Math.pow(RESPEC_COST_GROWTH, respecCount));
}
