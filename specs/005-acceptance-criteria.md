# SPEC-005 — Critérios de Aceite

Formato Gherkin. Cada `AC-n` tem um teste automatizado em `app/tests/`
cujo nome começa com o identificador, de modo que
`npm test -- --test-name-pattern AC-6` executa o critério isolado.

---

**AC-1 (FR-1, NFR-S4)** — Login válido
> **Dado** o usuário `professor@uni.edu` cadastrado
> **Quando** envio `POST /api/auth/login` com a senha correta
> **Então** recebo `200`, um `token` JWT e o objeto `user` **sem** `passwordHash`

**AC-2 (FR-1, NFR-S4)** — Login inválido não distingue causa
> **Quando** envio senha errada **ou** e-mail inexistente
> **Então** recebo `401` com `code = INVALID_CREDENTIALS` em ambos os casos,
> com corpos idênticos

**AC-3 (NFR-S1, INV-4)** — Nenhuma resposta contém hash
> **Quando** chamo qualquer endpoint de usuário
> **Então** a serialização não contém as chaves `passwordHash` nem `password_hash`

**AC-4 (FR-2)** — Listar salas com filtro
> **Dado** salas de 30, 45 e 120 lugares
> **Quando** chamo `GET /api/rooms?minCapacity=40`
> **Então** recebo 2 salas, ordenadas por `code`

**AC-5 (FR-3, FR-4)** — Só admin administra salas
> **Quando** um `PROFESSOR` chama `POST /api/rooms` ou `PATCH /api/rooms/:id/deactivate`
> **Então** recebo `403 FORBIDDEN` e nada é criado/alterado

**AC-6 (FR-5, FR-6, BR-6)** — Conflito de horário é rejeitado
> **Dado** reserva ativa da sala `LAB-101` das 13:00 às 15:00
> **Quando** peço 14:00–16:00 na mesma sala
> **Então** recebo `409 ROOM_UNAVAILABLE` e nenhuma reserva é criada

**AC-7 (BR-6)** — Intervalos encostados coexistem
> **Dado** reserva ativa 13:00–15:00
> **Quando** peço 15:00–16:00 na mesma sala
> **Então** recebo `201`

**AC-8 (BR-6)** — Conflito é por sala
> **Dado** reserva ativa 13:00–15:00 em `LAB-101`
> **Quando** peço 13:00–15:00 em `AUD-1`
> **Então** recebo `201`

**AC-9 (BR-9)** — Cancelar libera a janela
> **Dado** reserva ativa 13:00–15:00, depois cancelada
> **Quando** peço 13:00–15:00 novamente
> **Então** recebo `201`

**AC-10 (BR-1..BR-5)** — Validações de intervalo
> **Quando** peço fim antes do início, duração de 15 min, duração de 5 h,
> início no passado, início daqui a 120 dias, início às 06:00 ou fim às 23:00,
> ou início às 13:07
> **Então** recebo `400 VALIDATION_ERROR` em cada caso

**AC-11 (BR-7)** — Sala desativada recusa reserva
> **Dado** `LAB-101` desativada por um `ADMIN`
> **Quando** um professor tenta reservá-la
> **Então** recebo `409 ROOM_INACTIVE`, e as reservas anteriores continuam `ACTIVE`

**AC-12 (BR-8, NFR-S2)** — `userId` do corpo é ignorado
> **Quando** o professor A cria reserva enviando `userId` do professor B
> **Então** a reserva criada pertence a A

**AC-13 (BR-9)** — Cancelamento por terceiro é proibido
> **Quando** o professor B cancela a reserva do professor A
> **Então** recebo `403 FORBIDDEN`; o mesmo pedido feito por `ADMIN` devolve `200`

**AC-14 (INV-3)** — Recancelar é conflito
> **Quando** cancelo duas vezes a mesma reserva
> **Então** a segunda chamada devolve `409 ALREADY_CANCELLED`

**AC-15 (FR-7)** — Filtro por sala e por dia
> **Quando** chamo `GET /api/reservations?roomId=X&date=YYYY-MM-DD`
> **Então** recebo apenas as reservas ativas daquela sala que tocam aquele dia,
> ordenadas por `startsAt`

**AC-16 (FR-9)** — Disponibilidade do dia
> **Quando** chamo `GET /api/rooms/:id/availability?date=...`
> **Então** recebo os blocos `busy` daquele dia, sem os cancelados

**AC-17 (FR-10)** — Health check
> **Quando** chamo `GET /health` sem token
> **Então** recebo `200` com `status: "ok"`

**AC-18 (NFR-S3)** — Segredo fraco impede a inicialização
> **Quando** o processo inicia com `JWT_SECRET` curto ou igual ao exemplo
> **Então** a construção do servidor lança erro e o processo não atende requisições

**AC-19 (BR-10)** — Cota por usuário
> **Dado** um usuário com 10 reservas futuras ativas
> **Quando** ele cria a 11ª
> **Então** recebo `409 QUOTA_EXCEEDED`

**AC-20 (SPEC-002 §1, NFR-S10)** — Token inválido
> **Quando** chamo endpoint protegido sem token ou com token adulterado
> **Então** recebo `401 UNAUTHORIZED`, sem stack trace no corpo

**AC-21 (BR-6, INV-1)** — Concorrência
> **Quando** duas requisições idênticas de reserva competem pela mesma janela
> **Então** exatamente uma recebe `201` e a outra `409 ROOM_UNAVAILABLE`
