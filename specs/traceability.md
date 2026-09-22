# Matriz de Rastreabilidade

Spec → implementação → teste. Validada no CI por `npm run verify:traceability`,
que confere que cada identificador desta tabela aparece no arquivo de código e
no arquivo de teste indicados.

| ID | Spec | Implementação | Teste |
|---|---|---|---|
| FR-1 | 002 §2 | `app/src/http/routes/auth.ts` | `app/tests/auth.test.ts` |
| FR-2 | 002 §3 | `app/src/http/routes/rooms.ts` | `app/tests/rooms.test.ts` |
| FR-3 | 002 §3 | `app/src/http/routes/rooms.ts` | `app/tests/rooms.test.ts` |
| FR-4 | 002 §3 | `app/src/http/routes/rooms.ts` | `app/tests/rooms.test.ts` |
| FR-5 | 002 §4 | `app/src/domain/reservations.ts` | `app/tests/reservations.test.ts` |
| FR-6 | 002 §4 | `app/src/domain/reservations.ts` | `app/tests/reservations.test.ts` |
| FR-7 | 002 §4 | `app/src/domain/reservations.ts` | `app/tests/reservations.test.ts` |
| FR-8 | 002 §4 | `app/src/domain/reservations.ts` | `app/tests/reservations.test.ts` |
| FR-9 | 002 §4 | `app/src/domain/reservations.ts` | `app/tests/reservations.test.ts` |
| FR-10 | 002 §5 | `app/src/http/server.ts` | `app/tests/health.test.ts` |
| BR-1 | 003 | `app/src/domain/schedule.ts` | `app/tests/schedule.test.ts` |
| BR-2 | 003 | `app/src/domain/schedule.ts` | `app/tests/schedule.test.ts` |
| BR-3 | 003 | `app/src/domain/schedule.ts` | `app/tests/schedule.test.ts` |
| BR-4 | 003 | `app/src/domain/schedule.ts` | `app/tests/schedule.test.ts` |
| BR-5 | 003 | `app/src/domain/schedule.ts` | `app/tests/schedule.test.ts` |
| BR-6 | 003 | `app/src/domain/reservations.ts` | `app/tests/reservations.test.ts` |
| BR-7 | 003 | `app/src/domain/reservations.ts` | `app/tests/reservations.test.ts` |
| BR-8 | 003 | `app/src/http/routes/reservations.ts` | `app/tests/reservations.test.ts` |
| BR-9 | 003 | `app/src/domain/reservations.ts` | `app/tests/reservations.test.ts` |
| BR-10 | 003 | `app/src/domain/reservations.ts` | `app/tests/reservations.test.ts` |
| INV-1 | 001 §2 | `app/src/domain/reservations.ts` | `app/tests/concurrency.test.ts` |
| INV-3 | 001 §2 | `app/src/domain/reservations.ts` | `app/tests/reservations.test.ts` |
| INV-4 | 001 §2 | `app/src/domain/users.ts` | `app/tests/auth.test.ts` |
| NFR-S1 | 004 §2 | `app/src/domain/users.ts` | `app/tests/auth.test.ts` |
| NFR-S2 | 004 §2 | `app/src/http/routes/reservations.ts` | `app/tests/reservations.test.ts` |
| NFR-S3 | 004 §2 | `app/src/config.ts` | `app/tests/config.test.ts` |
| NFR-S4 | 004 §2 | `app/src/domain/users.ts` | `app/tests/auth.test.ts` |
| NFR-S5 | 004 §2 | `app/src/http/server.ts` | `app/tests/health.test.ts` |
| NFR-S6 | 004 §2 | `app/src/infra/db.ts` | `app/tests/rooms.test.ts` |
| NFR-S7 | 004 §2 | `app/src/http/server.ts` | `app/tests/health.test.ts` |
| NFR-S10 | 004 §2 | `app/src/http/errors.ts` | `app/tests/auth.test.ts` |
| AC-1..AC-3 | 005 | — | `app/tests/auth.test.ts` |
| AC-4, AC-5 | 005 | — | `app/tests/rooms.test.ts` |
| AC-6..AC-9, AC-11..AC-16, AC-19 | 005 | — | `app/tests/reservations.test.ts` |
| AC-10 | 005 | — | `app/tests/schedule.test.ts` |
| AC-17 | 005 | — | `app/tests/health.test.ts` |
| AC-18 | 005 | — | `app/tests/config.test.ts` |
| AC-20 | 005 | — | `app/tests/auth.test.ts` |
| AC-21 | 005 | — | `app/tests/concurrency.test.ts` |
| SEC-1..SEC-6 | 004 §3 | `.github/workflows/ci-cd.yml` | pipeline |
| INF-S1..INF-S4 | 004 §4 | `infra/terraform/main.tf` | Checkov |
| INF-S5 | 004 §4 | `.github/workflows/ci-cd.yml` | pipeline |
| INF-S6 | 004 §4 | `infra/terraform/versions.tf` | Checkov |
