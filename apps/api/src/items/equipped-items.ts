import { EntityManager, In } from 'typeorm';
import { Item } from './item.entity';
import { CharacterBuild } from '../characters/character-build.entity';

/** Carrega as entidades Item atualmente equipadas na build (por slot). */
export async function loadEquippedItems(
  manager: EntityManager,
  build: Pick<CharacterBuild, 'equippedItems'>,
): Promise<Item[]> {
  const ids = Object.values(build.equippedItems).filter(Boolean);
  if (ids.length === 0) return [];
  return manager.getRepository(Item).find({ where: { id: In(ids) } });
}

/** Slot em que um item está equipado na build, ou null se nenhum. */
export function equippedSlotOf(
  build: Pick<CharacterBuild, 'equippedItems'>,
  itemId: string,
): string | null {
  for (const [slot, id] of Object.entries(build.equippedItems)) {
    if (id === itemId) return slot;
  }
  return null;
}
