import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CollectResult } from '@idle/shared';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/jwt.strategy';
import { CharactersService } from './characters.service';
import { CreateCharacterBodyDto } from './dto/create-character.dto';

@UseGuards(JwtAuthGuard)
@Controller('characters')
export class CharactersController {
  constructor(private readonly characters: CharactersService) {}

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateCharacterBodyDto) {
    return this.characters.create(user.id, dto.classId);
  }

  @Get(':id')
  getState(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.characters.getState(id, user.id);
  }

  @Post(':id/collect')
  collect(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<CollectResult> {
    return this.characters.collect(id, user.id);
  }
}
