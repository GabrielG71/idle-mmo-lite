import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { WsAdapter } from '@nestjs/platform-ws';
import { WebSocket } from 'ws';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { ClassId } from '@idle/shared';

/**
 * Fluxo Fase 4: ticker do PiP via WebSocket. O gateway é puro transporte —
 * reaproveita `CharactersService.getState` já testado pela REST — então este
 * spec só verifica auth (token/posse) e o shape do primeiro tick recebido.
 * Requer Postgres up + migrations aplicadas (pnpm db:up && pnpm migration:run).
 */
describe('Phase 4 flow (e2e)', () => {
  let app: INestApplication;
  let token: string;
  let otherToken: string;
  let characterId: string;
  let wsBase: string;

  const email = `phase4_${Date.now()}@test.dev`;
  const password = 'supersecret123';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    app.useWebSocketAdapter(new WsAdapter(app));
    await app.listen(0);
    const address = app.getHttpServer().address();
    wsBase = `ws://127.0.0.1:${address.port}/ws/characters`;

    const registerRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password })
      .expect(201);
    token = registerRes.body.accessToken;

    const otherRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: `phase4_other_${Date.now()}@test.dev`, password })
      .expect(201);
    otherToken = otherRes.body.accessToken;

    const createRes = await request(app.getHttpServer())
      .post('/characters')
      .set('Authorization', `Bearer ${token}`)
      .send({ classId: ClassId.Warrior })
      .expect(201);
    characterId = createRes.body.id;
  });

  afterAll(async () => {
    await app?.close();
  });

  function connect(query: string) {
    const ws = new WebSocket(`${wsBase}?${query}`);
    const closed = new Promise<void>((resolve) => ws.once('close', () => resolve()));
    const firstMessage = new Promise<Record<string, unknown>>((resolve, reject) => {
      ws.once('message', (data) => resolve(JSON.parse(data.toString())));
      ws.once('close', () => reject(new Error('socket closed before any message')));
    });
    // evita unhandled rejection nos testes que só esperam `closed`, sem usar firstMessage
    firstMessage.catch(() => {});
    return { ws, closed, firstMessage };
  }

  it('rejects connections without token/characterId', async () => {
    const { closed } = connect('');
    await closed;
  });

  it("rejects connections with another user's token (ownership)", async () => {
    const { closed } = connect(`token=${otherToken}&characterId=${characterId}`);
    await closed;
  });

  it('rejects connections for a nonexistent character', async () => {
    const { closed } = connect(`token=${token}&characterId=00000000-0000-0000-0000-000000000000`);
    await closed;
  });

  it('streams live character state matching GET /characters/:id', async () => {
    const { ws, firstMessage } = connect(`token=${token}&characterId=${characterId}`);
    const tick = await firstMessage;

    expect(tick.id).toBe(characterId);
    expect(tick.combatPower).toBeGreaterThan(0);
    expect(tick.pending).toBeDefined();

    const restState = await request(app.getHttpServer())
      .get(`/characters/${characterId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(tick.level).toBe(restState.body.level);
    expect(tick.combatPower).toBe(restState.body.combatPower);

    ws.close();
  }, 10000);
});
