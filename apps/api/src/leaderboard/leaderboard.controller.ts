import { Controller, Get, Query } from '@nestjs/common';
import { LeaderboardEntry } from '@idle/shared';
import { LeaderboardService } from './leaderboard.service';

/** Público (sem auth), igual ao catálogo — é um ranking global de leitura. */
@Controller('leaderboard')
export class LeaderboardController {
  constructor(private readonly leaderboard: LeaderboardService) {}

  @Get()
  getTop(@Query('limit') limit?: string): Promise<LeaderboardEntry[]> {
    const parsed = limit ? parseInt(limit, 10) : NaN;
    const n = Number.isFinite(parsed) ? Math.min(200, Math.max(1, parsed)) : 50;
    return this.leaderboard.getTop(n);
  }
}
