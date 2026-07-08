import 'reflect-metadata';
import { config as loadEnv } from 'dotenv';
import { join } from 'path';
import { DataSource, DataSourceOptions } from 'typeorm';
import { User } from '../users/user.entity';
import { CharacterClass } from '../classes/class.entity';
import { Zone } from '../zones/zone.entity';
import { Character } from '../characters/character.entity';
import { CharacterBuild } from '../characters/character-build.entity';
import { Item } from '../items/item.entity';
import { ZoneBossCooldown } from '../characters/zone-boss-cooldown.entity';
import { WorldBossReward } from '../world-boss/world-boss-reward.entity';

// Carrega .env da raiz do repo p/ o CLI de migrations.
loadEnv({ path: join(__dirname, '../../../../.env') });
loadEnv(); // fallback: .env local do apps/api

export const entities = [
  User,
  CharacterClass,
  Zone,
  Character,
  CharacterBuild,
  Item,
  ZoneBossCooldown,
  WorldBossReward,
];

export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USER ?? 'idle',
  password: process.env.DB_PASSWORD ?? 'idle',
  database: process.env.DB_NAME ?? 'idle_mmo',
  entities,
  migrations: [join(__dirname, '../migrations/*.{ts,js}')],
  synchronize: false,
  logging: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : false,
};

// Usado pelo CLI do TypeORM (migration:run/generate/revert).
export default new DataSource(dataSourceOptions);
