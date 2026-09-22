/**
 * Montagem do servidor HTTP.
 * NFR-S5 (rate limit), NFR-S7 (helmet), NFR-S8 (CORS), NFR-S9 (bodyLimit),
 * NFR-S10 (erros sem stack), FR-10 (/health).
 */
import Fastify, { type FastifyInstance } from 'fastify';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import { fileURLToPath } from 'node:url';
import type { AppConfig } from '../config.ts';
import { isHealthy, type Db } from '../infra/db.ts';
import { AppError, errorBody } from './errors.ts';
import { registerAuthRoutes } from './routes/auth.ts';
import { registerRoomRoutes } from './routes/rooms.ts';
import { registerReservationRoutes } from './routes/reservations.ts';

export const BODY_LIMIT_BYTES = 64 * 1024; // NFR-S9
const PUBLIC_DIR = fileURLToPath(new URL('../../public/', import.meta.url));

export async function buildServer(db: Db, config: AppConfig): Promise<FastifyInstance> {
  const app = Fastify({
    logger: { level: config.logLevel }, // NFR-4: log estruturado JSON
    bodyLimit: BODY_LIMIT_BYTES,
    trustProxy: true,
    disableRequestLogging: config.logLevel === 'silent',
  });

  // NFR-S7 — cabeçalhos de segurança. CSP restritiva: a página estática não
  // carrega script de terceiros nem usa inline script.
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
      },
    },
    // A v1 é servida em HTTP puro (SPEC-006 §1, sem TLS na frente). Enviar
    // Strict-Transport-Security sobre HTTP faz o navegador memorizar uma
    // política de "sempre HTTPS" para o host e passar a recusar a própria
    // origem HTTP em visitas seguintes — página em branco sem nenhum erro
    // visível. Reative quando houver TLS (ALB/reverse proxy com certificado).
    hsts: false,
  });

  // NFR-S8 — origem exata, nunca "*" em produção (validado em config.ts).
  await app.register(cors, { origin: config.corsOrigin, credentials: false });

  // NFR-S5 — 100 req/min por IP; o login usa limite próprio de 5/min.
  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
    // O plugin lança o valor retornado; um AppError cai no error handler abaixo.
    errorResponseBuilder: () => new AppError('RATE_LIMITED', 'Muitas requisições. Tente novamente em instantes.'),
  });

  await app.register(fastifyStatic, { root: PUBLIC_DIR, prefix: '/', index: ['index.html'] });

  // NFR-S10 — nenhuma stack trace atravessa a fronteira HTTP.
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      request.log.info({ code: error.code, path: request.url }, 'requisição rejeitada');
      return reply.code(error.statusCode).send(errorBody(error.code, error.message, error.details));
    }
    if ((error as { statusCode?: number }).statusCode === 429) {
      return reply.code(429).send(errorBody('RATE_LIMITED', 'Muitas requisições. Tente novamente em instantes.'));
    }
    if ((error as { statusCode?: number }).statusCode === 400) {
      return reply.code(400).send(errorBody('VALIDATION_ERROR', 'Requisição malformada.'));
    }
    request.log.error({ err: error }, 'erro não tratado');
    return reply.code(500).send(errorBody('INTERNAL_ERROR', 'Erro interno.'));
  });

  app.setNotFoundHandler((request, reply) =>
    reply.code(404).send(errorBody('NOT_FOUND', `Rota não encontrada: ${request.method} ${request.url}`)),
  );

  // FR-10 — readiness check consumido pelo Docker e pelo smoke test do deploy.
  app.get('/health', { config: { rateLimit: false } }, async (_request, reply) => {
    const healthy = isHealthy(db);
    return reply.code(healthy ? 200 : 503).send({
      status: healthy ? 'ok' : 'degraded',
      version: config.version,
      uptimeSeconds: Math.round(process.uptime()),
    });
  });

  registerAuthRoutes(app, db, config);
  registerRoomRoutes(app, db, config);
  registerReservationRoutes(app, db, config);

  return app;
}
