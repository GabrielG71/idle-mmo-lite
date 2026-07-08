import { useState } from 'react';
import { Brain, RotateCcw } from 'lucide-react';
import { talentsForClass, type BuildState, type CharacterState } from '@idle/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';

export function TalentsPanel({
  characterId,
  classId,
  build,
  onMutated,
}: {
  characterId: string;
  classId: number;
  build: BuildState;
  onMutated: (result: { character: CharacterState; build: BuildState }) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const talents = talentsForClass(classId);
  const pointsLeft = build.talentPointsTotal - build.talentPointsSpent;

  async function addPoint(talentId: string, maxPoints: number) {
    const current = build.talents[talentId] ?? 0;
    if (current >= maxPoints || pointsLeft <= 0) return;
    setBusy(true);
    setError(null);
    try {
      const target = { ...build.talents, [talentId]: current + 1 };
      const result = await api.allocateTalents(characterId, target);
      onMutated(result);
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  async function respec() {
    setBusy(true);
    setError(null);
    try {
      const result = await api.respecTalents(characterId);
      onMutated(result);
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Brain size={18} className="text-primary" /> Talentos
        </CardTitle>
        <span className="text-xs text-muted">
          {pointsLeft} de {build.talentPointsTotal} pontos livres
        </span>
      </CardHeader>
      <CardContent className="space-y-2">
        {error && <p className="text-sm text-red-400">{error}</p>}
        {talents.map((talent) => {
          const points = build.talents[talent.id] ?? 0;
          return (
            <div
              key={talent.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background/40 px-3 py-2"
            >
              <div>
                <div className="text-sm font-medium">{talent.name}</div>
                <div className="text-xs text-muted">{talent.description}</div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm tabular-nums">
                  {points}/{talent.maxPoints}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy || points >= talent.maxPoints || pointsLeft <= 0}
                  onClick={() => addPoint(talent.id, talent.maxPoints)}
                >
                  +
                </Button>
              </div>
            </div>
          );
        })}

        <Button
          variant="outline"
          size="sm"
          className="mt-2 gap-2"
          disabled={busy}
          onClick={respec}
        >
          <RotateCcw size={14} /> Resetar talentos ({build.respecCost} gold)
        </Button>
      </CardContent>
    </Card>
  );
}
