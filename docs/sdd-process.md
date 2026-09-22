# Como este projeto pratica SDD

**Spec-Driven Development**: a especificação estruturada é a fonte da verdade e
o código é derivado dela — não o contrário.

## O ciclo que seguimos

```
1. ESCREVER A SPEC      specs/00x-*.md
   Requisito (FR), regra (BR), contrato de API, invariante e critério de aceite,
   cada um com um identificador estável.
        │
2. DERIVAR OS TESTES    app/tests/*.test.ts
   Cada AC de SPEC-005 vira um teste cujo nome começa pelo identificador.
   Os testes são escritos antes da implementação e falham.
        │
3. GERAR O CÓDIGO       app/src/**
   A implementação é produzida a partir da spec (com auxílio de IA), e cada
   trecho não óbvio cita a regra que o originou (ex.: `// BR-7`).
        │
4. VERIFICAR            npm run verify:traceability && npm test
   O portão de rastreabilidade falha se a matriz citar um arquivo que não
   menciona o identificador. Spec e código não podem divergir em silêncio.
        │
5. ENTREGAR             pipeline com portões de segurança (SPEC-004 §3)
```

## Regra de ouro

> Mudança de comportamento começa na spec. Se o código precisa mudar,
> a pergunta é "qual `FR`/`BR` mudou?". Se a resposta for "nenhum", ou é
> refatoração (comportamento idêntico, testes intactos), ou falta uma spec.

## Por que isso importa aqui

- **Prompts reprodutíveis.** As specs são o contexto entregue ao assistente de
  IA. Regerar um módulo a partir da spec produz código equivalente.
- **Revisão barata.** Revisar o diff de uma spec de 2 páginas é mais rápido e
  mais confiável do que revisar 800 linhas geradas.
- **Rastreabilidade auditável.** De um requisito é possível chegar à linha de
  código e ao teste que o prova — exigência clássica de um SSDLC.

## Mapa dos artefatos

| Artefato | Papel |
|---|---|
| `specs/000-overview.md` | escopo, atores, requisitos funcionais |
| `specs/001-domain-model.md` | entidades, invariantes, schema |
| `specs/002-api-contract.md` | contrato HTTP e catálogo de erros |
| `specs/003-business-rules.md` | regras BR-1..BR-10 e ADRs |
| `specs/004-nonfunctional-security.md` | NFR, controles de segurança, portões |
| `specs/005-acceptance-criteria.md` | critérios AC-1..AC-21 em Gherkin |
| `specs/006-delivery-pipeline.md` | topologia AWS, pipeline, DoD |
| `specs/traceability.md` | matriz spec → código → teste (validada no CI) |

## O que fazer ao pegar um bug

1. Reproduza-o como um novo `AC-n` em `specs/005-acceptance-criteria.md`.
2. Escreva o teste correspondente; ele deve falhar.
3. Corrija o código (ou a regra `BR`, se a regra é que estava errada).
4. Atualize `specs/traceability.md` e rode `npm run verify:traceability`.
