import { useCallback, useEffect, useState } from 'react';
import type { CharacterState } from '@idle/shared';
import { AuthScreen } from '@/screens/AuthScreen';
import { CreateCharacterScreen } from '@/screens/CreateCharacterScreen';
import { Dashboard } from '@/screens/Dashboard';
import { api, getToken, setToken } from '@/lib/api';

type AuthState = 'checking' | 'anonymous' | 'authenticated';

export default function App() {
  const [authState, setAuthState] = useState<AuthState>('checking');
  const [characters, setCharacters] = useState<CharacterState[] | null>(null);

  const loadCharacters = useCallback(async () => {
    try {
      const list = await api.listCharacters();
      setCharacters(list);
      setAuthState('authenticated');
    } catch {
      setToken(null);
      setAuthState('anonymous');
    }
  }, []);

  useEffect(() => {
    if (getToken()) {
      loadCharacters();
    } else {
      setAuthState('anonymous');
    }
  }, [loadCharacters]);

  if (authState === 'checking') {
    return <div className="flex min-h-screen items-center justify-center text-muted">Carregando…</div>;
  }

  if (authState === 'anonymous') {
    return <AuthScreen onAuthenticated={loadCharacters} />;
  }

  if (!characters || characters.length === 0) {
    return <CreateCharacterScreen onCreated={loadCharacters} />;
  }

  return (
    <Dashboard
      characterId={characters[0].id}
      onLogout={() => {
        setCharacters(null);
        setAuthState('anonymous');
      }}
    />
  );
}
