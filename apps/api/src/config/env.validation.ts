import { plainToInstance } from 'class-transformer';
import { IsIn, IsInt, IsString, validateSync } from 'class-validator';

class EnvVars {
  @IsIn(['development', 'test', 'production'])
  NODE_ENV: string = 'development';

  @IsInt()
  API_PORT: number = 3000;

  @IsString()
  DB_HOST!: string;

  @IsInt()
  DB_PORT!: number;

  @IsString()
  DB_USER!: string;

  @IsString()
  DB_PASSWORD!: string;

  @IsString()
  DB_NAME!: string;

  @IsString()
  REDIS_HOST: string = 'localhost';

  @IsInt()
  REDIS_PORT: number = 6379;

  @IsString()
  JWT_SECRET!: string;

  @IsString()
  JWT_EXPIRES_IN: string = '7d';
}

/** Coage e valida env no boot — falha rápido se faltar config. */
export function validateEnv(config: Record<string, unknown>): EnvVars {
  const numeric = ['API_PORT', 'DB_PORT', 'REDIS_PORT'];
  const coerced: Record<string, unknown> = { ...config };
  for (const key of numeric) {
    if (coerced[key] !== undefined) coerced[key] = Number(coerced[key]);
  }

  const validated = plainToInstance(EnvVars, coerced, {
    enableImplicitConversion: false,
  });
  const errors = validateSync(validated, { skipMissingProperties: false });
  if (errors.length > 0) {
    throw new Error(`Invalid environment:\n${errors.toString()}`);
  }
  return validated;
}
