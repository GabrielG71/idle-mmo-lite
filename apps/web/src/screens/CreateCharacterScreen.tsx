import { useEffect, useState } from 'react';
import { Swords } from 'lucide-react';
import type { ClassDef } from '@idle/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { api, ApiError } from '@/lib/api';

export function CreateCharacterScreen({ onCreated }: { onCreated: () => void }) {
  const [classes, setClasses] = useState<ClassDef[]>([]);
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [creatingId, setCreatingId] = useState<number | null>(null);

  useEffect(() => {
    api.listClasses().then(setClasses).catch((err) => setError(String(err)));
  }, []);

  async function create(classId: number) {
    setError(null);
    setCreatingId(classId);
    try {
      await api.createCharacter(classId, nickname.trim() || undefined);
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Falha ao criar personagem');
    } finally {
      setCreatingId(null);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-6 p-6">
      <header className="text-center">
        <h1 className="text-2xl font-bold">Escolha sua classe</h1>
        <p className="mt-1 text-sm text-muted">Farm automático — a decisão é a build.</p>
      </header>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <input
        type="text"
        maxLength={24}
        placeholder="Apelido (opcional — aparece no leaderboard)"
        value={nickname}
        onChange={(e) => setNickname(e.target.value)}
        className="w-full max-w-sm rounded-lg border border-border bg-background/40 px-3 py-2 text-sm outline-none focus:border-primary"
      />

      <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-3">
        {classes.map((cls) => (
          <Card key={cls.id}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Swords size={16} className="text-primary" /> {cls.name}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <dl className="space-y-1 text-xs text-muted">
                <div className="flex justify-between">
                  <dt>Attack base</dt>
                  <dd>{cls.baseAttack}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Survivability base</dt>
                  <dd>{cls.baseSurvivability}</dd>
                </div>
              </dl>
              <Button
                className="w-full"
                onClick={() => create(cls.id)}
                disabled={creatingId !== null}
              >
                {creatingId === cls.id ? 'Criando…' : 'Jogar de ' + cls.name}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
