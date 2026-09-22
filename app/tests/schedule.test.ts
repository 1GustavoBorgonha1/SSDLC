/** AC-10 — BR-1 a BR-5 (SPEC-003), testados na unidade de domínio. */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateWindow, toCampusTime, utcDayBounds } from '../src/domain/schedule.ts';
import { AppError } from '../src/http/errors.ts';

/** Instante fixo para tornar os casos determinísticos: 2026-10-01 09:00 no campus. */
const NOW = new Date('2026-10-01T12:00:00Z');
const campus = (date: string, time: string): string => new Date(`${date}T${time}:00-03:00`).toISOString();

function expectRejection(startsAt: string, endsAt: string, expectedRule: string): void {
  assert.throws(
    () => validateWindow(startsAt, endsAt, NOW),
    (error: unknown) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.code, 'VALIDATION_ERROR');
      assert.ok(
        error.details.some((detail) => detail.startsWith(expectedRule)),
        `esperava violação de ${expectedRule}, veio: ${error.details.join(' | ')}`,
      );
      return true;
    },
  );
}

describe('janela de reserva', () => {
  it('aceita uma janela válida', () => {
    const window = validateWindow(campus('2026-10-01', '13:00'), campus('2026-10-01', '15:00'), NOW);
    assert.equal(window.startsAt.toISOString(), '2026-10-01T16:00:00.000Z');
    assert.equal(window.endsAt.toISOString(), '2026-10-01T18:00:00.000Z');
  });

  it('AC-10 / BR-1: fim antes do início', () => {
    expectRejection(campus('2026-10-01', '15:00'), campus('2026-10-01', '13:00'), 'BR-1');
  });

  it('AC-10 / BR-2: duração menor que 30 minutos', () => {
    expectRejection(campus('2026-10-01', '13:00'), campus('2026-10-01', '13:15'), 'BR-2');
  });

  it('AC-10 / BR-2: duração maior que 4 horas', () => {
    expectRejection(campus('2026-10-01', '13:00'), campus('2026-10-01', '18:30'), 'BR-2');
  });

  it('AC-10 / BR-3: início no passado', () => {
    expectRejection(campus('2026-09-30', '13:00'), campus('2026-09-30', '15:00'), 'BR-3');
  });

  it('AC-10 / BR-4: antecedência maior que 90 dias', () => {
    expectRejection(campus('2027-03-01', '13:00'), campus('2027-03-01', '15:00'), 'BR-4');
  });

  it('AC-10 / BR-5: antes da abertura do campus', () => {
    expectRejection(campus('2026-10-02', '06:00'), campus('2026-10-02', '08:00'), 'BR-5');
  });

  it('AC-10 / BR-5: depois do fechamento do campus', () => {
    expectRejection(campus('2026-10-02', '21:00'), campus('2026-10-02', '23:00'), 'BR-5');
  });

  it('AC-10 / BR-5: fora dos blocos de 30 minutos', () => {
    expectRejection(campus('2026-10-02', '13:07'), campus('2026-10-02', '15:07'), 'BR-5');
  });

  it('BR-5: termina exatamente às 22:00 é aceito', () => {
    assert.doesNotThrow(() => validateWindow(campus('2026-10-02', '20:00'), campus('2026-10-02', '22:00'), NOW));
  });

  it('BR-5: recusa janela que atravessa a meia-noite do campus', () => {
    expectRejection(campus('2026-10-02', '21:30'), '2026-10-03T03:00:00Z', 'BR-5');
  });

  it('recusa data sem fuso explícito', () => {
    assert.throws(() => validateWindow('2026-10-02T13:00:00', campus('2026-10-02', '15:00'), NOW), AppError);
  });

  it('toCampusTime converte UTC para o fuso do campus', () => {
    const { date, minuteOfDay } = toCampusTime(new Date('2026-10-02T02:00:00Z'));
    assert.equal(date, '2026-10-01');
    assert.equal(minuteOfDay, 23 * 60);
  });

  it('utcDayBounds recusa formato inválido', () => {
    assert.throws(() => utcDayBounds('02/10/2026'), AppError);
    assert.deepEqual(utcDayBounds('2026-10-02'), {
      from: '2026-10-02T00:00:00.000Z',
      to: '2026-10-02T23:59:59.999Z',
    });
  });
});
