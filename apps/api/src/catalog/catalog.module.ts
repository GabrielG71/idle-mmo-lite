import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CharacterClass } from '../classes/class.entity';
import { Zone } from '../zones/zone.entity';
import { CatalogController } from './catalog.controller';

@Module({
  imports: [TypeOrmModule.forFeature([CharacterClass, Zone])],
  controllers: [CatalogController],
})
export class CatalogModule {}
