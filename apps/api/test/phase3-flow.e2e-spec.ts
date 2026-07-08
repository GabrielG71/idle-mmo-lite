import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { WsAdapter } from '@nestjs/platform-ws';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { ClassId, ZoneId } from '@idle/shared';

/**
 * Fluxo Fase 3: prestígio desbloqueado por conteúdo (derrotar o Peakbound
 * Wyrm), reset de nível/XP preservando itens/talentos/gold, bônus permanente
 * de combat_power.
 * Requer Postgres up + migrations aplicadas (pnpm db:up && pnpm migration:run).
 */
describe('Phase 3 flow (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let token: string;
  let characterId: string;

  const email = `phase3_${Date.now()}@test.dev`;
  const password = 'supersecret123';

  async function timeWarpAndCollect() {
    await dataSource.query(
      `UPDATE characters SET last_collected_at = now() - interval '24 hours' WHERE id = $1`,
      [characterId],
    );
    return request(app.getHttpServer())
      .post(`/characters/${characterId}/collect`)
      .set('Authorization', `Bearer ${token}`)
      .expect(201);
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useWebSocketAdapter(new WsAdapter(app));
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
    dataSource = app.get(DataSource);

    const registerRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password })
      .expect(201);
    token = registerRes.body.accessToken;

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

  it('starts locked with tier 0', async () => {
    const res = await request(app.getHttpServer())
      .get(`/characters/${characterId}/prestige`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.unlocked).toBe(false);
    expect(res.body.currentTier).toBe(0);
  });

  it('blocks prestige before the required boss is defeated', async () => {
    await request(app.getHttpServer())
      .post(`/characters/${characterId}/prestige`)
      .set('Authorization', `Bearer ${token}`)
      .expect(400);
  });

  it('reaches power well past the Shattered Peaks gate (150) via a level set + settle', async () => {
    // combat_power é sempre RE-derivado de level+bônus em qualquer ação de
    // settle (nunca aceito do cliente) — setamos o nível direto no banco,
    // igual ao time-warp de last_collected_at já usado nos outros specs, e
    // deixamos um collect recomputar o snapshot a partir dele.
    await dataSource.query(`UPDATE characters SET level = 80, xp = 0 WHERE id = $1`, [
      characterId,
    ]);
    const res = await timeWarpAndCollect();
    expect(res.body.character.combatPower).toBeGreaterThanOrEqual(150);
  });

  it('travels to Shattered Peaks and defeats Peakbound Wyrm', async () => {
    await request(app.getHttpServer())
      .post(`/characters/${characterId}/zone`)
      .set('Authorization', `Bearer ${token}`)
      .send({ zoneId: ZoneId.ShatteredPeaks })
      .expect(201);

    const res = await request(app.getHttpServer())
      .post(`/characters/${characterId}/bosses/3/kill`) // boss 3 = Peakbound Wyrm
      .set('Authorization', `Bearer ${token}`)
      .expect(201);
    expect(res.body.droppedItems).toHaveLength(2); // lootTemplateIds: [14, 15]
  });

  it('unlocks prestige once the boss has been defeated', async () => {
    const res = await request(app.getHttpServer())
      .get(`/characters/${characterId}/prestige`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.unlocked).toBe(true);
  });

  it('prestiges: resets level/xp, keeps items/talents/gold/zone, boosts combat_power', async () => {
    const before = await request(app.getHttpServer())
      .get(`/characters/${characterId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const itemsBefore = await request(app.getHttpServer())
      .get(`/characters/${characterId}/items`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const res = await request(app.getHttpServer())
      .post(`/characters/${characterId}/prestige`)
      .set('Authorization', `Bearer ${token}`)
      .expect(201);

    expect(res.body.level).toBe(1);
    expect(res.body.xp).toBe(0);
    expect(res.body.prestigeTier).toBe(1);
    expect(res.body.currentZoneId).toBe(ZoneId.ShatteredPeaks); // zona não reseta
    expect(res.body.gold).toBeGreaterThanOrEqual(before.body.gold); // gold preservado
    // Warrior lvl1 sem prestígio = 9; com +10%/+10% de prestígio deve ser maior.
    expect(res.body.combatPower).toBeGreaterThan(9);

    const itemsAfter = await request(app.getHttpServer())
      .get(`/characters/${characterId}/items`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(itemsAfter.body).toHaveLength(itemsBefore.body.length); // itens preservados
  });

  it('reflects the new tier and does not reset the boss cooldown', async () => {
    const prestige = await request(app.getHttpServer())
      .get(`/characters/${characterId}/prestige`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(prestige.body.currentTier).toBe(1);
    expect(prestige.body.currentBonusPct).toBe(10);
    expect(prestige.body.nextBonusPct).toBe(20);

    const bosses = await request(app.getHttpServer())
      .get(`/characters/${characterId}/bosses`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const wyrm = bosses.body.find((b: { bossId: number }) => b.bossId === 3);
    expect(wyrm.onCooldownUntil).not.toBeNull();
  });
});
