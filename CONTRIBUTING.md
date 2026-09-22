# Como contribuir (fluxo SDD)

1. **Abra a spec antes do editor.** Identifique o `FR`/`BR`/`NFR` afetado em
   [`specs/`](specs/). Se não existir, escreva-o primeiro.
2. **Branch** a partir da `main`: `feat/BR-11-reserva-recorrente`.
3. **Escreva o critério de aceite** em `specs/005-acceptance-criteria.md` e o
   teste correspondente em `app/tests/`. O teste deve falhar.
4. **Implemente**, citando o identificador no código (`// BR-11`).
5. **Atualize** `specs/traceability.md`.
6. **Rode os portões locais** antes de abrir o PR:
   ```bash
   cd app && npm run verify:traceability && npm run lint && npm run typecheck && npm run test:coverage
   ```
7. **Abra o PR** descrevendo qual spec mudou e por quê. A pipeline roda
   SEC-1..SEC-5; um portão vermelho bloqueia o merge.

## Checklist de revisão

- [ ] A spec foi atualizada antes do código?
- [ ] Cada novo comportamento tem um `AC-n` e um teste?
- [ ] Nenhum segredo, senha ou chave no diff?
- [ ] Todo SQL novo usa parâmetros (`?`), sem interpolação (NFR-S6)?
- [ ] Nenhum dado sensível novo em log ou em resposta HTTP?
- [ ] A matriz de rastreabilidade continua verde?

## Convenção de commits

`<tipo>(<spec>): <resumo>` — por exemplo `feat(BR-11): reserva recorrente semanal`,
`fix(BR-6): trata intervalo que cruza a meia-noite`, `docs(SPEC-004): ...`.
