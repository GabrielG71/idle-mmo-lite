import { Body, Controller, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/jwt.strategy';
import { TalentsService } from './talents.service';
import { AllocateTalentsBodyDto } from './dto/allocate-talents.dto';

@UseGuards(JwtAuthGuard)
@Controller('characters/:characterId/talents')
export class TalentsController {
  constructor(private readonly talents: TalentsService) {}

  @Post()
  allocate(
    @CurrentUser() user: AuthUser,
    @Param('characterId', ParseUUIDPipe) characterId: string,
    @Body() dto: AllocateTalentsBodyDto,
  ) {
    return this.talents.allocate(characterId, user.id, dto.talents);
  }

  @Post('respec')
  respec(
    @CurrentUser() user: AuthUser,
    @Param('characterId', ParseUUIDPipe) characterId: string,
  ) {
    return this.talents.respec(characterId, user.id);
  }
}
