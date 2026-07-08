/** Tipos/DTOs compartilhados entre API e web. */

/** IDs de classe seedadas (ver seed). */
export enum ClassId {
  Warrior = 1,
  Mage = 2,
  Rogue = 3,
}

export enum ZoneId {
  Greenwood = 1,
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

/** Resultado de uma coleta. */
export interface CollectResult {
  collectedXp: number;
  collectedGold: number;
  cappedElapsedSeconds: number;
  capReached: boolean;
  levelBefore: number;
  levelAfter: number;
  leveledUp: boolean;
  character: CharacterState;
}

/** Auth. */
export interface AuthResponse {
  accessToken: string;
  user: { id: string; email: string };
}

export interface CreateCharacterDto {
  classId: number;
}
