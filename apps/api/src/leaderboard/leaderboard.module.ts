import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { LeaderboardService } from './leaderboard.service';
import { LeaderboardProcessor } from './leaderboard.processor';
import { LeaderboardController } from './leaderboard.controller';

@Module({
  imports: [BullModule.registerQueue({ name: 'leaderboard' })],
  providers: [LeaderboardService, LeaderboardProcessor],
  controllers: [LeaderboardController],
})
export class LeaderboardModule {}
