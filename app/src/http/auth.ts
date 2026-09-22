/**
 * Autenticação e autorização HTTP — SPEC-002 §2.
 * NFR-S2: identidade e papel vêm sempre do JWT verificado, nunca do corpo.
 */
import jwt from 'jsonwebtoken';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { AppError } from './errors.ts';
import type { Role, User } from '../domain/types.ts';

export type AuthUser = { id: string; role: Role };

declare module 'fastify' {
  interface FastifyRequest {
    authUser?: AuthUser;
  }
}

export function signToken(user: User, secret: string, ttlSeconds: number): string {
  return jwt.sign({ role: user.role }, secret, {
    subject: user.id,
    expiresIn: ttlSeconds,
    algorithm: 'HS256',
  });
}

export function verifyToken(token: string, secret: string): AuthUser {
  try {
    const payload = jwt.verify(token, secret, { algorithms: ['HS256'] });
    if (typeof payload === 'string' || typeof payload.sub !== 'string') {
      throw new Error('payload inesperado');
    }
    const role = (payload as { role?: unknown }).role;
    if (role !== 'PROFESSOR' && role !== 'ADMIN') {
      throw new Error('papel inválido');
    }
    return { id: payload.sub, role };
  } catch {
    throw new AppError('UNAUTHORIZED', 'Token ausente, inválido ou expirado.');
  }
}

/** Hook `preHandler` para rotas protegidas. */
export function requireAuth(secret: string) {
  return async function authHook(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
    const header = request.headers.authorization;
    if (typeof header !== 'string' || !header.startsWith('Bearer ')) {
      throw new AppError('UNAUTHORIZED', 'Token ausente, inválido ou expirado.');
    }
    request.authUser = verifyToken(header.slice('Bearer '.length).trim(), secret);
  };
}

/** Hook `preHandler` para rotas exclusivas de ADMIN (FR-3, FR-4). */
export async function requireAdmin(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  if (request.authUser?.role !== 'ADMIN') {
    throw new AppError('FORBIDDEN', 'Operação restrita a administradores.');
  }
}

/** Nunca devolve `undefined`: usada apenas depois de `requireAuth`. */
export function currentUser(request: FastifyRequest): AuthUser {
  if (request.authUser === undefined) {
    throw new AppError('UNAUTHORIZED', 'Token ausente, inválido ou expirado.');
  }
  return request.authUser;
}
