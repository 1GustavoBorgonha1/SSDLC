/**
 * Configuração da aplicação.
 * Implementa NFR-S3 (nenhum segredo no código; o processo se recusa a iniciar
 * com um JWT_SECRET fraco) e AC-18.
 */

export const EXAMPLE_SECRET = 'troque-este-valor-por-um-segredo-de-32-ou-mais-caracteres';

export type AppConfig = {
  readonly port: number;
  readonly host: string;
  readonly databaseFile: string;
  readonly jwtSecret: string;
  readonly jwtTtlSeconds: number;
  readonly corsOrigin: string;
  readonly version: string;
  readonly logLevel: string;
};

export class ConfigError extends Error {}

function readInt(raw: string | undefined, fallback: number, name: string): number {
  if (raw === undefined || raw === '') return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new ConfigError(`${name} deve ser um inteiro positivo, recebido: ${raw}`);
  }
  return parsed;
}

/** NFR-S3: valida o segredo de assinatura do JWT antes de qualquer requisição. */
export function assertStrongSecret(secret: string | undefined): string {
  if (secret === undefined || secret.trim() === '') {
    throw new ConfigError('JWT_SECRET não definido. Defina-o no ambiente (veja .env.example).');
  }
  if (secret.length < 32) {
    throw new ConfigError('JWT_SECRET deve ter no mínimo 32 caracteres.');
  }
  if (secret === EXAMPLE_SECRET) {
    throw new ConfigError('JWT_SECRET ainda é o valor de exemplo. Gere um segredo real.');
  }
  return secret;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const corsOrigin = env.CORS_ORIGIN ?? 'http://localhost:3000';
  if (env.NODE_ENV === 'production' && corsOrigin === '*') {
    // NFR-S8
    throw new ConfigError('CORS_ORIGIN="*" é proibido em produção.');
  }

  return {
    port: readInt(env.PORT, 3000, 'PORT'),
    host: env.HOST ?? '0.0.0.0',
    databaseFile: env.DATABASE_FILE ?? './data/salafacil.db',
    jwtSecret: assertStrongSecret(env.JWT_SECRET),
    jwtTtlSeconds: readInt(env.JWT_TTL_SECONDS, 8 * 60 * 60, 'JWT_TTL_SECONDS'),
    corsOrigin,
    version: env.APP_VERSION ?? 'dev',
    logLevel: env.LOG_LEVEL ?? 'info',
  };
}
