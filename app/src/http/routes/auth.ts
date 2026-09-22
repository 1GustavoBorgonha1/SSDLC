/** Rotas de autenticação — FR-1 (SPEC-002 §2). */
import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import type { Db } from '../../infra/db.ts';
import type { AppConfig } from '../../config.ts';
import { authenticate, findUserById, toPublicUser } from '../../domain/users.ts';
import { AppError } from '../errors.ts';
import { currentUser, requireAuth, signToken } from '../auth.ts';
import { validate } from '../validate.ts';

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(160),
  password: z.string().min(1).max(200),
});

export function registerAuthRoutes(app: FastifyInstance, db: Db, config: AppConfig): void {
  // FR-1 — login. NFR-S4: falha sempre com o mesmo corpo e código.
  app.post('/api/auth/login', { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } }, async (request, reply) => {
    const body = validate(loginSchema, request.body);
    const user = authenticate(db, body.email, body.password);
    if (user === null) {
      throw new AppError('INVALID_CREDENTIALS', 'E-mail ou senha inválidos.');
    }
    const token = signToken(user, config.jwtSecret, config.jwtTtlSeconds);
    // INV-4 / AC-3: `toPublicUser` remove o hash.
    return reply.code(200).send({ token, user: toPublicUser(user) });
  });

  app.get('/api/auth/me', { preHandler: requireAuth(config.jwtSecret) }, async (request, reply) => {
    const actor = currentUser(request);
    const user = findUserById(db, actor.id);
    if (user === null) {
      throw new AppError('NOT_FOUND', 'Usuário não encontrado.');
    }
    return reply.code(200).send(toPublicUser(user));
  });
}
