/**
 * Usuários e autenticação — FR-1.
 * NFR-S1: senha só existe como hash bcrypt.
 * NFR-S4: login não revela se o e-mail existe.
 * INV-4 / AC-3: `toPublicUser` é a única porta de saída de um usuário.
 */
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import type { Db } from '../infra/db.ts';
import type { PublicUser, Role, User } from './types.ts';

export const BCRYPT_COST = 10;

/**
 * Hash descartável usado quando o e-mail não existe, para que o tempo de
 * resposta do login não denuncie a ausência da conta (NFR-S4).
 */
const DUMMY_HASH = bcrypt.hashSync('conta-inexistente', BCRYPT_COST);

type UserRow = {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  role: Role;
  created_at: string;
};

function mapUser(row: UserRow): User {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    passwordHash: row.password_hash,
    role: row.role,
    createdAt: row.created_at,
  };
}

/** INV-4: remove o hash antes de qualquer serialização. */
export function toPublicUser(user: User): PublicUser {
  return { id: user.id, name: user.name, email: user.email, role: user.role, createdAt: user.createdAt };
}

export function findUserByEmail(db: Db, email: string): User | null {
  const row = db
    .prepare('SELECT id, name, email, password_hash, role, created_at FROM users WHERE email = ?')
    .get(email.trim().toLowerCase()) as UserRow | undefined;
  return row ? mapUser(row) : null;
}

export function findUserById(db: Db, id: string): User | null {
  const row = db
    .prepare('SELECT id, name, email, password_hash, role, created_at FROM users WHERE id = ?')
    .get(id) as UserRow | undefined;
  return row ? mapUser(row) : null;
}

export function createUser(
  db: Db,
  input: { name: string; email: string; password: string; role: Role },
): User {
  const user: User = {
    id: randomUUID(),
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    passwordHash: bcrypt.hashSync(input.password, BCRYPT_COST),
    role: input.role,
    createdAt: new Date().toISOString(),
  };
  db.prepare(
    'INSERT INTO users (id, name, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(user.id, user.name, user.email, user.passwordHash, user.role, user.createdAt);
  return user;
}

/**
 * FR-1 / NFR-S4 — devolve o usuário apenas quando e-mail e senha conferem.
 * A comparação bcrypt é sempre executada, mesmo sem usuário correspondente.
 */
export function authenticate(db: Db, email: string, password: string): User | null {
  const user = findUserByEmail(db, email);
  const hash = user?.passwordHash ?? DUMMY_HASH;
  const matches = bcrypt.compareSync(password, hash);
  return user !== null && matches ? user : null;
}
