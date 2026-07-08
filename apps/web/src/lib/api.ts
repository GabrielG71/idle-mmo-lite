import type {
  AuthResponse,
  BossKillResult,
  BossStatus,
  BossDef,
  BuildState,
  CharacterState,
  ClassDef,
  CollectResult,
  ItemState,
  ItemTemplateDef,
  PendingProgress,
  PrestigeStatus,
  TalentDef,
  ZoneDef,
} from '@idle/shared';

const API_BASE = import.meta.env.VITE_API_BASE ?? '/api';
const TOKEN_KEY = 'idle_mmo_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}) as { message?: string });
    throw new ApiError(res.status, body.message ?? res.statusText);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

type BuildMutationResult = { character: CharacterState; build: BuildState };

export const api = {
  register: (email: string, password: string) =>
    request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  login: (email: string, password: string) =>
    request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  listClasses: () => request<ClassDef[]>('/classes'),
  listZones: () => request<ZoneDef[]>('/zones'),
  listItemTemplates: () => request<ItemTemplateDef[]>('/item-templates'),
  listTalentDefs: () => request<TalentDef[]>('/talents'),
  listBossDefs: () => request<BossDef[]>('/bosses'),
  listCharacters: () => request<CharacterState[]>('/characters'),
  createCharacter: (classId: number, nickname?: string) =>
    request<CharacterState>('/characters', {
      method: 'POST',
      body: JSON.stringify({ classId, nickname }),
    }),
  getCharacter: (id: string) =>
    request<CharacterState & { pending: PendingProgress }>(`/characters/${id}`),
  collect: (id: string) =>
    request<CollectResult>(`/characters/${id}/collect`, { method: 'POST' }),
  getBuild: (id: string) => request<BuildState>(`/characters/${id}/build`),
  listItems: (id: string) => request<ItemState[]>(`/characters/${id}/items`),
  equipItem: (id: string, itemId: string) =>
    request<BuildMutationResult>(`/characters/${id}/items/${itemId}/equip`, {
      method: 'POST',
    }),
  unequipItem: (id: string, itemId: string) =>
    request<BuildMutationResult>(`/characters/${id}/items/${itemId}/unequip`, {
      method: 'POST',
    }),
  allocateTalents: (id: string, talents: Record<string, number>) =>
    request<BuildMutationResult>(`/characters/${id}/talents`, {
      method: 'POST',
      body: JSON.stringify({ talents }),
    }),
  respecTalents: (id: string) =>
    request<BuildMutationResult>(`/characters/${id}/talents/respec`, {
      method: 'POST',
    }),
  travelToZone: (id: string, zoneId: number) =>
    request<CharacterState>(`/characters/${id}/zone`, {
      method: 'POST',
      body: JSON.stringify({ zoneId }),
    }),
  listCharacterBosses: (id: string) => request<BossStatus[]>(`/characters/${id}/bosses`),
  killBoss: (id: string, bossId: number) =>
    request<BossKillResult>(`/characters/${id}/bosses/${bossId}/kill`, {
      method: 'POST',
    }),
  getPrestigeStatus: (id: string) => request<PrestigeStatus>(`/characters/${id}/prestige`),
  prestige: (id: string) =>
    request<CharacterState>(`/characters/${id}/prestige`, { method: 'POST' }),
};
