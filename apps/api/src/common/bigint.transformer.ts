import { ValueTransformer } from 'typeorm';

/**
 * Converte colunas bigint (retornadas como string pelo driver pg) em number.
 * v0: valores ficam bem abaixo de 2^53, seguro. Revisar se ganhos escalarem.
 */
export const bigintTransformer: ValueTransformer = {
  to: (value?: number | null): number | null | undefined => value,
  from: (value?: string | null): number | null | undefined =>
    value === null || value === undefined ? value : Number(value),
};
