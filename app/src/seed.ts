/**
 * Carga inicial idempotente — SPEC-001 §4.
 * NFR-S3: nenhuma senha embutida; as variáveis são obrigatórias.
 */
import { pathToFileURL } from 'node:url';
import { loadConfig } from './config.ts';
import { openDatabase, type Db } from './infra/db.ts';
import { createUser, findUserByEmail } from './domain/users.ts';
import { createRoom, findRoomByCode } from './domain/rooms.ts';
import type { Role } from './domain/types.ts';

const ROOMS = [
  { code: 'LAB-101', name: 'Laboratório de Informática 1', capacity: 30, building: 'Bloco A' },
  { code: 'AUD-1', name: 'Auditório Central', capacity: 120, building: 'Bloco B' },
  { code: 'SL-203', name: 'Sala 203', capacity: 45, building: 'Bloco A' },
];

function requiredPassword(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.length < 8) {
    throw new Error(`${name} é obrigatório e precisa ter ao menos 8 caracteres.`);
  }
  return value;
}

export function seed(db: Db, passwords: { admin: string; professor: string }): void {
  const users: { name: string; email: string; password: string; role: Role }[] = [
    { name: 'Administração Acadêmica', email: 'admin@uni.edu', password: passwords.admin, role: 'ADMIN' },
    { name: 'Prof. Ana Ribeiro', email: 'professor@uni.edu', password: passwords.professor, role: 'PROFESSOR' },
  ];

  for (const user of users) {
    if (findUserByEmail(db, user.email) === null) {
      createUser(db, user);
    }
  }
  for (const room of ROOMS) {
    if (findRoomByCode(db, room.code) === null) {
      createRoom(db, room);
    }
  }
}

const isEntrypoint =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isEntrypoint) {
  const config = loadConfig();
  const db = openDatabase(config.databaseFile);
  seed(db, {
    admin: requiredPassword('SEED_ADMIN_PASSWORD'),
    professor: requiredPassword('SEED_PROFESSOR_PASSWORD'),
  });
  db.close();
  console.log('seed concluído');
}
