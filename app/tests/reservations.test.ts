/**
 * AC-6 a AC-9, AC-11 a AC-16 e AC-19.
 * Cobre FR-5, FR-6, FR-7, FR-8, FR-9 e as regras BR-6, BR-7, BR-8, BR-9, BR-10,
 * além de INV-3 e NFR-S2.
 */
import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { bearer, campusSlot, createTestContext, utcDateOf, type TestContext } from './helpers.ts';

describe('reservas', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await createTestContext();
  });
  afterEach(async () => {
    await ctx.close();
  });

  const book = (
    roomId: string,
    startsAt: string,
    endsAt: string,
    token: string = ctx.tokenFor(ctx.professor),
    extra: Record<string, unknown> = {},
  ) =>
    ctx.app.inject({
      method: 'POST',
      url: '/api/reservations',
      headers: bearer(token),
      payload: { roomId, purpose: 'Aula de Cálculo I', startsAt, endsAt, ...extra },
    });

  it('AC-6 / BR-6: sobreposição na mesma sala é recusada', async () => {
    const first = await book(ctx.rooms['LAB-101'].id, campusSlot(1, '13:00'), campusSlot(1, '15:00'));
    assert.equal(first.statusCode, 201);

    const overlapping = await book(ctx.rooms['LAB-101'].id, campusSlot(1, '14:00'), campusSlot(1, '16:00'));
    assert.equal(overlapping.statusCode, 409);
    assert.equal(overlapping.json().error.code, 'ROOM_UNAVAILABLE');

    const list = await ctx.app.inject({
      method: 'GET',
      url: '/api/reservations',
      headers: bearer(ctx.tokenFor(ctx.professor)),
    });
    assert.equal(list.json().data.length, 1);
  });

  it('AC-7 / BR-6: intervalos encostados coexistem', async () => {
    await book(ctx.rooms['LAB-101'].id, campusSlot(1, '13:00'), campusSlot(1, '15:00'));
    const adjacent = await book(ctx.rooms['LAB-101'].id, campusSlot(1, '15:00'), campusSlot(1, '16:00'));
    assert.equal(adjacent.statusCode, 201);
  });

  it('AC-8 / BR-6: o conflito é por sala', async () => {
    await book(ctx.rooms['LAB-101'].id, campusSlot(1, '13:00'), campusSlot(1, '15:00'));
    const otherRoom = await book(ctx.rooms['AUD-1'].id, campusSlot(1, '13:00'), campusSlot(1, '15:00'));
    assert.equal(otherRoom.statusCode, 201);
  });

  it('AC-9 / BR-9: cancelar libera a janela', async () => {
    const created = await book(ctx.rooms['LAB-101'].id, campusSlot(1, '13:00'), campusSlot(1, '15:00'));
    const id = created.json().id;

    const cancelled = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/reservations/${id}/cancel`,
      headers: bearer(ctx.tokenFor(ctx.professor)),
    });
    assert.equal(cancelled.statusCode, 200);
    assert.equal(cancelled.json().status, 'CANCELLED');

    const again = await book(ctx.rooms['LAB-101'].id, campusSlot(1, '13:00'), campusSlot(1, '15:00'));
    assert.equal(again.statusCode, 201);
  });

  it('AC-11 / BR-7: sala desativada recusa nova reserva sem afetar as existentes', async () => {
    const existing = await book(ctx.rooms['LAB-101'].id, campusSlot(1, '13:00'), campusSlot(1, '15:00'));
    assert.equal(existing.statusCode, 201);

    const deactivated = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/rooms/${ctx.rooms['LAB-101'].id}/deactivate`,
      headers: bearer(ctx.tokenFor(ctx.admin)),
    });
    assert.equal(deactivated.statusCode, 200);
    assert.equal(deactivated.json().active, false);

    const blocked = await book(ctx.rooms['LAB-101'].id, campusSlot(2, '13:00'), campusSlot(2, '15:00'));
    assert.equal(blocked.statusCode, 409);
    assert.equal(blocked.json().error.code, 'ROOM_INACTIVE');

    const list = await ctx.app.inject({
      method: 'GET',
      url: `/api/reservations?roomId=${ctx.rooms['LAB-101'].id}`,
      headers: bearer(ctx.tokenFor(ctx.professor)),
    });
    assert.equal(list.json().data[0].status, 'ACTIVE');
  });

  it('AC-12 / BR-8 / NFR-S2: userId do corpo é ignorado', async () => {
    const created = await book(
      ctx.rooms['LAB-101'].id,
      campusSlot(1, '13:00'),
      campusSlot(1, '15:00'),
      ctx.tokenFor(ctx.professor),
      { userId: ctx.otherProfessor.id },
    );

    assert.equal(created.statusCode, 201);
    assert.equal(created.json().userId, ctx.professor.id);
  });

  it('AC-13 / BR-9: terceiro não cancela, admin cancela', async () => {
    const created = await book(ctx.rooms['LAB-101'].id, campusSlot(1, '13:00'), campusSlot(1, '15:00'));
    const id = created.json().id;

    const byOther = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/reservations/${id}/cancel`,
      headers: bearer(ctx.tokenFor(ctx.otherProfessor)),
    });
    assert.equal(byOther.statusCode, 403);

    const byAdmin = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/reservations/${id}/cancel`,
      headers: bearer(ctx.tokenFor(ctx.admin)),
    });
    assert.equal(byAdmin.statusCode, 200);
  });

  it('AC-14 / INV-3: recancelar devolve 409', async () => {
    const created = await book(ctx.rooms['LAB-101'].id, campusSlot(1, '13:00'), campusSlot(1, '15:00'));
    const url = `/api/reservations/${created.json().id}/cancel`;
    const headers = bearer(ctx.tokenFor(ctx.professor));

    await ctx.app.inject({ method: 'PATCH', url, headers });
    const second = await ctx.app.inject({ method: 'PATCH', url, headers });

    assert.equal(second.statusCode, 409);
    assert.equal(second.json().error.code, 'ALREADY_CANCELLED');
  });

  it('AC-15 / FR-7: filtra por sala e por dia, ordenado por início', async () => {
    const day = campusSlot(1, '13:00');
    await book(ctx.rooms['LAB-101'].id, campusSlot(1, '16:00'), campusSlot(1, '17:00'));
    await book(ctx.rooms['LAB-101'].id, day, campusSlot(1, '15:00'));
    await book(ctx.rooms['AUD-1'].id, campusSlot(1, '13:00'), campusSlot(1, '15:00'));

    const response = await ctx.app.inject({
      method: 'GET',
      url: `/api/reservations?roomId=${ctx.rooms['LAB-101'].id}&date=${utcDateOf(day)}`,
      headers: bearer(ctx.tokenFor(ctx.professor)),
    });

    const data = response.json().data as { startsAt: string; room: { code: string } }[];
    assert.equal(data.length, 2);
    assert.ok(data.every((item) => item.room.code === 'LAB-101'));
    assert.ok(data[0]!.startsAt < data[1]!.startsAt);
  });

  it('AC-16 / FR-9: disponibilidade ignora reservas canceladas', async () => {
    const start = campusSlot(1, '13:00');
    const created = await book(ctx.rooms['LAB-101'].id, start, campusSlot(1, '15:00'));
    const url = `/api/rooms/${ctx.rooms['LAB-101'].id}/availability?date=${utcDateOf(start)}`;
    const headers = bearer(ctx.tokenFor(ctx.professor));

    const busyBefore = await ctx.app.inject({ method: 'GET', url, headers });
    assert.equal(busyBefore.json().busy.length, 1);
    assert.equal(busyBefore.json().busy[0].reservationId, created.json().id);

    await ctx.app.inject({
      method: 'PATCH',
      url: `/api/reservations/${created.json().id}/cancel`,
      headers,
    });

    const busyAfter = await ctx.app.inject({ method: 'GET', url, headers });
    assert.equal(busyAfter.json().busy.length, 0);
  });

  it('FR-5: sala inexistente devolve 404', async () => {
    const response = await book(
      '11111111-1111-4111-8111-111111111111',
      campusSlot(1, '13:00'),
      campusSlot(1, '15:00'),
    );
    assert.equal(response.statusCode, 404);
  });

  it('AC-19 / BR-10: a 11ª reserva futura ativa é recusada', async () => {
    for (let day = 1; day <= 10; day += 1) {
      const response = await book(ctx.rooms['LAB-101'].id, campusSlot(day, '08:00'), campusSlot(day, '08:30'));
      assert.equal(response.statusCode, 201, `reserva ${day} deveria ser aceita`);
    }

    const eleventh = await book(ctx.rooms['LAB-101'].id, campusSlot(11, '08:00'), campusSlot(11, '08:30'));
    assert.equal(eleventh.statusCode, 409);
    assert.equal(eleventh.json().error.code, 'QUOTA_EXCEEDED');
  });
});
