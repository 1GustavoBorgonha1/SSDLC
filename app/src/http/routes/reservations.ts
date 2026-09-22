/** Rotas de reservas — FR-5, FR-6, FR-7, FR-8 (SPEC-002 §4). */
import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import type { Db } from '../../infra/db.ts';
import type { AppConfig } from '../../config.ts';
import { cancelReservation, createReservation, listReservations } from '../../domain/reservations.ts';
import { currentUser, requireAuth } from '../auth.ts';
import { validate } from '../validate.ts';

/**
 * BR-8 / NFR-S2: o schema não declara `userId`; zod descarta chaves extras,
 * então um `userId` enviado pelo cliente jamais chega ao domínio.
 */
const createSchema = z.object({
  roomId: z.string().uuid(),
  purpose: z.string().trim().min(3).max(200),
  startsAt: z.string().min(1),
  endsAt: z.string().min(1),
});

const listQuerySchema = z.object({
  roomId: z.string().uuid().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  mine: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true'),
  status: z.enum(['ACTIVE', 'CANCELLED', 'ALL']).optional().default('ACTIVE'),
});

const idParamSchema = z.object({ id: z.string().uuid() });

export function registerReservationRoutes(app: FastifyInstance, db: Db, config: AppConfig): void {
  const auth = { preHandler: requireAuth(config.jwtSecret) };

  // FR-5 / FR-6
  app.post('/api/reservations', auth, async (request, reply) => {
    const body = validate(createSchema, request.body);
    const actor = currentUser(request);
    const reservation = createReservation(db, { ...body, userId: actor.id });
    return reply.code(201).send(reservation);
  });

  // FR-7
  app.get('/api/reservations', auth, async (request, reply) => {
    const query = validate(listQuerySchema, request.query ?? {});
    const actor = currentUser(request);
    const data = listReservations(db, {
      roomId: query.roomId,
      date: query.date,
      status: query.status,
      userId: query.mine ? actor.id : undefined,
    });
    return reply.code(200).send({ data });
  });

  // FR-8 / BR-9
  app.patch('/api/reservations/:id/cancel', auth, async (request, reply) => {
    const { id } = validate(idParamSchema, request.params);
    const actor = currentUser(request);
    return reply.code(200).send(cancelReservation(db, id, actor));
  });
}
