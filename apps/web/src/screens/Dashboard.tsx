import { useEffect, useState, type ReactNode } from 'react';
import { Sword, Coins, Gauge, Clock, Trophy, LogOut } from 'lucide-react';
import {
  ClassId,
  getItemTemplate,
  xpRequired,
  type BuildState,
  type CharacterState,
  type ItemState,
  type PendingProgress,
  type ZoneDef,
} from '@idle/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { InventoryPanel } from '@/components/InventoryPanel';
import { TalentsPanel } from '@/components/TalentsPanel';
import { MapPanel } from '@/components/MapPanel';
import { api, setToken } from '@/lib/api';

const CLASS_LABEL: Record<number, string> = {
  [ClassId.Warrior]: 'Warrior',
  [ClassId.Mage]: 'Mage',
  [ClassId.Rogue]: 'Rogue',
};

function Stat({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-background/40 px-3 py-2">
      <div className="text-primary">{icon}</div>
      <div>
        <div className="text-xs uppercase tracking-wide text-muted">{label}</div>
        <div className="font-semibold">{value}</div>
      </div>
    </div>
  );
}

export function Dashboard({ characterId, onLogout }: { characterId: string; onLogout: () => void }) {
  const [character, setCharacter] = useState<(CharacterState & { pending: PendingProgress }) | null>(null);
  const [build, setBuild] = useState<BuildState | null>(null);
  const [zones, setZones] = useState<ZoneDef[]>([]);
  const [collecting, setCollecting] = useState(false);
  const [lastDrops, setLastDrops] = useState<ItemState[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  function refreshCharacter() {
    api.getCharacter(characterId).then(setCharacter).catch((err) => setError(String(err)));
  }

  useEffect(() => {
    refreshCharacter();
    api.getBuild(characterId).then(setBuild).catch((err) => setError(String(err)));
    api.listZones().then(setZones).catch((err) => setError(String(err)));
    const interval = setInterval(refreshCharacter, 5000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [characterId]);

  async function collect() {
    setCollecting(true);
    setError(null);
    try {
      const result = await api.collect(characterId);
      setLastDrops(result.droppedItems);
      refreshCharacter();
    } catch (err) {
      setError(String(err));
    } finally {
      setCollecting(false);
    }
  }

  function logout() {
    setToken(null);
    onLogout();
  }

  if (!character || !build) {
    return <div className="p-6 text-center text-muted">Carregando…</div>;
  }

  const xpPct = (character.xp / xpRequired(character.level)) * 100;

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 p-6">
      <header className="flex items-center justify-between">
        <h1 className="bg-gradient-to-br from-white to-muted bg-clip-text text-2xl font-bold text-transparent">
          Idle MMO-lite
        </h1>
        <Button variant="ghost" size="sm" className="gap-2" onClick={logout}>
          <LogOut size={14} /> Sair
        </Button>
      </header>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Sword size={18} className="text-primary" />
            {CLASS_LABEL[character.classId]} · Nível {character.level}
          </CardTitle>
          <span className="rounded-md bg-primary/15 px-2 py-1 text-xs font-medium text-primary">
            {zones.find((z) => z.id === character.currentZoneId)?.name ?? `Zona ${character.currentZoneId}`}
          </span>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="mb-1 flex justify-between text-xs text-muted">
              <span>XP</span>
              <span>
                {character.xp} / {xpRequired(character.level)}
              </span>
            </div>
            <Progress value={xpPct} />
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Stat icon={<Gauge size={18} />} label="Power" value={String(character.combatPower)} />
            <Stat icon={<Coins size={18} />} label="Gold" value={character.gold.toLocaleString()} />
            <Stat icon={<Trophy size={18} />} label="Prestígio" value={String(character.prestigeTier)} />
          </div>

          <div className="flex items-center gap-2 text-xs text-muted">
            <Clock size={14} /> Pendente: {character.pending.pendingXp} XP ·{' '}
            {character.pending.pendingGold} gold
            {character.pending.capReached && ' (cap offline atingido)'}
          </div>

          <Button className="w-full" size="lg" disabled={collecting} onClick={collect}>
            {collecting ? 'Coletando…' : 'Coletar recompensa'}
          </Button>

          {lastDrops && (
            <div className="rounded-lg border border-border bg-background/40 p-3 text-sm">
              {lastDrops.length === 0
                ? 'Nenhum item dropou desta vez.'
                : `Dropou: ${lastDrops
                    .map((d) => getItemTemplate(d.templateId)?.name ?? `Item #${d.templateId}`)
                    .join(', ')}`}
            </div>
          )}
        </CardContent>
      </Card>

      <InventoryPanel
        characterId={characterId}
        build={build}
        onMutated={(result) => {
          setBuild(result.build);
          setCharacter((prev) => (prev ? { ...prev, ...result.character } : prev));
        }}
      />

      <TalentsPanel
        characterId={characterId}
        classId={character.classId}
        build={build}
        onMutated={(result) => {
          setBuild(result.build);
          setCharacter((prev) => (prev ? { ...prev, ...result.character } : prev));
        }}
      />

      <MapPanel
        characterId={characterId}
        character={character}
        onCharacterChanged={(updated) => {
          setCharacter((prev) => (prev ? { ...prev, ...updated } : prev));
        }}
      />
    </div>
  );
}
