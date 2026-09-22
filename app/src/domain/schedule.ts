/**
 * Validação temporal das reservas — SPEC-003, regras BR-1 a BR-5.
 * ADR-003: o horário de funcionamento é avaliado em America/Sao_Paulo via
 * Intl, independentemente do fuso do host (o contêiner roda em UTC).
 */
import { AppError } from '../http/errors.ts';

export const MIN_DURATION_MINUTES = 30;
export const MAX_DURATION_MINUTES = 240;
export const PAST_TOLERANCE_MINUTES = 5;
export const MAX_ADVANCE_DAYS = 90;
export const OPENING_MINUTE = 7 * 60; // 07:00
export const CLOSING_MINUTE = 22 * 60; // 22:00
export const CAMPUS_TIME_ZONE = 'America/Sao_Paulo';
export const SLOT_MINUTES = 30;

const MINUTE_MS = 60_000;

const campusFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: CAMPUS_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

type CampusTime = { date: string; minuteOfDay: number };

/** Converte um instante para data e minuto-do-dia no fuso do campus. */
export function toCampusTime(instant: Date): CampusTime {
  const parts = campusFormatter.formatToParts(instant);
  const pick = (type: string): string => parts.find((p) => p.type === type)?.value ?? '00';
  const hour = Number.parseInt(pick('hour'), 10) % 24;
  const minute = Number.parseInt(pick('minute'), 10);
  return {
    date: `${pick('year')}-${pick('month')}-${pick('day')}`,
    minuteOfDay: hour * 60 + minute,
  };
}

const ISO_WITH_OFFSET = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/;

/** Aceita apenas ISO-8601 com deslocamento explícito e instante real. */
export function parseInstant(raw: string, field: string): Date {
  if (!ISO_WITH_OFFSET.test(raw)) {
    throw new AppError('VALIDATION_ERROR', 'Data/hora inválida.', [
      `${field}: use ISO-8601 com fuso explícito (ex.: 2026-10-01T13:00:00Z)`,
    ]);
  }
  const value = new Date(raw);
  if (Number.isNaN(value.getTime())) {
    throw new AppError('VALIDATION_ERROR', 'Data/hora inválida.', [`${field}: não é ISO-8601 válido`]);
  }
  return value;
}

export type Window = { startsAt: Date; endsAt: Date };

/**
 * Aplica BR-1 a BR-5. Acumula todas as violações antes de falhar, para que o
 * cliente corrija tudo de uma vez (SPEC-002 §1, campo `details`).
 */
export function validateWindow(startsAtRaw: string, endsAtRaw: string, now: Date = new Date()): Window {
  const startsAt = parseInstant(startsAtRaw, 'startsAt');
  const endsAt = parseInstant(endsAtRaw, 'endsAt');
  const details: string[] = [];

  // BR-1 — intervalo válido
  if (endsAt.getTime() <= startsAt.getTime()) {
    details.push('BR-1: endsAt deve ser maior que startsAt');
    throw new AppError('VALIDATION_ERROR', 'Intervalo de reserva inválido.', details);
  }

  // BR-2 — duração mínima e máxima
  const durationMinutes = (endsAt.getTime() - startsAt.getTime()) / MINUTE_MS;
  if (durationMinutes < MIN_DURATION_MINUTES) {
    details.push(`BR-2: duração mínima de ${MIN_DURATION_MINUTES} minutos`);
  }
  if (durationMinutes > MAX_DURATION_MINUTES) {
    details.push(`BR-2: duração máxima de ${MAX_DURATION_MINUTES} minutos`);
  }

  // BR-3 — não reservar no passado
  if (startsAt.getTime() < now.getTime() - PAST_TOLERANCE_MINUTES * MINUTE_MS) {
    details.push('BR-3: startsAt não pode estar no passado');
  }

  // BR-4 — janela de antecedência
  const advanceDays = (startsAt.getTime() - now.getTime()) / (24 * 60 * MINUTE_MS);
  if (advanceDays > MAX_ADVANCE_DAYS) {
    details.push(`BR-4: antecedência máxima de ${MAX_ADVANCE_DAYS} dias`);
  }

  // BR-5 — alinhamento em blocos de 30 minutos
  for (const [field, value] of [['startsAt', startsAt], ['endsAt', endsAt]] as const) {
    if (value.getUTCSeconds() !== 0 || value.getUTCMilliseconds() !== 0 || value.getUTCMinutes() % SLOT_MINUTES !== 0) {
      details.push(`BR-5: ${field} deve cair em blocos de ${SLOT_MINUTES} minutos (:00 ou :30)`);
    }
  }

  // BR-5 — horário de funcionamento no fuso do campus
  const startLocal = toCampusTime(startsAt);
  const endLocal = toCampusTime(endsAt);
  if (startLocal.date !== endLocal.date) {
    details.push('BR-5: a reserva deve começar e terminar no mesmo dia do campus');
  }
  if (startLocal.minuteOfDay < OPENING_MINUTE) {
    details.push('BR-5: o campus abre às 07:00');
  }
  if (endLocal.minuteOfDay > CLOSING_MINUTE) {
    details.push('BR-5: o campus fecha às 22:00');
  }

  if (details.length > 0) {
    throw new AppError('VALIDATION_ERROR', 'Intervalo de reserva inválido.', details);
  }
  return { startsAt, endsAt };
}

/** Limites UTC de um dia civil `YYYY-MM-DD` — usado por FR-7 e FR-9. */
export function utcDayBounds(date: string): { from: string; to: string } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new AppError('VALIDATION_ERROR', 'Parâmetro de data inválido.', ['date: use YYYY-MM-DD']);
  }
  return { from: `${date}T00:00:00.000Z`, to: `${date}T23:59:59.999Z` };
}
