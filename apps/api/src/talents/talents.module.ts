import { Module } from '@nestjs/common';
import { TalentsService } from './talents.service';
import { TalentsController } from './talents.controller';

@Module({
  providers: [TalentsService],
  controllers: [TalentsController],
})
export class TalentsModule {}
