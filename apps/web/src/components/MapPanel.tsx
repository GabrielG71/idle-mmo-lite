import { useEffect, useState } from 'react';
import { MapPin, Skull, Clock } from 'lucide-react';
import { getItemTemplate, type BossDef, type BossStatus, type CharacterState, type ZoneDef } from '@idle/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';

function formatCountdown(iso: string | null): string | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return null;
  const totalSeconds = Math.ceil(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h}h ${m}m ${s}s`;
}

export function MapPanel({
  characterId,
  character,
  onCharacterChanged,
}: {
  characterId: string;
  character: CharacterState;
  onCharacterChanged: (character: CharacterState) => void;
}) {
  const [zones, setZones] = useState<ZoneDef[]>([]);
  const [bossDefs, setBossDefs] = useState<BossDef[]>([]);
  const [statuses, setStatuses] = useState<BossStatus[]>([]);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<string | null>(null);
  const [, forceTick] = useState(0);

  useEffect(() => {
    api.listZones().then(setZones).catch((err) => setError(String(err)));
    api.listBossDefs().then(setBossDefs).catch((err) => setError(String(err)));
  }, []);

  function refreshBosses() {
    api.listCharacterBosses(characterId).then(setStatuses).catch((err) => setError(String(err)));
  }

  useEffect(refreshBosses, [characterId, character.combatPower, character.currentZoneId]);

  // Re-renderiza a cada segundo só pra contagem regressiva do cooldown andar.
  useEffect(() => {
    const interval = setInterval(() => forceTick((n) => n + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  async function travel(zoneId: number) {
    setBusyKey(`travel-${zoneId}`);
    setError(null);
    try {
      const updated = await api.travelToZone(characterId, zoneId);
      onCharacterChanged(updated);
    } catch (err) {
      setError(String(err));
    } finally {
      setBusyKey(null);
    }
  }

  async function challenge(bossId: number, bossName: string) {
    setBusyKey(`kill-${bossId}`);
    setError(null);
    setLastResult(null);
    try {
      const result = await api.killBoss(characterId, bossId);
      onCharacterChanged(result.character);
      const lootNames = result.droppedItems
        .map((d) => getItemTemplate(d.templateId)?.name ?? `Item #${d.templateId}`)
        .join(', ');
      setLastResult(
        `${bossName} derrotado! +${result.xpAwarded} XP, +${result.goldAwarded} gold. Loot: ${lootNames}`,
      );
      refreshBosses();
    } catch (err) {
      setError(String(err));
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin size={18} className="text-primary" /> Mapa
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {error && <p className="text-sm text-red-400">{error}</p>}
        {lastResult && <p className="text-sm text-primary">{lastResult}</p>}

        {zones.map((zone) => {
          const isCurrent = zone.id === character.currentZoneId;
          const canTravel = character.combatPower >= zone.minPowerScore;
          const boss = statuses.find((s) => s.zoneId === zone.id);
          const bossDef = boss ? bossDefs.find((b) => b.id === boss.bossId) : undefined;
          const countdown = boss ? formatCountdown(boss.onCooldownUntil) : null;

          return (
            <div key={zone.id} className="rounded-lg border border-border bg-background/40 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-medium">
                    {zone.name}{' '}
                    {isCurrent && <span className="text-xs text-primary">(atual)</span>}
                  </div>
                  <div className="text-xs text-muted">Requer {zone.minPowerScore} power</div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isCurrent || !canTravel || busyKey === `travel-${zone.id}`}
                  onClick={() => travel(zone.id)}
                >
                  {isCurrent ? 'Aqui' : canTravel ? 'Viajar' : 'Power insuficiente'}
                </Button>
              </div>

              {boss && bossDef && (
                <div className="mt-2 flex items-center justify-between gap-3 border-t border-border pt-2">
                  <div>
                    <div className="flex items-center gap-1 text-sm">
                      <Skull size={14} className="text-accent" /> {boss.name}
                    </div>
                    <div className="text-xs text-muted">
                      Requer {boss.minPowerScore} power · +{bossDef.xpReward} XP, +
                      {bossDef.goldReward} gold
                    </div>
                    {countdown && (
                      <div className="flex items-center gap-1 text-xs text-muted">
                        <Clock size={12} /> Disponível em {countdown}
                      </div>
                    )}
                  </div>
                  <Button
                    size="sm"
                    disabled={!boss.canChallenge || busyKey === `kill-${boss.bossId}`}
                    onClick={() => challenge(boss.bossId, boss.name)}
                  >
                    Desafiar
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
