import type { ReactNode } from 'react';
import { Sword, Sparkles, Coins, Gauge, Clock, Trophy } from 'lucide-react';
import { xpRequired, ClassId, type CharacterState } from '@idle/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

// Placeholder estático (Fase 0). Fase 4 conecta via WebSocket ao ticker do servidor.
const MOCK: CharacterState = {
  id: 'preview',
  classId: ClassId.Mage,
  level: 7,
  xp: 140,
  xpToNextLevel: Math.max(0, xpRequired(7) - 140),
  prestigeTier: 0,
  gold: 4820,
  currentZoneId: 1,
  combatPower: 42,
  lastCollectedAt: new Date().toISOString(),
};

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

export default function App() {
  const c = MOCK;
  const xpPct = (c.xp / xpRequired(c.level)) * 100;

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-6 p-6">
      <header className="text-center">
        <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs text-muted">
          <Sparkles size={14} className="text-accent" /> Fase 0 · placeholder UI
        </div>
        <h1 className="bg-gradient-to-br from-white to-muted bg-clip-text text-4xl font-bold text-transparent">
          Idle MMO-lite
        </h1>
        <p className="mt-1 text-sm text-muted">
          Farm automático, inclusive offline. Sua decisão é a build.
        </p>
      </header>

      <Card className="w-full">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Sword size={18} className="text-primary" />
            {CLASS_LABEL[c.classId]} · Nível {c.level}
          </CardTitle>
          <span className="rounded-md bg-primary/15 px-2 py-1 text-xs font-medium text-primary">
            Greenwood
          </span>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="mb-1 flex justify-between text-xs text-muted">
              <span>XP</span>
              <span>
                {c.xp} / {xpRequired(c.level)}
              </span>
            </div>
            <Progress value={xpPct} />
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Stat icon={<Gauge size={18} />} label="Power" value={String(c.combatPower)} />
            <Stat icon={<Coins size={18} />} label="Gold" value={c.gold.toLocaleString()} />
            <Stat icon={<Trophy size={18} />} label="Prestígio" value={String(c.prestigeTier)} />
          </div>

          <div className="flex items-center gap-2 text-xs text-muted">
            <Clock size={14} /> Cap offline: 8h · progresso calculado no servidor
          </div>

          <Button className="w-full" size="lg" disabled>
            Coletar recompensa (mock)
          </Button>
        </CardContent>
      </Card>

      <p className="text-center text-xs text-muted">
        Placeholder consumindo tipos de <code>@idle/shared</code>. Fase 4 liga o ticker real
        via WebSocket e a janela Picture-in-Picture.
      </p>
    </div>
  );
}
