import { IsObject } from 'class-validator';

/**
 * Estado-alvo ABSOLUTO dos talentos (não é um delta). Talentos omitidos são
 * tratados como 0 pontos. Validação profunda (ids válidos, maxPoints, budget,
 * apenas aditivo) acontece no service — class-validator só garante o shape.
 */
export class AllocateTalentsBodyDto {
  @IsObject()
  talents!: Record<string, number>;
}
