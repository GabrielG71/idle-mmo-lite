import { Rarity, WORLD_BOSS_ITEM_TEMPLATES } from '@idle/shared';
import { rollAffixes, rollRarity, RolledItem } from './loot';

/**
 * Matemática pura do world boss (Fase 5). Determinística, sem I/O — o
 * estado efêmero (HP, contribuições) vive no Redis; aqui só a fórmula.
 */

/** Dano por ataque: 1:1 com combat_power (mesma escala usada em todo o jogo). */
export function computeWorldBossDamage(combatPower: number): number {
  return Math.max(0, Math.floor(combatPower));
}

/**
 * Fatia proporcional de um pool de recompensa, arredondada pra baixo.
 * Sem contribuição total, ninguém recebe nada (evita divisão por zero).
 */
export function computeRewardShare(
  pool: number,
  contribution: number,
  totalContribution: number,
): number {
  if (totalContribution <= 0 || contribution <= 0) return 0;
  return Math.floor((pool * contribution) / totalContribution);
}

/**
 * Item exclusivo do world boss — só rolado pro top contribuidores quando o
 * evento é derrotado (§ Fase 5). Piso de raridade Rare, mesmo padrão de
 * `rollBossLoot`, mas sorteia 1 template aleatório da pool em vez de 1 de
 * cada (pool pequena, 1 item por vencedor já é generoso).
 */
export function rollWorldBossLoot(rng: () => number = Math.random): RolledItem {
  const template =
    WORLD_BOSS_ITEM_TEMPLATES[Math.floor(rng() * WORLD_BOSS_ITEM_TEMPLATES.length)];
  const rarity = Math.max(rollRarity(rng), Rarity.Rare) as Rarity;
  return {
    templateId: template.id,
    rarity,
    affixes: rollAffixes(rarity, rng),
  };
}
