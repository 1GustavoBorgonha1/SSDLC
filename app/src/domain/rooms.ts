/** Salas — FR-2, FR-3, FR-4. */
import { randomUUID } from 'node:crypto';
import type { Db } from '../infra/db.ts';
import { AppError } from '../http/errors.ts';
import type { Room } from './types.ts';

type RoomRow = {
  id: string;
  code: string;
  name: string;
  capacity: number;
  building: string;
  active: number;
  created_at: string;
};

const SELECT_ROOM = 'SELECT id, code, name, capacity, building, active, created_at FROM rooms';

function mapRoom(row: RoomRow): Room {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    capacity: row.capacity,
    building: row.building,
    active: row.active === 1,
    createdAt: row.created_at,
  };
}

/** FR-2 — listagem com filtro opcional de capacidade e de salas ativas. */
export function listRooms(db: Db, filter: { minCapacity?: number; activeOnly: boolean }): Room[] {
  const conditions: string[] = [];
  const params: (string | number)[] = [];
  if (filter.activeOnly) {
    conditions.push('active = 1');
  }
  if (filter.minCapacity !== undefined) {
    conditions.push('capacity >= ?');
    params.push(filter.minCapacity);
  }
  const where = conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '';
  const rows = db.prepare(`${SELECT_ROOM}${where} ORDER BY code ASC`).all(...params) as RoomRow[];
  return rows.map(mapRoom);
}

export function findRoomById(db: Db, id: string): Room | null {
  const row = db.prepare(`${SELECT_ROOM} WHERE id = ?`).get(id) as RoomRow | undefined;
  return row ? mapRoom(row) : null;
}

export function findRoomByCode(db: Db, code: string): Room | null {
  const row = db.prepare(`${SELECT_ROOM} WHERE code = ?`).get(code) as RoomRow | undefined;
  return row ? mapRoom(row) : null;
}

/** FR-3 — criação de sala (somente ADMIN, verificado na rota). */
export function createRoom(
  db: Db,
  input: { code: string; name: string; capacity: number; building: string },
): Room {
  if (findRoomByCode(db, input.code) !== null) {
    throw new AppError('DUPLICATE_CODE', `Já existe uma sala com o código ${input.code}.`);
  }
  const room: Room = {
    id: randomUUID(),
    code: input.code,
    name: input.name.trim(),
    capacity: input.capacity,
    building: input.building.trim(),
    active: true,
    createdAt: new Date().toISOString(),
  };
  db.prepare(
    'INSERT INTO rooms (id, code, name, capacity, building, active, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)',
  ).run(room.id, room.code, room.name, room.capacity, room.building, room.createdAt);
  return room;
}

/** FR-4 — desativação idempotente; reservas existentes permanecem (BR-7). */
export function deactivateRoom(db: Db, id: string): Room {
  const room = findRoomById(db, id);
  if (room === null) {
    throw new AppError('NOT_FOUND', 'Sala não encontrada.');
  }
  db.prepare('UPDATE rooms SET active = 0 WHERE id = ?').run(id);
  return { ...room, active: false };
}
