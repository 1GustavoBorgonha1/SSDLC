/**
 * Camada de persistência — SPEC-001 §3 (schema) e ADR-001 (SQLite/WAL).
 *
 * NFR-S6: todo acesso usa prepared statements com parâmetros posicionais.
 * Interpolação de valores em SQL é proibida neste arquivo.
 */
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export type Db = DatabaseSync;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('PROFESSOR','ADMIN')),
  created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS rooms (
  id         TEXT PRIMARY KEY,
  code       TEXT NOT NULL UNIQUE,
  name       TEXT NOT NULL,
  capacity   INTEGER NOT NULL CHECK (capacity BETWEEN 1 AND 500),
  building   TEXT NOT NULL,
  active     INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reservations (
  id         TEXT PRIMARY KEY,
  room_id    TEXT NOT NULL REFERENCES rooms(id),
  user_id    TEXT NOT NULL REFERENCES users(id),
  purpose    TEXT NOT NULL,
  starts_at  TEXT NOT NULL,
  ends_at    TEXT NOT NULL,
  status     TEXT NOT NULL CHECK (status IN ('ACTIVE','CANCELLED')),
  created_at TEXT NOT NULL,
  CHECK (ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS idx_reservations_room_window
  ON reservations (room_id, status, starts_at, ends_at);
`;

export function openDatabase(file: string): Db {
  if (file !== ':memory:') {
    mkdirSync(dirname(file), { recursive: true });
  }
  const db = new DatabaseSync(file);
  db.exec('PRAGMA foreign_keys = ON;');
  if (file !== ':memory:') {
    db.exec('PRAGMA journal_mode = WAL;');
  }
  db.exec(SCHEMA);
  return db;
}

/**
 * Executa `fn` dentro de uma transação de escrita imediata.
 * BR-6/INV-1 dependem disto: a checagem de conflito e a inserção precisam ser
 * atômicas para que duas requisições concorrentes não passem ambas no teste.
 */
export function inWriteTransaction<T>(db: Db, fn: () => T): T {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

/** Query de sanidade usada pelo /health (FR-10). */
export function isHealthy(db: Db): boolean {
  try {
    const row = db.prepare('SELECT 1 AS ok').get() as { ok: number } | undefined;
    return row?.ok === 1;
  } catch {
    return false;
  }
}
