# SPEC-002 — Contrato da API

Base: `/api`. Formato: JSON UTF-8. Todos os horários em ISO-8601 UTC (`Z`).

## 1. Formato de erro (uniforme)

```json
{ "error": { "code": "ROOM_UNAVAILABLE", "message": "texto legível", "details": [] } }
```

| `code` | HTTP | Quando |
|---|---|---|
| `VALIDATION_ERROR` | 400 | corpo/query fora do schema (`details` traz os campos) |
| `UNAUTHORIZED` | 401 | token ausente, malformado ou expirado |
| `INVALID_CREDENTIALS` | 401 | e-mail/senha incorretos |
| `FORBIDDEN` | 403 | papel sem permissão para a operação |
| `NOT_FOUND` | 404 | recurso inexistente |
| `ROOM_INACTIVE` | 409 | sala desativada (BR-7) |
| `ROOM_UNAVAILABLE` | 409 | conflito de horário (BR-6) |
| `ALREADY_CANCELLED` | 409 | reserva já cancelada (INV-3) |
| `DUPLICATE_CODE` | 409 | `Room.code` já existe |
| `RATE_LIMITED` | 429 | limite de requisições excedido (NFR-S5) |
| `INTERNAL_ERROR` | 500 | falha inesperada; detalhes só no log |

## 2. Autenticação

`Authorization: Bearer <jwt>`. Claims: `sub` (userId), `role`, `iat`, `exp`
(TTL 8h). Assinatura HS256 com `JWT_SECRET`.

### `POST /api/auth/login` — público — FR-1

Request:
```json
{ "email": "professor@uni.edu", "password": "..." }
```
`200`:
```json
{ "token": "eyJ...", "user": { "id": "...", "name": "...", "email": "...", "role": "PROFESSOR" } }
```
`401 INVALID_CREDENTIALS` para e-mail inexistente **ou** senha errada (mesma
resposta e mesmo tempo aproximado — NFR-S4).

### `GET /api/auth/me` — autenticado

`200`: `{ "id": "...", "name": "...", "email": "...", "role": "..." }`

## 3. Salas

### `GET /api/rooms` — autenticado — FR-2

Query: `minCapacity` (int ≥ 1, opcional), `activeOnly` (`true`|`false`, default `true`).

`200`: `{ "data": [ Room, ... ] }` ordenado por `code` ascendente.

### `POST /api/rooms` — `ADMIN` — FR-3

```json
{ "code": "LAB-102", "name": "Laboratório 2", "capacity": 30, "building": "Bloco A" }
```
`201` → `Room`. `409 DUPLICATE_CODE` se o código já existir.

### `PATCH /api/rooms/:id/deactivate` — `ADMIN` — FR-4

`200` → `Room` com `active: false`. Idempotente. `404 NOT_FOUND` se não existir.
Reservas ativas já existentes **permanecem válidas** (BR-7).

## 4. Reservas

### `POST /api/reservations` — autenticado — FR-5, FR-6

```json
{ "roomId": "uuid", "purpose": "Aula de Cálculo I",
  "startsAt": "2026-10-01T13:00:00Z", "endsAt": "2026-10-01T15:00:00Z" }
```
`201` → `Reservation`. O `userId` vem **do token**, nunca do corpo (NFR-S2).

Erros: `400 VALIDATION_ERROR` (BR-1..BR-5), `404 NOT_FOUND` (sala inexistente),
`409 ROOM_INACTIVE` (BR-7), `409 ROOM_UNAVAILABLE` (BR-6).

### `GET /api/reservations` — autenticado — FR-7

Query: `roomId` (uuid, opcional), `date` (`YYYY-MM-DD`, opcional),
`mine` (`true`|`false`, default `false`), `status` (`ACTIVE`|`CANCELLED`|`ALL`, default `ACTIVE`).

- `PROFESSOR` sem `mine=true` enxerga todas as reservas **sem** o campo `purpose`
  de terceiros? **Não** — v1 mantém a agenda institucional pública entre usuários
  autenticados: todos os campos são visíveis. Decisão registrada em ADR-002.
- `200`: `{ "data": [ Reservation & { room: {code,name}, user: {name} }, ... ] }`
  ordenado por `startsAt` ascendente.

### `PATCH /api/reservations/:id/cancel` — autenticado — FR-8

Permitido ao dono da reserva ou a `ADMIN`, caso contrário `403 FORBIDDEN`.
`200` → `Reservation` com `status: "CANCELLED"`.
`409 ALREADY_CANCELLED` se já estiver cancelada.

### `GET /api/rooms/:id/availability?date=YYYY-MM-DD` — autenticado — FR-9

`200`:
```json
{ "roomId": "uuid", "date": "2026-10-01",
  "busy": [ { "startsAt": "...", "endsAt": "...", "reservationId": "..." } ] }
```
Cobre o dia em UTC, `[00:00Z, 24:00Z)`.

## 5. Operacional

### `GET /health` — público — FR-10

`200`: `{ "status": "ok", "version": "<git sha>", "uptimeSeconds": 42 }`.
Devolve `503` com `{"status":"degraded"}` se a query de sanidade no banco falhar.

## 6. Frontend

Página única estática servida em `GET /` (`app/public/index.html`) que consome
esta API: login, lista de salas, criação/cancelamento de reserva e visão de
disponibilidade do dia. Sem framework, sem build step.
