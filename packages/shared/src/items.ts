/**
 * Catálogo de itens + tuning de drop (Fase 1). Vive em código compartilhado:
 * o front precisa de nomes/stats p/ exibir; o DB guarda só instâncias
 * (template_id + rarity + afixos rolados).
 */

export enum EquipSlot {
  Weapon = 'weapon',
  Armor = 'armor',
  Trinket = 'trinket',
}

export enum Rarity {
  Common = 1,
  Uncommon = 2,
  Rare = 3,
  Epic = 4,
  Legendary = 5,
}

/** Afixos roláveis em itens; talentos usam os mesmos tipos de bônus. */
export enum AffixType {
  FlatAttack = 'flatAttack',
  PctAttack = 'pctAttack',
  FlatSurvivability = 'flatSurvivability',
  PctSurvivability = 'pctSurvivability',
  PctXp = 'pctXp',
  PctGold = 'pctGold',
}

export interface ItemTemplateDef {
  id: number;
  name: string;
  slot: EquipSlot;
  baseAttack: number;
  baseSurvivability: number;
}

/** 3 escalas por slot (early/mid/late do v0). */
export const ITEM_TEMPLATES: readonly ItemTemplateDef[] = [
  { id: 1, name: 'Rusty Blade', slot: EquipSlot.Weapon, baseAttack: 3, baseSurvivability: 0 },
  { id: 2, name: 'Soldier Sword', slot: EquipSlot.Weapon, baseAttack: 7, baseSurvivability: 0 },
  { id: 3, name: 'Runic Saber', slot: EquipSlot.Weapon, baseAttack: 14, baseSurvivability: 2 },
  { id: 4, name: 'Leather Vest', slot: EquipSlot.Armor, baseAttack: 0, baseSurvivability: 4 },
  { id: 5, name: 'Chain Mail', slot: EquipSlot.Armor, baseAttack: 0, baseSurvivability: 9 },
  { id: 6, name: 'Dragonhide Plate', slot: EquipSlot.Armor, baseAttack: 2, baseSurvivability: 16 },
  { id: 7, name: 'Copper Ring', slot: EquipSlot.Trinket, baseAttack: 1, baseSurvivability: 1 },
  { id: 8, name: 'Wolf Talisman', slot: EquipSlot.Trinket, baseAttack: 3, baseSurvivability: 3 },
  { id: 9, name: 'Ancient Amulet', slot: EquipSlot.Trinket, baseAttack: 6, baseSurvivability: 5 },
] as const;

/**
 * Itens exclusivos de boss (Fase 2) — pool separado de `ITEM_TEMPLATES` de
 * propósito: `rollLoot` (farm comum) nunca deve sortear estes; só
 * `rollBossLoot` os usa, via `BossDef.lootTemplateIds`.
 */
export const BOSS_ITEM_TEMPLATES: readonly ItemTemplateDef[] = [
  { id: 10, name: 'Bramblehide Fang', slot: EquipSlot.Weapon, baseAttack: 10, baseSurvivability: 1 },
  { id: 11, name: 'Bramblehide Cloak', slot: EquipSlot.Armor, baseAttack: 0, baseSurvivability: 12 },
  { id: 12, name: 'Cinder Warden Blade', slot: EquipSlot.Weapon, baseAttack: 20, baseSurvivability: 3 },
  { id: 13, name: 'Cinder Warden Plate', slot: EquipSlot.Armor, baseAttack: 1, baseSurvivability: 26 },
  { id: 14, name: 'Peakbound Fang', slot: EquipSlot.Weapon, baseAttack: 34, baseSurvivability: 6 },
  { id: 15, name: 'Peakbound Carapace', slot: EquipSlot.Armor, baseAttack: 2, baseSurvivability: 44 },
] as const;

/**
 * Itens exclusivos do world boss (Fase 5) — pool separado, só rolado pra
 * top contribuidores quando o evento global é derrotado.
 */
export const WORLD_BOSS_ITEM_TEMPLATES: readonly ItemTemplateDef[] = [
  { id: 16, name: 'Worldbreaker Edge', slot: EquipSlot.Weapon, baseAttack: 50, baseSurvivability: 8 },
  { id: 17, name: "Titan's Aegis", slot: EquipSlot.Armor, baseAttack: 3, baseSurvivability: 60 },
] as const;

export function getItemTemplate(id: number): ItemTemplateDef | undefined {
  return (
    ITEM_TEMPLATES.find((t) => t.id === id) ??
    BOSS_ITEM_TEMPLATES.find((t) => t.id === id) ??
    WORLD_BOSS_ITEM_TEMPLATES.find((t) => t.id === id)
  );
}

/** Ranges base por afixo; valor final = roll * statMultiplier da raridade. */
export const AFFIX_RANGES: Record<AffixType, { min: number; max: number }> = {
  [AffixType.FlatAttack]: { min: 1, max: 4 },
  [AffixType.PctAttack]: { min: 1, max: 5 },
  [AffixType.FlatSurvivability]: { min: 1, max: 5 },
  [AffixType.PctSurvivability]: { min: 1, max: 5 },
  [AffixType.PctXp]: { min: 1, max: 4 },
  [AffixType.PctGold]: { min: 1, max: 6 },
};

export interface RarityConfig {
  /** Peso relativo no sorteio de raridade. */
  weight: number;
  /** Quantos afixos distintos o item rola. */
  affixCount: number;
  /** Multiplica stats base do template e valores de afixo. */
  statMultiplier: number;
}

export const RARITY_CONFIG: Record<Rarity, RarityConfig> = {
  [Rarity.Common]: { weight: 100, affixCount: 0, statMultiplier: 1.0 },
  [Rarity.Uncommon]: { weight: 40, affixCount: 1, statMultiplier: 1.15 },
  [Rarity.Rare]: { weight: 12, affixCount: 2, statMultiplier: 1.35 },
  [Rarity.Epic]: { weight: 3, affixCount: 3, statMultiplier: 1.6 },
  [Rarity.Legendary]: { weight: 1, affixCount: 4, statMultiplier: 2.0 },
};

export const RARITY_LABEL: Record<Rarity, string> = {
  [Rarity.Common]: 'Common',
  [Rarity.Uncommon]: 'Uncommon',
  [Rarity.Rare]: 'Rare',
  [Rarity.Epic]: 'Epic',
  [Rarity.Legendary]: 'Legendary',
};

/** 1 drop esperado a cada 30min de farm útil (tunável). */
export const DROP_INTERVAL_SECONDS = 1800;
/** Cap de drops por coleta (8h de cap / 30min = 16). */
export const MAX_DROPS_PER_COLLECT = 16;
