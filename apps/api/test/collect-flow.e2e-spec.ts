import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { WsAdapter } from '@nestjs/platform-ws';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { ClassId } from '@idle/shared';

/**
 * Fluxo Fase 0: register -> login -> create -> collect.
 * Requer Postgres up + migrations aplicadas (pnpm db:up && pnpm migration:run).
 */
describe('Collect flow (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let token: string;
  let characterId: string;

  const email = `e2e_${Date.now()}@test.dev`;
  const password = 'supersecret123';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useWebSocketAdapter(new WsAdapter(app));
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
    dataSource = app.get(DataSource);
  });

  afterAll(async () => {
    await app?.close();
  });

  it('registers a new user', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password })
      .expect(201);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.user.email).toBe(email);
  });

  it('rejects duplicate email', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password })
      .expect(409);
  });

  it('logs in and returns a token', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(201);
    token = res.body.accessToken;
    expect(token).toBeDefined();
  });

  it('rejects /me without token', async () => {
    await request(app.getHttpServer()).get('/me').expect(401);
  });

  it('creates a Mage character with server-computed power', async () => {
    const res = await request(app.getHttpServer())
      .post('/characters')
      .set('Authorization', `Bearer ${token}`)
      .send({ classId: ClassId.Mage })
      .expect(201);
    characterId = res.body.id;
    expect(res.body.level).toBe(1);
    expect(res.body.combatPower).toBe(15); // Mage lvl1 = 15 (ver game.spec)
    expect(res.body.gold).toBe(0);
  });

  it('immediate collect yields ~0 (nothing elapsed)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/characters/${characterId}/collect`)
      .set('Authorization', `Bearer ${token}`)
      .expect(201);
    expect(res.body.collectedXp).toBe(0);
    expect(res.body.collectedGold).toBe(0);
  });

  it('collects deterministic reward after simulated 1h offline', async () => {
    // Fast-forward: recua last_collected_at em 3600s.
    await dataSource.query(
      `UPDATE characters SET last_collected_at = now() - interval '3600 seconds' WHERE id = $1`,
      [characterId],
    );

    const res = await request(app.getHttpServer())
      .post(`/characters/${characterId}/collect`)
      .set('Authorization', `Bearer ${token}`)
      .expect(201);

    // power 15 * xpRate 0.05 * 3600 = 2700 xp ; gold 15 * 0.02 * 3600 = 1080
    expect(res.body.collectedXp).toBe(2700);
    expect(res.body.collectedGold).toBe(1080);
    expect(res.body.leveledUp).toBe(true);
    expect(res.body.levelAfter).toBeGreaterThan(1);
    expect(res.body.character.gold).toBe(1080);
  });

  it('second immediate collect is idempotent (~0)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/characters/${characterId}/collect`)
      .set('Authorization', `Bearer ${token}`)
      .expect(201);
    expect(res.body.collectedXp).toBe(0);
    expect(res.body.collectedGold).toBe(0);
  });

  it('caps reward at zone offline cap (8h) even after long absence', async () => {
    // Recua 24h; cap Greenwood = 8h => reward limitado a 8h.
    await dataSource.query(
      `UPDATE characters SET last_collected_at = now() - interval '24 hours' WHERE id = $1`,
      [characterId],
    );
    const res = await request(app.getHttpServer())
      .post(`/characters/${characterId}/collect`)
      .set('Authorization', `Bearer ${token}`)
      .expect(201);
    expect(res.body.capReached).toBe(true);
    expect(res.body.cappedElapsedSeconds).toBe(28800);
  });

  it('blocks collecting another user character (ownership)', async () => {
    // outro usuário
    const other = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: `other_${Date.now()}@test.dev`, password })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/characters/${characterId}/collect`)
      .set('Authorization', `Bearer ${other.body.accessToken}`)
      .expect(403);
  });
});
