import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/jwt.strategy';
import { BossesService } from './bosses.service';

@UseGuards(JwtAuthGuard)
@Controller('characters/:characterId/bosses')
export class BossesController {
  constructor(private readonly bosses: BossesService) {}

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Param('characterId', ParseUUIDPipe) characterId: string,
  ) {
    return this.bosses.listStatus(characterId, user.id);
  }

  @Post(':bossId/kill')
  kill(
    @CurrentUser() user: AuthUser,
    @Param('characterId', ParseUUIDPipe) characterId: string,
    @Param('bossId', ParseIntPipe) bossId: number,
  ) {
    return this.bosses.kill(characterId, user.id, bossId);
  }
}
