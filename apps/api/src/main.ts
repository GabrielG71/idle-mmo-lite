import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.enableCors();

  const config = app.get(ConfigService);
  const port = config.get<number>('API_PORT', 3000);
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`API up on http://localhost:${port}`);
}

void bootstrap();
