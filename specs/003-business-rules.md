# SPEC-003 — Regras de Negócio

Cada regra tem um identificador `BR-n` citado no código-fonte e coberta por teste
(ver [SPEC-005](005-acceptance-criteria.md)).

## BR-1 — Intervalo válido
`endsAt` deve ser estritamente maior que `startsAt`. Caso contrário
`400 VALIDATION_ERROR`.

## BR-2 — Duração mínima e máxima
A reserva dura no mínimo **30 minutos** e no máximo **4 horas** (240 min).
Fora disso: `400 VALIDATION_ERROR`.

## BR-3 — Não reservar no passado
`startsAt` deve ser maior ou igual ao instante atual menos uma tolerância de
**5 minutos** (compensa relógio do cliente). Caso contrário `400`.

## BR-4 — Janela de antecedência
`startsAt` não pode estar a mais de **90 dias** no futuro. Caso contrário `400`.

## BR-5 — Horário de funcionamento
A reserva deve estar inteiramente contida em `[07:00, 22:00)` no fuso
`America/Sao_Paulo`, e começar e terminar em múltiplos de 30 minutos
(`:00` ou `:30`, com segundos e milissegundos zerados). Caso contrário `400`.

## BR-6 — Exclusão mútua de horário (regra central)
Uma nova reserva é rejeitada com `409 ROOM_UNAVAILABLE` se existir reserva
`ACTIVE` na mesma sala tal que:

```
existente.startsAt < nova.endsAt  AND  nova.startsAt < existente.endsAt
```

Intervalos são **semiabertos** `[início, fim)`: encostar não é conflitar —
`10:00–11:00` e `11:00–12:00` coexistem.

A verificação e a inserção ocorrem na **mesma transação** `BEGIN IMMEDIATE`,
para que duas requisições simultâneas não possam ambas passar no teste (INV-1).

## BR-7 — Salas desativadas
Sala com `active = false` recusa **novas** reservas (`409 ROOM_INACTIVE`).
Reservas já confirmadas continuam válidas e visíveis; cancelá-las é decisão
manual do `ADMIN`.

## BR-8 — Autoria da reserva
O dono é sempre o usuário do token. Um `userId` enviado no corpo é ignorado
(não é erro, é descartado na validação — `strip`).

## BR-9 — Cancelamento
Somente o dono ou um `ADMIN` cancela. Cancelar libera imediatamente a janela
para novas reservas. Recancelar devolve `409 ALREADY_CANCELLED`.

## BR-10 — Limite por usuário
Um usuário pode ter no máximo **10 reservas ativas com `startsAt` no futuro**.
Ao exceder: `409` com código `QUOTA_EXCEEDED`.

## Decisões de arquitetura

- **ADR-001** — SQLite com WAL em volume Docker. Justificativa: carga acadêmica
  (< 50 usuários), backup = copiar um arquivo, zero custo de RDS na AWS.
  Migração para Postgres é trocar `app/src/infra/db.ts` (interface `Database`).
- **ADR-002** — Agenda institucional visível a qualquer usuário autenticado:
  a finalidade de uma aula não é dado sensível e a transparência evita conflitos
  de alocação.
- **ADR-003** — Horário de funcionamento fixo em `America/Sao_Paulo` via
  `Intl.DateTimeFormat`, sem depender do TZ do host (o contêiner roda em UTC).
