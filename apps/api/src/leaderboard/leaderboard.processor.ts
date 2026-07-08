import { Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { LeaderboardService } from './leaderboard.service';

const REFRESH_JOB = 'refresh';
const REFRESH_INTERVAL_MS = 60_000;

/**
 * Reconstrói o leaderboard periodicamente (job repetível) — nunca em tempo
 * real a cada mudança de combat_power, ver LeaderboardService.refresh().
 * Roda uma vez no boot também, pra não ficar vazio logo após subir a API
 * (importante pros testes e2e, que não esperam 60s).
 */
@Processor('leaderboard')
export class LeaderboardProcessor extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(LeaderboardProcessor.name);

  constructor(
    @InjectQueue('leaderboard') private readonly queue: Queue,
    private readonly leaderboard: LeaderboardService,
  ) {
    super();
  }

  async onModuleInit(): Promise<void> {
    await this.leaderboard.refresh().catch((err) => this.logger.error(err));
    await this.queue.add(
      REFRESH_JOB,
      {},
      { repeat: { every: REFRESH_INTERVAL_MS }, jobId: REFRESH_JOB },
    );
  }

  async process(job: Job): Promise<void> {
    if (job.name === REFRESH_JOB) {
      await this.leaderboard.refresh();
    }
  }
}
