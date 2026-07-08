import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { BuildState, CharacterState, getItemTemplate, ItemState } from '@idle/shared';
import { Item } from './item.entity';
import { equippedSlotOf, loadEquippedItems } from './equipped-items';
import { toItemState } from './items.mapper';
import { CharacterBuild } from '../characters/character-build.entity';
import { CharacterClass } from '../classes/class.entity';
import { Zone } from '../zones/zone.entity';
import { loadOwnedCharacter, loadOwnedCharacterForUpdate } from '../characters/character-access';
import { settleAndResnapshot } from '../characters/settle-progress';
import { aggregateBuildBonuses } from '../game/build';
import { toBuildState, toCharacterState } from '../characters/characters.mapper';

export interface EquipResult {
  character: CharacterState;
  build: BuildState;
}

@Injectable()
export class ItemsService {
  constructor(private readonly dataSource: DataSource) {}

  async list(characterId: string, userId: string): Promise<ItemState[]> {
    const manager = this.dataSource.manager;
    await loadOwnedCharacter(manager, characterId, userId);
    const build = await manager
      .getRepository(CharacterBuild)
      .findOneOrFail({ where: { characterId } });

    const items = await manager
      .getRepository(Item)
      .find({ where: { characterId }, order: { createdAt: 'DESC' } });
    return items.map((item) => toItemState(item, equippedSlotOf(build, item.id)));
  }

  async equip(characterId: string, userId: string, itemId: string): Promise<EquipResult> {
    return this.dataSource.transaction(async (manager) => {
      const character = await loadOwnedCharacterForUpdate(manager, characterId, userId);

      const item = await manager
        .getRepository(Item)
        .findOne({ where: { id: itemId, characterId: character.id } });
      if (!item) throw new NotFoundException('Item not found');
      const template = getItemTemplate(item.templateId);
      if (!template) throw new BadRequestException('Unknown item template');

      const build = await manager
        .getRepository(CharacterBuild)
        .findOneOrFail({ where: { characterId: character.id } });
      const zone = await manager
        .getRepository(Zone)
        .findOneOrFail({ where: { id: character.currentZoneId } });
      const cls = await manager
        .getRepository(CharacterClass)
        .findOneOrFail({ where: { id: character.classId } });

      const oldEquipped = await loadEquippedItems(manager, build);
      const oldBonuses = aggregateBuildBonuses(oldEquipped, build.talents);

      build.equippedItems = { ...build.equippedItems, [template.slot]: item.id };

      const newEquipped = await loadEquippedItems(manager, build);
      const newBonuses = aggregateBuildBonuses(newEquipped, build.talents);

      settleAndResnapshot(character, { now: new Date(), cls, zone, oldBonuses, newBonuses });

      await manager.save(character);
      await manager.save(build);

      return { character: toCharacterState(character), build: toBuildState(build, character.level) };
    });
  }

  async unequip(characterId: string, userId: string, itemId: string): Promise<EquipResult> {
    return this.dataSource.transaction(async (manager) => {
      const character = await loadOwnedCharacterForUpdate(manager, characterId, userId);

      const build = await manager
        .getRepository(CharacterBuild)
        .findOneOrFail({ where: { characterId: character.id } });
      const slot = equippedSlotOf(build, itemId);
      if (!slot) throw new BadRequestException('Item is not equipped');

      const zone = await manager
        .getRepository(Zone)
        .findOneOrFail({ where: { id: character.currentZoneId } });
      const cls = await manager
        .getRepository(CharacterClass)
        .findOneOrFail({ where: { id: character.classId } });

      const oldEquipped = await loadEquippedItems(manager, build);
      const oldBonuses = aggregateBuildBonuses(oldEquipped, build.talents);

      const rest = { ...build.equippedItems };
      delete rest[slot];
      build.equippedItems = rest;

      const newEquipped = await loadEquippedItems(manager, build);
      const newBonuses = aggregateBuildBonuses(newEquipped, build.talents);

      settleAndResnapshot(character, { now: new Date(), cls, zone, oldBonuses, newBonuses });

      await manager.save(character);
      await manager.save(build);

      return { character: toCharacterState(character), build: toBuildState(build, character.level) };
    });
  }
}
