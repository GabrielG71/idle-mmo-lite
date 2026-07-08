import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { Character } from './character.entity';

/** Carrega personagem p/ leitura (sem lock), verificando posse. */
export async function loadOwnedCharacter(
  manager: EntityManager,
  id: string,
  userId: string,
): Promise<Character> {
  const character = await manager.getRepository(Character).findOne({
    where: { id },
    relations: { class: true, currentZone: true },
  });
  if (!character) throw new NotFoundException('Character not found');
  if (character.userId !== userId) throw new ForbiddenException();
  return character;
}

/**
 * Carrega personagem com `pessimistic_write` p/ mutações (collect, equip,
 * talentos). Serializa concorrência via a mesma row lock (§6.3).
 */
export async function loadOwnedCharacterForUpdate(
  manager: EntityManager,
  id: string,
  userId: string,
): Promise<Character> {
  const character = await manager
    .getRepository(Character)
    .createQueryBuilder('c')
    .setLock('pessimistic_write')
    .where('c.id = :id', { id })
    .getOne();
  if (!character) throw new NotFoundException('Character not found');
  if (character.userId !== userId) throw new ForbiddenException();
  return character;
}
