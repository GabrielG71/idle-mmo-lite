import { useEffect, useState } from 'react';
import { Crown } from 'lucide-react';
import type { CharacterState, PrestigeStatus } from '@idle/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';

export function PrestigePanel({
  characterId,
  onCharacterChanged,
}: {
  characterId: string;
  onCharacterChanged: (character: CharacterState) => void;
}) {
  const [status, setStatus] = useState<PrestigeStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function refresh() {
    api.getPrestigeStatus(characterId).then(setStatus).catch((err) => setError(String(err)));
  }

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 5000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [characterId]);

  async function doPrestige() {
    setBusy(true);
    setError(null);
    try {
      const character = await api.prestige(characterId);
      onCharacterChanged(character);
      refresh();
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  if (!status) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Crown size={18} className="text-accent" /> Prestígio
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {error && <p className="text-sm text-red-400">{error}</p>}

        <div className="text-sm text-muted">
          Tier atual: <span className="text-foreground">{status.currentTier}</span>
          {status.currentTier > 0 && ` (+${status.currentBonusPct}% attack/survivability permanente)`}
        </div>

        {status.unlocked ? (
          <>
            <p className="text-xs text-muted">
              Reseta nível e XP para 1. Itens, talentos, gold e zona atual são preservados.
              Concede +{status.bonusPctPerTier}% permanente de attack e survivability (total
              após: {status.nextBonusPct}%).
            </p>
            <Button className="w-full" variant="outline" disabled={busy} onClick={doPrestige}>
              {busy ? 'Prestigiando…' : `Prestigiar (tier ${status.currentTier + 1})`}
            </Button>
          </>
        ) : (
          <p className="text-xs text-muted">
            Derrote o Peakbound Wyrm (Shattered Peaks) pelo menos uma vez para desbloquear.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
