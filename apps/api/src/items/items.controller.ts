import { Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/jwt.strategy';
import { ItemsService } from './items.service';

@UseGuards(JwtAuthGuard)
@Controller('characters/:characterId/items')
export class ItemsController {
  constructor(private readonly items: ItemsService) {}

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Param('characterId', ParseUUIDPipe) characterId: string,
  ) {
    return this.items.list(characterId, user.id);
  }

  @Post(':itemId/equip')
  equip(
    @CurrentUser() user: AuthUser,
    @Param('characterId', ParseUUIDPipe) characterId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
  ) {
    return this.items.equip(characterId, user.id, itemId);
  }

  @Post(':itemId/unequip')
  unequip(
    @CurrentUser() user: AuthUser,
    @Param('characterId', ParseUUIDPipe) characterId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
  ) {
    return this.items.unequip(characterId, user.id, itemId);
  }
}
