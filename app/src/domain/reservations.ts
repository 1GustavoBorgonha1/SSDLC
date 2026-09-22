/**
 * Reservas — FR-5 a FR-9 e regras BR-6, BR-7, BR-9, BR-10.
 * INV-1 (intervalos ativos disjuntos por sala) é garantida aqui.
 */
import { randomUUID } from 'node:crypto';
import { inWriteTransaction, type Db } from '../infra/db.ts';
import { AppError } from '../http/errors.ts';
import { findRoomById } from './rooms.ts';
import { utcDayBounds, validateWindow } from './schedule.ts';
import type { Reservation, ReservationStatus, ReservationView, Role } from './types.ts';

export const MAX_ACTIVE_FUTURE_RESERVATIONS = 10;

type ReservationRow = {
  id: string;
  room_id: string;
  user_id: string;
  purpose: string;
  starts_at: string;
  ends_at: string;
  status: ReservationStatus;
  created_at: string;
};

type ReservationViewRow = ReservationRow & { room_code: string; room_name: string; user_name: string };

function mapReservation(row: ReservationRow): Reservation {
  return {
    id: row.id,
    roomId: row.room_id,
    userId: row.user_id,
    purpose: row.purpose,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    status: row.status,
    createdAt: row.created_at,
  };
}

function mapReservationView(row: ReservationViewRow): ReservationView {
  return {
    ...mapReservation(row),
    room: { code: row.room_code, name: row.room_name },
    user: { name: row.user_name },
  };
}

/**
 * BR-6 — existe reserva ACTIVE sobreposta nesta sala?
 * Intervalos semiabertos: `existente.startsAt < nova.endsAt AND nova.startsAt < existente.endsAt`.
 */
function hasOverlap(db: Db, roomId: string, startsAt: string, endsAt: string): boolean {
  const row = db
    .prepare(
      `SELECT 1 AS conflito FROM reservations
        WHERE room_id = ? AND status = 'ACTIVE' AND starts_at < ? AND ? < ends_at
        LIMIT 1`,
    )
    .get(roomId, endsAt, startsAt) as { conflito: number } | undefined;
  return row !== undefined;
}

/** BR-10 — quantas reservas ativas futuras o usuário já possui. */
function countActiveFuture(db: Db, userId: string, now: string): number {
  const row = db
    .prepare(
      `SELECT COUNT(*) AS total FROM reservations
        WHERE user_id = ? AND status = 'ACTIVE' AND starts_at >= ?`,
    )
    .get(userId, now) as { total: number };
  return Number(row.total);
}

export type CreateReservationInput = {
  roomId: string;
  userId: string;
  purpose: string;
  startsAt: string;
  endsAt: string;
};

/**
 * FR-5 / FR-6 — cria uma reserva.
 * BR-1..BR-5 validam a janela; BR-7 recusa sala inativa; BR-10 aplica a cota;
 * BR-6 + INV-1: a checagem de conflito e o INSERT acontecem na mesma transação
 * `BEGIN IMMEDIATE`, o que serializa requisições concorrentes (AC-21).
 */
export function createReservation(db: Db, input: CreateReservationInput, now: Date = new Date()): Reservation {
  const window = validateWindow(input.startsAt, input.endsAt, now);
  const purpose = input.purpose.trim();
  const startsAt = window.startsAt.toISOString();
  const endsAt = window.endsAt.toISOString();

  return inWriteTransaction(db, () => {
    const room = findRoomById(db, input.roomId);
    if (room === null) {
      throw new AppError('NOT_FOUND', 'Sala não encontrada.');
    }
    if (!room.active) {
      // BR-7
      throw new AppError('ROOM_INACTIVE', `A sala ${room.code} está desativada e não aceita novas reservas.`);
    }
    if (countActiveFuture(db, input.userId, now.toISOString()) >= MAX_ACTIVE_FUTURE_RESERVATIONS) {
      // BR-10
      throw new AppError(
        'QUOTA_EXCEEDED',
        `Limite de ${MAX_ACTIVE_FUTURE_RESERVATIONS} reservas futuras ativas atingido.`,
      );
    }
    if (hasOverlap(db, input.roomId, startsAt, endsAt)) {
      // BR-6
      throw new AppError('ROOM_UNAVAILABLE', 'A sala já está reservada nesse intervalo.');
    }

    const reservation: Reservation = {
      id: randomUUID(),
      roomId: input.roomId,
      userId: input.userId,
      purpose,
      startsAt,
      endsAt,
      status: 'ACTIVE',
      createdAt: now.toISOString(),
    };
    db.prepare(
      `INSERT INTO reservations (id, room_id, user_id, purpose, starts_at, ends_at, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE', ?)`,
    ).run(
      reservation.id,
      reservation.roomId,
      reservation.userId,
      reservation.purpose,
      reservation.startsAt,
      reservation.endsAt,
      reservation.createdAt,
    );
    return reservation;
  });
}

export type ListReservationsFilter = {
  roomId?: string;
  date?: string;
  userId?: string;
  status: ReservationStatus | 'ALL';
};

/** FR-7 — listagem filtrada por sala, dia, autor e situação. */
export function listReservations(db: Db, filter: ListReservationsFilter): ReservationView[] {
  const conditions: string[] = [];
  const params: string[] = [];

  if (filter.status !== 'ALL') {
    conditions.push('r.status = ?');
    params.push(filter.status);
  }
  if (filter.roomId !== undefined) {
    conditions.push('r.room_id = ?');
    params.push(filter.roomId);
  }
  if (filter.userId !== undefined) {
    conditions.push('r.user_id = ?');
    params.push(filter.userId);
  }
  if (filter.date !== undefined) {
    // Uma reserva "toca" o dia se começa antes do fim do dia e termina depois do início.
    const { from, to } = utcDayBounds(filter.date);
    conditions.push('r.starts_at <= ? AND r.ends_at > ?');
    params.push(to, from);
  }

  const where = conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '';
  const rows = db
    .prepare(
      `SELECT r.id, r.room_id, r.user_id, r.purpose, r.starts_at, r.ends_at, r.status, r.created_at,
              ro.code AS room_code, ro.name AS room_name, u.name AS user_name
         FROM reservations r
         JOIN rooms ro ON ro.id = r.room_id
         JOIN users u ON u.id = r.user_id${where}
        ORDER BY r.starts_at ASC`,
    )
    .all(...params) as ReservationViewRow[];
  return rows.map(mapReservationView);
}

export function findReservationById(db: Db, id: string): Reservation | null {
  const row = db
    .prepare(
      `SELECT id, room_id, user_id, purpose, starts_at, ends_at, status, created_at
         FROM reservations WHERE id = ?`,
    )
    .get(id) as ReservationRow | undefined;
  return row ? mapReservation(row) : null;
}

/**
 * FR-8 / BR-9 — cancela uma reserva. Somente o dono ou um ADMIN.
 * INV-3: cancelar duas vezes é conflito, não idempotência.
 */
export function cancelReservation(
  db: Db,
  reservationId: string,
  actor: { id: string; role: Role },
): Reservation {
  return inWriteTransaction(db, () => {
    const reservation = findReservationById(db, reservationId);
    if (reservation === null) {
      throw new AppError('NOT_FOUND', 'Reserva não encontrada.');
    }
    if (actor.role !== 'ADMIN' && reservation.userId !== actor.id) {
      throw new AppError('FORBIDDEN', 'Apenas o autor da reserva ou um administrador pode cancelá-la.');
    }
    if (reservation.status === 'CANCELLED') {
      throw new AppError('ALREADY_CANCELLED', 'Esta reserva já está cancelada.');
    }
    db.prepare("UPDATE reservations SET status = 'CANCELLED' WHERE id = ?").run(reservationId);
    return { ...reservation, status: 'CANCELLED' as const };
  });
}

export type BusyBlock = { startsAt: string; endsAt: string; reservationId: string };

/** FR-9 — blocos ocupados de uma sala em um dia (UTC). */
export function getAvailability(db: Db, roomId: string, date: string): BusyBlock[] {
  if (findRoomById(db, roomId) === null) {
    throw new AppError('NOT_FOUND', 'Sala não encontrada.');
  }
  const { from, to } = utcDayBounds(date);
  const rows = db
    .prepare(
      `SELECT id, starts_at, ends_at FROM reservations
        WHERE room_id = ? AND status = 'ACTIVE' AND starts_at <= ? AND ends_at > ?
        ORDER BY starts_at ASC`,
    )
    .all(roomId, to, from) as { id: string; starts_at: string; ends_at: string }[];
  return rows.map((row) => ({ startsAt: row.starts_at, endsAt: row.ends_at, reservationId: row.id }));
}
