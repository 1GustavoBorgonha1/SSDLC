/** Infraestrutura comum dos testes de aceite (SPEC-005). */
import type { FastifyInstance } from 'fastify';
import { loadConfig, type AppConfig } from '../src/config.ts';
import { openDatabase, type Db } from '../src/infra/db.ts';
import { buildServer } from '../src/http/server.ts';
import { signToken } from '../src/http/auth.ts';
import { createUser } from '../src/domain/users.ts';
import { createRoom } from '../src/domain/rooms.ts';
import type { Role, Room, User } from '../src/domain/types.ts';

export const TEST_SECRET = 'segredo-de-teste-com-mais-de-32-caracteres-ok';
export const TEST_PASSWORD = 'senha-de-teste-123';

export type TestContext = {
  app: FastifyInstance;
  db: Db;
  config: AppConfig;
  admin: User;
  professor: User;
  otherProfessor: User;
  rooms: Record<'LAB-101' | 'AUD-1' | 'SL-203', Room>;
  tokenFor: (user: User) => string;
  close: () => Promise<void>;
};

export async function createTestContext(): Promise<TestContext> {
  const config = loadConfig({
    JWT_SECRET: TEST_SECRET,
    DATABASE_FILE: ':memory:',
    LOG_LEVEL: 'silent',
    APP_VERSION: 'test',
  } as NodeJS.ProcessEnv);

  const db = openDatabase(config.databaseFile);
  const app = await buildServer(db, config);

  const make = (name: string, email: string, role: Role): User =>
    createUser(db, { name, email, password: TEST_PASSWORD, role });

  const admin = make('Administração', 'admin@uni.edu', 'ADMIN');
  const professor = make('Prof. Ana Ribeiro', 'professor@uni.edu', 'PROFESSOR');
  const otherProfessor = make('Prof. Bruno Lima', 'bruno@uni.edu', 'PROFESSOR');

  const rooms = {
    'LAB-101': createRoom(db, { code: 'LAB-101', name: 'Laboratório 1', capacity: 30, building: 'Bloco A' }),
    'AUD-1': createRoom(db, { code: 'AUD-1', name: 'Auditório', capacity: 120, building: 'Bloco B' }),
    'SL-203': createRoom(db, { code: 'SL-203', name: 'Sala 203', capacity: 45, building: 'Bloco A' }),
  };

  return {
    app,
    db,
    config,
    admin,
    professor,
    otherProfessor,
    rooms,
    tokenFor: (user: User) => signToken(user, config.jwtSecret, config.jwtTtlSeconds),
    close: async () => {
      await app.close();
      db.close();
    },
  };
}

export function bearer(token: string): Record<string, string> {
  return { authorization: `Bearer ${token}` };
}

const campusDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/**
 * Instante ISO-UTC correspondente a `HH:MM` no fuso do campus, `daysAhead`
 * dias à frente. Mantém os testes dentro de BR-3 (não-passado), BR-4
 * (antecedência) e BR-5 (horário de funcionamento).
 */
export function campusSlot(daysAhead: number, time: string): string {
  const target = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000);
  const date = campusDateFormatter.format(target);
  return new Date(`${date}T${time}:00-03:00`).toISOString();
}

/** Dia civil UTC de um instante — usado nos filtros `date=` (FR-7, FR-9). */
export function utcDateOf(iso: string): string {
  return iso.slice(0, 10);
}
