/** Rotas de salas — FR-2, FR-3, FR-4, FR-9 (SPEC-002 §3). */
import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import type { Db } from '../../infra/db.ts';
import type { AppConfig } from '../../config.ts';
import { createRoom, deactivateRoom, listRooms } from '../../domain/rooms.ts';
import { getAvailability } from '../../domain/reservations.ts';
import { requireAdmin, requireAuth } from '../auth.ts';
import { validate } from '../validate.ts';

const listQuerySchema = z.object({
  minCapacity: z.coerce.number().int().min(1).max(500).optional(),
  activeOnly: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value !== 'false'),
});

// SPEC-001 §1.2 — code segue `^[A-Z]{1,4}-[0-9]{1,4}$`.
const createRoomSchema = z.object({
  code: z.string().trim().regex(/^[A-Z]{1,4}-\d{1,4}$/, 'formato esperado: LAB-101'),
  name: z.string().trim().min(1).max(120),
  capacity: z.number().int().min(1).max(500),
  building: z.string().trim().min(1).max(80),
});

const idParamSchema = z.object({ id: z.string().uuid() });
const availabilityQuerySchema = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) });

export function registerRoomRoutes(app: FastifyInstance, db: Db, config: AppConfig): void {
  const auth = { preHandler: requireAuth(config.jwtSecret) };
  const adminOnly = { preHandler: [requireAuth(config.jwtSecret), requireAdmin] };

  // FR-2
  app.get('/api/rooms', auth, async (request, reply) => {
    const query = validate(listQuerySchema, request.query ?? {});
    return reply.code(200).send({ data: listRooms(db, query) });
  });

  // FR-3
  app.post('/api/rooms', adminOnly, async (request, reply) => {
    const body = validate(createRoomSchema, request.body);
    return reply.code(201).send(createRoom(db, body));
  });

  // FR-4
  app.patch('/api/rooms/:id/deactivate', adminOnly, async (request, reply) => {
    const { id } = validate(idParamSchema, request.params);
    return reply.code(200).send(deactivateRoom(db, id));
  });

  // FR-9
  app.get('/api/rooms/:id/availability', auth, async (request, reply) => {
    const { id } = validate(idParamSchema, request.params);
    const { date } = validate(availabilityQuerySchema, request.query ?? {});
    return reply.code(200).send({ roomId: id, date, busy: getAvailability(db, id, date) });
  });
}
