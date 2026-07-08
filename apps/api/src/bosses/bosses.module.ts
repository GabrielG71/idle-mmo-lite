import { Module } from '@nestjs/common';
import { BossesService } from './bosses.service';
import { BossesController } from './bosses.controller';

@Module({
  providers: [BossesService],
  controllers: [BossesController],
})
export class BossesModule {}
