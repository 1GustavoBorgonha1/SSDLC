# SPEC-000 — Visão Geral do Produto

| Campo | Valor |
|---|---|
| Sistema | **SalaFácil** — Reserva de Salas Universitárias |
| Versão da spec | 1.0.0 |
| Status | Aprovada |
| Metodologia | Spec-Driven Development (SDD) |

## 1. Propósito

Permitir que docentes de uma universidade reservem salas de aula para horários
específicos, com garantia de que **duas reservas nunca se sobreponham na mesma
sala**, e que a administração mantenha o catálogo de salas.

## 2. Contrato SDD

Estas especificações são a **fonte da verdade**. Regras:

1. Nenhuma mudança de comportamento entra no código sem antes mudar a spec.
2. Todo endpoint, regra e erro do código tem um identificador rastreável
   (`FR-x`, `BR-x`, `NFR-x`) definido aqui e citado em comentário no código.
3. Todo critério de aceite (SPEC-005) tem teste automatizado correspondente.
4. A matriz de rastreabilidade (`specs/traceability.md`) é validada no CI.

## 3. Atores

| Ator | Descrição | Permissões |
|---|---|---|
| `PROFESSOR` | Docente autenticado | Criar/listar/cancelar **as próprias** reservas; consultar salas e disponibilidade |
| `ADMIN` | Equipe administrativa | Tudo do professor + CRUD de salas + cancelar qualquer reserva + listar todas as reservas |
| Anônimo | Visitante | Apenas `POST /api/auth/login` e `GET /health` |

## 4. Requisitos Funcionais

| ID | Requisito | Prioridade |
|---|---|---|
| FR-1 | Autenticar usuário por e-mail e senha, devolvendo token JWT | Obrigatório |
| FR-2 | Listar salas cadastradas, com filtro opcional por capacidade mínima | Obrigatório |
| FR-3 | Criar sala (somente `ADMIN`) | Obrigatório |
| FR-4 | Desativar sala (somente `ADMIN`); sala desativada não aceita novas reservas | Obrigatório |
| FR-5 | Criar reserva de uma sala em um intervalo `[início, fim)` | Obrigatório |
| FR-6 | Rejeitar reserva que conflite com reserva ativa existente na mesma sala | Obrigatório |
| FR-7 | Listar reservas com filtro por sala e por dia | Obrigatório |
| FR-8 | Cancelar reserva (dono da reserva ou `ADMIN`) | Obrigatório |
| FR-9 | Consultar disponibilidade de uma sala em um dia (blocos ocupados) | Obrigatório |
| FR-10 | Expor `GET /health` para readiness check do balanceador/pipeline | Obrigatório |

## 5. Fora de Escopo (v1)

- Fluxo de aprovação de reserva por administrador.
- Reservas recorrentes (semanais).
- Notificações por e-mail.
- Autocadastro de usuários (a carga inicial é feita por seed).

## 6. Documentos relacionados

- [SPEC-001 — Modelo de Domínio](001-domain-model.md)
- [SPEC-002 — Contrato da API](002-api-contract.md)
- [SPEC-003 — Regras de Negócio](003-business-rules.md)
- [SPEC-004 — Requisitos Não-Funcionais e Segurança](004-nonfunctional-security.md)
- [SPEC-005 — Critérios de Aceite](005-acceptance-criteria.md)
- [SPEC-006 — Entrega, Infraestrutura e Pipeline](006-delivery-pipeline.md)
- [Matriz de Rastreabilidade](traceability.md)
