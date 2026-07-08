import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { WsAdapter } from '@nestjs/platform-ws';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { ClassId, getItemTemplate } from '@idle/shared';

/**
 * Fluxo Fase 1: equipar item, alocar talentos, respec, loot no collect.
 * Requer Postgres up + migrations aplicadas (pnpm db:up && pnpm migration:run).
 */
describe('Phase 1 flow (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let token: string;
  let characterId: string;

  const email = `phase1_${Date.now()}@test.dev`;
  const password = 'supersecret123';

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

  it('collect after 8h (capped) drops exactly 16 items (deterministic floor)', async () => {
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
    // floor(28800 / 1800) = 16 = MAX_DROPS_PER_COLLECT — sem margem pro roll fracionário
    expect(res.body.droppedItems).toHaveLength(16);
    // gold = floor(9 * 0.02 * 28800) = 5184 — precisamos disso pro respec adiante
    expect(res.body.character.gold).toBe(5184);
  });

  it('lists the dropped inventory', async () => {
    const res = await request(app.getHttpServer())
      .get(`/characters/${characterId}/items`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body).toHaveLength(16);
  });

  it('blocks another user from reading this inventory (ownership)', async () => {
    const other = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: `other_${Date.now()}@test.dev`, password })
      .expect(201);
    await request(app.getHttpServer())
      .get(`/characters/${characterId}/items`)
      .set('Authorization', `Bearer ${other.body.accessToken}`)
      .expect(403);
  });

  let itemId: string;
  let slot: string;
  let powerBeforeEquip: number;

  it('equips a dropped item and re-snapshots combat_power', async () => {
    const items = await request(app.getHttpServer())
      .get(`/characters/${characterId}/items`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    itemId = items.body[0].id;
    const template = getItemTemplate(items.body[0].templateId)!;
    slot = template.slot;

    const before = await request(app.getHttpServer())
      .get(`/characters/${characterId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    powerBeforeEquip = before.body.combatPower;

    const res = await request(app.getHttpServer())
      .post(`/characters/${characterId}/items/${itemId}/equip`)
      .set('Authorization', `Bearer ${token}`)
      .expect(201);

    expect(res.body.build.equippedItems[slot]).toBe(itemId);
    expect(res.body.character.combatPower).toBeGreaterThanOrEqual(powerBeforeEquip);
  });

  it('marks the item as equipped in the inventory listing', async () => {
    const res = await request(app.getHttpServer())
      .get(`/characters/${characterId}/items`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const equipped = res.body.find((i: { id: string }) => i.id === itemId);
    expect(equipped.equippedSlot).toBe(slot);
  });

  it('unequips the item and re-snapshots combat_power back down', async () => {
    const res = await request(app.getHttpServer())
      .post(`/characters/${characterId}/items/${itemId}/unequip`)
      .set('Authorization', `Bearer ${token}`)
      .expect(201);

    expect(res.body.build.equippedItems[slot]).toBeUndefined();
    expect(res.body.character.combatPower).toBeLessThanOrEqual(powerBeforeEquip + 1);
  });

  it('rejects allocating talents beyond maxPoints', async () => {
    await request(app.getHttpServer())
      .post(`/characters/${characterId}/talents`)
      .set('Authorization', `Bearer ${token}`)
      .send({ talents: { war_weapon_mastery: 11 } }) // maxPoints = 10
      .expect(400);
  });

  it('rejects allocating an unknown talent id', async () => {
    await request(app.getHttpServer())
      .post(`/characters/${characterId}/talents`)
      .set('Authorization', `Bearer ${token}`)
      .send({ talents: { not_a_real_talent: 1 } })
      .expect(400);
  });

  it('allocates a valid talent point', async () => {
    const res = await request(app.getHttpServer())
      .post(`/characters/${characterId}/talents`)
      .set('Authorization', `Bearer ${token}`)
      .send({ talents: { war_weapon_mastery: 1 } })
      .expect(201);
    expect(res.body.build.talents.war_weapon_mastery).toBe(1);
    expect(res.body.build.talentPointsSpent).toBe(1);
  });

  it('rejects reducing an allocated talent without respec', async () => {
    await request(app.getHttpServer())
      .post(`/characters/${characterId}/talents`)
      .set('Authorization', `Bearer ${token}`)
      .send({ talents: {} }) // omitir = 0, reduziria war_weapon_mastery
      .expect(400);
  });

  it('respec resets talents and charges escalating gold cost', async () => {
    const before = await request(app.getHttpServer())
      .get(`/characters/${characterId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const goldBefore = before.body.gold;

    const res = await request(app.getHttpServer())
      .post(`/characters/${characterId}/talents/respec`)
      .set('Authorization', `Bearer ${token}`)
      .expect(201);

    expect(res.body.build.talents).toEqual({});
    expect(res.body.build.respecCount).toBe(1);
    expect(res.body.build.respecCost).toBe(200); // RESPEC_BASE_COST(100) * 2^1
    expect(res.body.character.gold).toBe(goldBefore - 100); // custo cobrado foi o de respecCount=0
  });
});
