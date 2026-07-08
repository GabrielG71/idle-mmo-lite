/** Tipos/DTOs compartilhados entre API e web. */

/** IDs de classe seedadas (ver seed). */
export enum ClassId {
  Warrior = 1,
  Mage = 2,
  Rogue = 3,
}

export enum ZoneId {
  Greenwood = 1,
  AshenRidge = 2,
  ShatteredPeaks = 3,
}

export interface ClassDef {
  id: number;
  name: string;
  baseAttack: number;
  baseSurvivability: number;
  attackGrowth: number;
  survivabilityGrowth: number;
}

export interface ZoneDef {
  id: number;
  name: string;
  minPowerScore: number;
  xpRatePerPowerSec: number;
  goldRatePerPowerSec: number;
  offlineCapSeconds: number;
}

/** Estado core do personagem exposto ao cliente. */
export interface CharacterState {
  id: string;
  nickname: string | null;
  classId: number;
  level: number;
  xp: number;
  xpToNextLevel: number;
  prestigeTier: number;
  gold: number;
  currentZoneId: number;
  combatPower: number;
  lastCollectedAt: string; // ISO
}

/** Progresso pendente (preview, sem coletar). */
export interface PendingProgress {
  elapsedSeconds: number;
  cappedElapsedSeconds: number;
  pendingXp: number;
  pendingGold: number;
  capReached: boolean;
}

/** Item instanciado (inventário). Template/nome vêm do catálogo compartilhado. */
export interface ItemState {
  id: string;
  templateId: number;
  rarity: number;
  affixes: Record<string, number>; // AffixType -> valor rolado
  /** Slot em que está equipado, se estiver. */
  equippedSlot: string | null;
}

/** Build do personagem exposta ao cliente. */
export interface BuildState {
  talents: Record<string, number>; // talentId -> pontos
  equippedItems: Record<string, string>; // slot -> itemId
  talentPointsTotal: number;
  talentPointsSpent: number;
  respecCount: number;
  respecCost: number;
}

/** Resultado de uma coleta. */
export interface CollectResult {
  collectedXp: number;
  collectedGold: number;
  cappedElapsedSeconds: number;
  capReached: boolean;
  levelBefore: number;
  levelAfter: number;
  leveledUp: boolean;
  droppedItems: ItemState[];
  character: CharacterState;
}

/** Aloca pontos de talento (estado-alvo absoluto, apenas aditivo). */
export interface AllocateTalentsDto {
  talents: Record<string, number>;
}

/** Viagem entre zonas (§4: gate por power score, não level). */
export interface TravelDto {
  zoneId: number;
}

/** Status de um boss pro personagem atual (mapa completo, Fase 2). */
export interface BossStatus {
  bossId: number;
  zoneId: number;
  name: string;
  minPowerScore: number;
  cooldownHours: number;
  inCurrentZone: boolean;
  powerSufficient: boolean;
  onCooldownUntil: string | null; // ISO, null se disponível agora
  canChallenge: boolean;
}

/** Status de prestígio do personagem (Fase 3). */
export interface PrestigeStatus {
  unlocked: boolean;
  currentTier: number;
  bonusPctPerTier: number;
  currentBonusPct: number;
  nextBonusPct: number;
}

/** Resultado de matar um boss. */
export interface BossKillResult {
  xpAwarded: number;
  goldAwarded: number;
  levelBefore: number;
  levelAfter: number;
  leveledUp: boolean;
  droppedItems: ItemState[];
  cooldownUntil: string; // ISO
  character: CharacterState;
}

/** Auth. */
export interface AuthResponse {
  accessToken: string;
  user: { id: string; email: string };
}

export interface CreateCharacterDto {
  classId: number;
  nickname?: string;
}

/** Ranking global por combat_power (Fase 5, cache Redis; fonte de verdade é Postgres). */
export interface LeaderboardEntry {
  rank: number;
  characterId: string;
  nickname: string | null;
  classId: number;
  level: number;
  prestigeTier: number;
  combatPower: number;
}

/** Resultado de resgatar recompensas acumuladas de world boss. */
export interface WorldBossClaimResult {
  claimedGold: number;
  claimedXp: number;
  levelBefore: number;
  levelAfter: number;
  leveledUp: boolean;
  character: CharacterState;
}
