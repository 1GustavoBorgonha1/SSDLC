/** AC-21 / INV-1 — duas reservas concorrentes na mesma janela. */
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { bearer, campusSlot, createTestContext, type TestContext } from './helpers.ts';

describe('concorrência', () => {
  let ctx: TestContext;

  before(async () => {
    ctx = await createTestContext();
  });
  after(async () => {
    await ctx.close();
  });

  it('AC-21 / INV-1: apenas uma de duas requisições simultâneas é aceita', async () => {
    const payload = {
      roomId: ctx.rooms['LAB-101'].id,
      purpose: 'Reunião do colegiado',
      startsAt: campusSlot(1, '10:00'),
      endsAt: campusSlot(1, '12:00'),
    };

    const [first, second] = await Promise.all([
      ctx.app.inject({
        method: 'POST',
        url: '/api/reservations',
        headers: bearer(ctx.tokenFor(ctx.professor)),
        payload,
      }),
      ctx.app.inject({
        method: 'POST',
        url: '/api/reservations',
        headers: bearer(ctx.tokenFor(ctx.otherProfessor)),
        payload,
      }),
    ]);

    const statuses = [first.statusCode, second.statusCode].sort((a, b) => a - b);
    assert.deepEqual(statuses, [201, 409]);

    const stored = await ctx.app.inject({
      method: 'GET',
      url: `/api/reservations?roomId=${ctx.rooms['LAB-101'].id}`,
      headers: bearer(ctx.tokenFor(ctx.admin)),
    });
    assert.equal(stored.json().data.length, 1);
  });
});
