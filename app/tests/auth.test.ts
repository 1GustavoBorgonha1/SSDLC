/** AC-1, AC-2, AC-3, AC-20 — FR-1, NFR-S1, NFR-S4, NFR-S10, INV-4. */
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { bearer, createTestContext, TEST_PASSWORD, type TestContext } from './helpers.ts';

describe('autenticação', () => {
  let ctx: TestContext;

  before(async () => {
    ctx = await createTestContext();
  });
  after(async () => {
    await ctx.close();
  });

  it('AC-1: login válido devolve token e usuário sem hash', async () => {
    const response = await ctx.app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'professor@uni.edu', password: TEST_PASSWORD },
    });

    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.ok(typeof body.token === 'string' && body.token.length > 20);
    assert.equal(body.user.email, 'professor@uni.edu');
    assert.equal(body.user.role, 'PROFESSOR');
    assert.equal(body.user.passwordHash, undefined);
  });

  it('AC-2 / NFR-S4: senha errada e e-mail inexistente produzem a mesma resposta', async () => {
    const wrongPassword = await ctx.app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'professor@uni.edu', password: 'senha-errada' },
    });
    const unknownEmail = await ctx.app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'ninguem@uni.edu', password: TEST_PASSWORD },
    });

    assert.equal(wrongPassword.statusCode, 401);
    assert.equal(unknownEmail.statusCode, 401);
    assert.equal(wrongPassword.json().error.code, 'INVALID_CREDENTIALS');
    assert.deepEqual(wrongPassword.json(), unknownEmail.json());
  });

  it('AC-3 / INV-4: nenhuma resposta de usuário carrega o hash da senha', async () => {
    const response = await ctx.app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: bearer(ctx.tokenFor(ctx.admin)),
    });

    assert.equal(response.statusCode, 200);
    assert.doesNotMatch(response.body, /passwordHash|password_hash|\$2[aby]\$/);
  });

  it('AC-20 / NFR-S10: token ausente ou adulterado devolve 401 sem stack', async () => {
    const semToken = await ctx.app.inject({ method: 'GET', url: '/api/auth/me' });
    const adulterado = await ctx.app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: bearer(`${ctx.tokenFor(ctx.professor)}xyz`),
    });

    assert.equal(semToken.statusCode, 401);
    assert.equal(adulterado.statusCode, 401);
    assert.equal(adulterado.json().error.code, 'UNAUTHORIZED');
    assert.doesNotMatch(adulterado.body, /at .*\.ts:|stack/i);
  });
});
