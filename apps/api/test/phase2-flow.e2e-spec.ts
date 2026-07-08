import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { WsAdapter } from '@nestjs/platform-ws';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { ClassId, ZoneId } from '@idle/shared';

/**
 * Fluxo Fase 2: gate de power pra viajar entre zonas, boss atrelado à zona
 * certa, cooldown por personagem, loot exclusivo.
 * Requer Postgres up + migrations aplicadas (pnpm db:up && pnpm migration:run).
 */
describe('Phase 2 flow (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let token: string;
  let characterId: string;

  const email = `phase2_${Date.now()}@test.dev`;
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
    expect(createRes.body.combatPower).toBe(9); // Warrior lvl1: round(8*1.12)
  });

  afterAll(async () => {
    await app?.close();
  });

  it('blocks travel to a zone above the character power gate', async () => {
    await request(app.getHttpServer())
      .post(`/characters/${characterId}/zone`)
      .set('Authorization', `Bearer ${token}`)
      .send({ zoneId: ZoneId.AshenRidge })
      .expect(400);
  });

  it('rejects travel to a nonexistent zone', async () => {
    await request(app.getHttpServer())
      .post(`/characters/${characterId}/zone`)
      .set('Authorization', `Bearer ${token}`)
      .send({ zoneId: 999 })
      .expect(400);
  });

  it("lists Greenwood's boss as in-current-zone, others as not", async () => {
    const res = await request(app.getHttpServer())
      .get(`/characters/${characterId}/bosses`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body).toHaveLength(3);
    const greenwoodBoss = res.body.find((b: { zoneId: number }) => b.zoneId === ZoneId.Greenwood);
    const ashenBoss = res.body.find((b: { zoneId: number }) => b.zoneId === ZoneId.AshenRidge);
    expect(greenwoodBoss.inCurrentZone).toBe(true);
    expect(ashenBoss.inCurrentZone).toBe(false);
  });

  it('blocks another user from reading this character boss status (ownership)', async () => {
    const other = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: `other_${Date.now()}@test.dev`, password })
      .expect(201);
    await request(app.getHttpServer())
      .get(`/characters/${characterId}/bosses`)
      .set('Authorization', `Bearer ${other.body.accessToken}`)
      .expect(403);
  });

  it('grinds enough power (2 capped offline collects) to clear the Ashen Ridge gate', async () => {
    const first = await timeWarpAndCollect();
    const second = await timeWarpAndCollect();
    // cada rodada composta pelo power da anterior — a segunda já deve estourar
    // bem o gate de Ashen Ridge (40) e o power mínimo do boss de lá (60).
    expect(second.body.character.combatPower).toBeGreaterThan(first.body.character.combatPower);
    expect(second.body.character.combatPower).toBeGreaterThanOrEqual(60);
  });

  it('travels to Ashen Ridge once power is sufficient', async () => {
    const res = await request(app.getHttpServer())
      .post(`/characters/${characterId}/zone`)
      .set('Authorization', `Bearer ${token}`)
      .send({ zoneId: ZoneId.AshenRidge })
      .expect(201);
    expect(res.body.currentZoneId).toBe(ZoneId.AshenRidge);
  });

  it('blocks challenging a boss from the wrong zone', async () => {
    await request(app.getHttpServer())
      .post(`/characters/${characterId}/bosses/1/kill`) // boss 1 = Greenwood
      .set('Authorization', `Bearer ${token}`)
      .expect(400);
  });

  it('kills the current-zone boss for exclusive loot and cooldown', async () => {
    const res = await request(app.getHttpServer())
      .post(`/characters/${characterId}/bosses/2/kill`) // boss 2 = Cinder Warden (Ashen Ridge)
      .set('Authorization', `Bearer ${token}`)
      .expect(201);

    expect(res.body.xpAwarded).toBe(2500);
    expect(res.body.goldAwarded).toBe(1000);
    expect(res.body.droppedItems).toHaveLength(2); // lootTemplateIds: [12, 13]
    for (const item of res.body.droppedItems) {
      expect(item.rarity).toBeGreaterThanOrEqual(3); // piso Rare
    }
  });

  it('rejects re-challenging the same boss while on cooldown', async () => {
    await request(app.getHttpServer())
      .post(`/characters/${characterId}/bosses/2/kill`)
      .set('Authorization', `Bearer ${token}`)
      .expect(400);
  });

  it('allows re-challenging once the cooldown window has passed', async () => {
    await dataSource.query(
      `UPDATE zone_boss_cooldowns SET last_kill_at = now() - interval '9 hours' WHERE character_id = $1 AND boss_id = 2`,
      [characterId],
    );
    const res = await request(app.getHttpServer())
      .post(`/characters/${characterId}/bosses/2/kill`)
      .set('Authorization', `Bearer ${token}`)
      .expect(201);
    expect(res.body.droppedItems).toHaveLength(2);
  });
});
