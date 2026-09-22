/** AC-17 — FR-10, e verificação do rate limit (NFR-S5). */
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createTestContext, type TestContext } from './helpers.ts';

describe('operacional', () => {
  let ctx: TestContext;

  before(async () => {
    ctx = await createTestContext();
  });
  after(async () => {
    await ctx.close();
  });

  it('AC-17 / FR-10: /health responde sem autenticação', async () => {
    const response = await ctx.app.inject({ method: 'GET', url: '/health' });

    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.equal(body.status, 'ok');
    assert.equal(body.version, 'test');
    assert.equal(typeof body.uptimeSeconds, 'number');
  });

  it('NFR-S5: o login é limitado a 5 tentativas por minuto', async () => {
    const attempt = () =>
      ctx.app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email: 'professor@uni.edu', password: 'errada' },
        remoteAddress: '203.0.113.7',
      });

    const codes: number[] = [];
    for (let i = 0; i < 6; i += 1) {
      codes.push((await attempt()).statusCode);
    }

    assert.equal(codes.at(-1), 429);
    assert.equal(codes.filter((code) => code === 401).length, 5);
  });

  it('rota inexistente devolve o formato de erro padrão', async () => {
    const response = await ctx.app.inject({ method: 'GET', url: '/api/nao-existe' });

    assert.equal(response.statusCode, 404);
    assert.equal(response.json().error.code, 'NOT_FOUND');
  });

  it('a página estática é servida na raiz', async () => {
    const response = await ctx.app.inject({ method: 'GET', url: '/' });

    assert.equal(response.statusCode, 200);
    assert.match(response.body, /SalaFácil/);
    assert.match(response.headers['content-security-policy'] as string, /default-src 'self'/);
  });
});
