import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { join } from 'path';
import { validateEnv } from './config/env.validation';
import { entities } from './config/data-source';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { CharactersModule } from './characters/characters.module';
import { CatalogModule } from './catalog/catalog.module';
import { ItemsModule } from './items/items.module';
import { TalentsModule } from './talents/talents.module';
import { BossesModule } from './bosses/bosses.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
      envFilePath: [
        join(__dirname, '../../../.env'), // raiz do monorepo
        '.env',
      ],
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.getOrThrow<string>('DB_HOST'),
        port: config.getOrThrow<number>('DB_PORT'),
        username: config.getOrThrow<string>('DB_USER'),
        password: config.getOrThrow<string>('DB_PASSWORD'),
        database: config.getOrThrow<string>('DB_NAME'),
        entities,
        synchronize: false,
        autoLoadEntities: false,
      }),
    }),
    AuthModule,
    UsersModule,
    CharactersModule,
    CatalogModule,
    ItemsModule,
    TalentsModule,
    BossesModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
