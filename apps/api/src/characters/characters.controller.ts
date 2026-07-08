import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { BuildState, CharacterState, CollectResult, PrestigeStatus } from '@idle/shared';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/jwt.strategy';
import { CharactersService } from './characters.service';
import { CreateCharacterBodyDto } from './dto/create-character.dto';
import { TravelBodyDto } from './dto/travel.dto';

@UseGuards(JwtAuthGuard)
@Controller('characters')
export class CharactersController {
  constructor(private readonly characters: CharactersService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.characters.listForUser(user.id);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateCharacterBodyDto) {
    return this.characters.create(user.id, dto.classId, dto.nickname);
  }

  @Get(':id')
  getState(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.characters.getState(id, user.id);
  }

  @Get(':id/build')
  getBuild(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<BuildState> {
    return this.characters.getBuild(id, user.id);
  }

  @Post(':id/collect')
  collect(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<CollectResult> {
    return this.characters.collect(id, user.id);
  }

  @Post(':id/zone')
  travel(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TravelBodyDto,
  ): Promise<CharacterState> {
    return this.characters.travelToZone(id, user.id, dto.zoneId);
  }

  @Get(':id/prestige')
  getPrestigeStatus(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PrestigeStatus> {
    return this.characters.getPrestigeStatus(id, user.id);
  }

  @Post(':id/prestige')
  prestige(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<CharacterState> {
    return this.characters.prestige(id, user.id);
  }
}
