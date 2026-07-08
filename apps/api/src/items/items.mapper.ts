import { ItemState } from '@idle/shared';
import { Item } from './item.entity';

export function toItemState(item: Item, equippedSlot: string | null = null): ItemState {
  return {
    id: item.id,
    templateId: item.templateId,
    rarity: item.rarity,
    affixes: item.affixes as Record<string, number>,
    equippedSlot,
  };
}
