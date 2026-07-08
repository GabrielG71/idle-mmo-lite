import { Controller, Get } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CharacterClass } from '../classes/class.entity';
import { Zone } from '../zones/zone.entity';

/** Catálogo público (sem auth) p/ telas de criação de personagem / seleção de zona. */
@Controller()
export class CatalogController {
  constructor(
    @InjectRepository(CharacterClass)
    private readonly classes: Repository<CharacterClass>,
    @InjectRepository(Zone)
    private readonly zones: Repository<Zone>,
  ) {}

  @Get('classes')
  listClasses(): Promise<CharacterClass[]> {
    return this.classes.find({ order: { id: 'ASC' } });
  }

  @Get('zones')
  listZones(): Promise<Zone[]> {
    return this.zones.find({ order: { id: 'ASC' } });
  }
}
