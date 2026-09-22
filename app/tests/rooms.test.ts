/** AC-4, AC-5 — FR-2, FR-3, FR-4 e NFR-S6. */
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { bearer, createTestContext, type TestContext } from './helpers.ts';

describe('salas', () => {
  let ctx: TestContext;

  before(async () => {
    ctx = await createTestContext();
  });
  after(async () => {
    await ctx.close();
  });

  it('AC-4 / FR-2: filtra por capacidade mínima e ordena por código', async () => {
    const response = await ctx.app.inject({
      method: 'GET',
      url: '/api/rooms?minCapacity=40',
      headers: bearer(ctx.tokenFor(ctx.professor)),
    });

    assert.equal(response.statusCode, 200);
    const codes = response.json().data.map((room: { code: string }) => room.code);
    assert.deepEqual(codes, ['AUD-1', 'SL-203']);
  });

  it('AC-5 / FR-3: professor não cria sala', async () => {
    const response = await ctx.app.inject({
      method: 'POST',
      url: '/api/rooms',
      headers: bearer(ctx.tokenFor(ctx.professor)),
      payload: { code: 'LAB-999', name: 'Proibida', capacity: 10, building: 'Bloco C' },
    });

    assert.equal(response.statusCode, 403);
    assert.equal(response.json().error.code, 'FORBIDDEN');
  });

  it('AC-5 / FR-4: professor não desativa sala', async () => {
    const response = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/rooms/${ctx.rooms['LAB-101'].id}/deactivate`,
      headers: bearer(ctx.tokenFor(ctx.professor)),
    });

    assert.equal(response.statusCode, 403);
  });

  it('FR-3: admin cria sala e o código duplicado é recusado', async () => {
    const created = await ctx.app.inject({
      method: 'POST',
      url: '/api/rooms',
      headers: bearer(ctx.tokenFor(ctx.admin)),
      payload: { code: 'LAB-102', name: 'Laboratório 2', capacity: 25, building: 'Bloco A' },
    });
    assert.equal(created.statusCode, 201);
    assert.equal(created.json().active, true);

    const duplicated = await ctx.app.inject({
      method: 'POST',
      url: '/api/rooms',
      headers: bearer(ctx.tokenFor(ctx.admin)),
      payload: { code: 'LAB-102', name: 'Outro nome', capacity: 25, building: 'Bloco A' },
    });
    assert.equal(duplicated.statusCode, 409);
    assert.equal(duplicated.json().error.code, 'DUPLICATE_CODE');
  });

  it('FR-3: código fora do padrão é erro de validação', async () => {
    const response = await ctx.app.inject({
      method: 'POST',
      url: '/api/rooms',
      headers: bearer(ctx.tokenFor(ctx.admin)),
      payload: { code: 'sala 1', name: 'Inválida', capacity: 10, building: 'Bloco A' },
    });

    assert.equal(response.statusCode, 400);
    assert.equal(response.json().error.code, 'VALIDATION_ERROR');
  });

  it('NFR-S6: tentativa de SQL injection no filtro não derruba nem vaza dados', async () => {
    const response = await ctx.app.inject({
      method: 'GET',
      url: `/api/rooms?minCapacity=${encodeURIComponent("1; DROP TABLE rooms;--")}`,
      headers: bearer(ctx.tokenFor(ctx.professor)),
    });

    assert.equal(response.statusCode, 400);
    const stillThere = await ctx.app.inject({
      method: 'GET',
      url: '/api/rooms',
      headers: bearer(ctx.tokenFor(ctx.professor)),
    });
    assert.ok(stillThere.json().data.length >= 3);
  });
});
