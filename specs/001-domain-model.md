# SPEC-001 — Modelo de Domínio

Fonte da verdade para o schema do banco e para os tipos em `app/src/domain/`.

## 1. Entidades

### 1.1 `User`

| Campo | Tipo | Restrições |
|---|---|---|
| `id` | `string` (uuid v4) | PK |
| `name` | `string` | 1..120 caracteres |
| `email` | `string` | único, minúsculo, formato e-mail, até 160 caracteres |
| `passwordHash` | `string` | bcrypt, custo 10; **nunca** serializado em resposta |
| `role` | `'PROFESSOR' \| 'ADMIN'` | — |
| `createdAt` | ISO-8601 UTC | — |

### 1.2 `Room`

| Campo | Tipo | Restrições |
|---|---|---|
| `id` | `string` (uuid v4) | PK |
| `code` | `string` | único, `^[A-Z]{1,4}-[0-9]{1,4}$` (ex.: `LAB-101`) |
| `name` | `string` | 1..120 caracteres |
| `capacity` | `integer` | 1..500 |
| `building` | `string` | 1..80 caracteres |
| `active` | `boolean` | default `true` |
| `createdAt` | ISO-8601 UTC | — |

### 1.3 `Reservation`

| Campo | Tipo | Restrições |
|---|---|---|
| `id` | `string` (uuid v4) | PK |
| `roomId` | `string` | FK → `Room.id` |
| `userId` | `string` | FK → `User.id` |
| `purpose` | `string` | 3..200 caracteres |
| `startsAt` | ISO-8601 UTC | ver BR-1..BR-5 |
| `endsAt` | ISO-8601 UTC | `endsAt > startsAt` |
| `status` | `'ACTIVE' \| 'CANCELLED'` | default `ACTIVE` |
| `createdAt` | ISO-8601 UTC | — |

## 2. Invariantes

- **INV-1** — Para uma mesma `roomId`, o conjunto de reservas com `status = 'ACTIVE'`
  tem intervalos `[startsAt, endsAt)` **dois a dois disjuntos**.
- **INV-2** — `Reservation.roomId` sempre referencia uma `Room` existente.
- **INV-3** — Uma reserva cancelada nunca volta para `ACTIVE` (transição única).
- **INV-4** — `User.passwordHash` nunca cruza a fronteira HTTP.

## 3. Schema relacional (SQLite)

```sql
CREATE TABLE users (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('PROFESSOR','ADMIN')),
  created_at    TEXT NOT NULL
);

CREATE TABLE rooms (
  id         TEXT PRIMARY KEY,
  code       TEXT NOT NULL UNIQUE,
  name       TEXT NOT NULL,
  capacity   INTEGER NOT NULL CHECK (capacity BETWEEN 1 AND 500),
  building   TEXT NOT NULL,
  active     INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  created_at TEXT NOT NULL
);

CREATE TABLE reservations (
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

CREATE INDEX idx_reservations_room_window
  ON reservations (room_id, status, starts_at, ends_at);
```

> INV-1 não é expressável como constraint em SQLite; é garantida na camada de
> domínio dentro de uma transação `BEGIN IMMEDIATE` (ver BR-6).

## 4. Dados de seed (ambiente de demonstração)

| E-mail | Senha | Papel |
|---|---|---|
| `admin@uni.edu` | valor de `SEED_ADMIN_PASSWORD` | `ADMIN` |
| `professor@uni.edu` | valor de `SEED_PROFESSOR_PASSWORD` | `PROFESSOR` |

Salas de seed: `LAB-101` (30 lugares, Bloco A), `AUD-1` (120, Bloco B),
`SL-203` (45, Bloco A).

O seed é **idempotente** e recusa-se a rodar sem as variáveis de senha definidas
(ver NFR-S3).
