import { useEffect, useState } from 'react';
import { Package } from 'lucide-react';
import { getItemTemplate, RARITY_LABEL, type BuildState, type CharacterState, type ItemState, type Rarity } from '@idle/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';

const RARITY_COLOR: Record<number, string> = {
  1: 'text-muted',
  2: 'text-emerald-400',
  3: 'text-sky-400',
  4: 'text-fuchsia-400',
  5: 'text-amber-400',
};

export function InventoryPanel({
  characterId,
  build,
  onMutated,
}: {
  characterId: string;
  build: BuildState;
  onMutated: (result: { character: CharacterState; build: BuildState }) => void;
}) {
  const [items, setItems] = useState<ItemState[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function refresh() {
    api.listItems(characterId).then(setItems).catch((err) => setError(String(err)));
  }

  useEffect(refresh, [characterId, build]);

  async function toggleEquip(item: ItemState) {
    setBusyId(item.id);
    setError(null);
    try {
      const result = item.equippedSlot
        ? await api.unequipItem(characterId, item.id)
        : await api.equipItem(characterId, item.id);
      onMutated(result);
    } catch (err) {
      setError(String(err));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package size={18} className="text-primary" /> Inventário
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {error && <p className="text-sm text-red-400">{error}</p>}
        {items.length === 0 && <p className="text-sm text-muted">Nenhum item ainda — colete recompensas para dropar loot.</p>}
        {items.map((item) => {
          const template = getItemTemplate(item.templateId);
          return (
            <div
              key={item.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background/40 px-3 py-2"
            >
              <div>
                <div className={RARITY_COLOR[item.rarity] ?? 'text-foreground'}>
                  {template?.name ?? `Item #${item.templateId}`}{' '}
                  <span className="text-xs">({RARITY_LABEL[item.rarity as Rarity]})</span>
                </div>
                <div className="text-xs text-muted">
                  {template?.slot} ·{' '}
                  {Object.entries(item.affixes)
                    .map(([k, v]) => `${k} +${v}`)
                    .join(', ') || 'sem afixos'}
                </div>
              </div>
              <Button
                size="sm"
                variant={item.equippedSlot ? 'outline' : 'default'}
                disabled={busyId === item.id}
                onClick={() => toggleEquip(item)}
              >
                {item.equippedSlot ? 'Desequipar' : 'Equipar'}
              </Button>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
