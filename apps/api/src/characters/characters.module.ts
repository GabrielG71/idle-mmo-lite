import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Character } from './character.entity';
import { CharacterBuild } from './character-build.entity';
import { CharacterClass } from '../classes/class.entity';
import { Zone } from '../zones/zone.entity';
import { CharactersService } from './characters.service';
import { CharactersController } from './characters.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Character, CharacterBuild, CharacterClass, Zone]),
  ],
  providers: [CharactersService],
  controllers: [CharactersController],
})
export class CharactersModule {}
