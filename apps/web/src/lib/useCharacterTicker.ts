import { useEffect, useState } from 'react';
import type { CharacterState, PendingProgress } from '@idle/shared';
import { getToken } from './api';

export type TickerState = (CharacterState & { pending: PendingProgress }) | null;

const API_BASE = import.meta.env.VITE_API_BASE ?? '/api';

function wsUrl(characterId: string, token: string): string {
  const base = API_BASE.startsWith('http')
    ? API_BASE.replace(/^http/, 'ws')
    : `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}${API_BASE}`;
  return `${base}/ws/characters?token=${encodeURIComponent(token)}&characterId=${characterId}`;
}

/**
 * Ticker do PiP (Fase 4): abre um WebSocket só enquanto `enabled` — o widget
 * PiP/mini-player é a única coisa que consome isso, o Dashboard principal
 * continua com o polling REST de 5s já existente. Puramente view: os dados
 * vêm prontos do servidor (mesmo shape de `GET /characters/:id`).
 */
export function useCharacterTicker(characterId: string, enabled: boolean): TickerState {
  const [state, setState] = useState<TickerState>(null);

  useEffect(() => {
    if (!enabled) {
      setState(null);
      return;
    }
    const token = getToken();
    if (!token) return;

    const ws = new WebSocket(wsUrl(characterId, token));
    ws.onmessage = (event) => {
      try {
        setState(JSON.parse(event.data));
      } catch {
        // frame malformado — ignora, próximo tick corrige
      }
    };

    return () => ws.close();
  }, [characterId, enabled]);

  return state;
}
