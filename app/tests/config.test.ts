/** AC-18 — NFR-S3: segredo fraco impede a inicialização. */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ConfigError, EXAMPLE_SECRET, assertStrongSecret, loadConfig } from '../src/config.ts';
import { TEST_SECRET } from './helpers.ts';

const base = { JWT_SECRET: TEST_SECRET } as NodeJS.ProcessEnv;

describe('configuração', () => {
  it('AC-18 / NFR-S3: JWT_SECRET ausente impede a inicialização', () => {
    assert.throws(() => loadConfig({} as NodeJS.ProcessEnv), ConfigError);
  });

  it('AC-18 / NFR-S3: JWT_SECRET curto impede a inicialização', () => {
    assert.throws(() => assertStrongSecret('curto-demais'), ConfigError);
  });

  it('AC-18 / NFR-S3: o segredo de exemplo é recusado', () => {
    assert.throws(() => assertStrongSecret(EXAMPLE_SECRET), ConfigError);
  });

  it('NFR-S8: CORS_ORIGIN="*" é recusado em produção', () => {
    assert.throws(
      () => loadConfig({ ...base, NODE_ENV: 'production', CORS_ORIGIN: '*' } as NodeJS.ProcessEnv),
      ConfigError,
    );
  });

  it('aplica os valores padrão documentados', () => {
    const config = loadConfig(base);

    assert.equal(config.port, 3000);
    assert.equal(config.host, '0.0.0.0');
    assert.equal(config.jwtTtlSeconds, 8 * 60 * 60);
    assert.equal(config.databaseFile, './data/salafacil.db');
  });

  it('recusa PORT não numérica', () => {
    assert.throws(() => loadConfig({ ...base, PORT: 'oitenta' } as NodeJS.ProcessEnv), ConfigError);
  });
});
