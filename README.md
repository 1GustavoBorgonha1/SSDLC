# SalaFácil — Reserva de Salas Universitárias

Sistema de reserva de salas desenvolvido com **SDD (Spec-Driven Development)**:
as especificações em [`specs/`](specs/) são a fonte da verdade, e o código é
derivado delas — não o contrário.

Entrega da disciplina de SSDLC: aplicação + infraestrutura AWS + pipeline de
CI/CD + scanners de segurança no deploy.

---

## Sumário

| Onde | O quê |
|---|---|
| [`specs/`](specs/) | especificações: requisitos, domínio, contrato da API, regras, critérios de aceite |
| [`app/`](app/) | aplicação Node 22 + TypeScript + Fastify + SQLite, e os testes de aceite |
| [`infra/terraform/`](infra/terraform/) | EC2, Security Group, Elastic IP, disco criptografado |
| [`.github/workflows/ci-cd.yml`](.github/workflows/ci-cd.yml) | pipeline com os portões SEC-1..SEC-6 |
| [`docs/`](docs/) | processo SDD, runbook da AWS, configuração dos scanners |

## O que o sistema faz

- Professores autenticam-se e reservam salas em blocos de 30 minutos.
- **Duas reservas nunca se sobrepõem na mesma sala** — é a regra central
  ([BR-6](specs/003-business-rules.md)), garantida por transação no banco.
- Administradores cadastram e desativam salas e podem cancelar qualquer reserva.
- Consulta de disponibilidade por sala e por dia.

## Rodar localmente

```bash
cp .env.example .env
# gere o segredo: openssl rand -base64 48  → JWT_SECRET
# defina SEED_ADMIN_PASSWORD e SEED_PROFESSOR_PASSWORD

cd app
npm ci
npm run seed:dev          # carga inicial (3 salas, 2 usuários)
npm run dev               # http://localhost:3000
```

Ou com Docker:

```bash
docker compose up --build   # http://localhost
```

## Qualidade

```bash
cd app
npm run verify:traceability   # portão SDD: spec ↔ código ↔ teste
npm run lint
npm run typecheck
npm test                      # 47 testes, um por critério de aceite
npm run test:coverage         # gera app/coverage/lcov.info para o SonarQube
```

Estado atual: **47 testes passando, 98% de cobertura de linhas.**

## Arquitetura

```
Navegador ──► EC2 (Docker) ──► Fastify ──► SQLite (volume Docker)
                  │
                  └── GET /health  ◄── smoke test da pipeline
```

- **Node 22 + TypeScript + Fastify** — API JSON e página estática.
- **SQLite com WAL** — justificado em [ADR-001](specs/003-business-rules.md);
  a carga é de dezenas de usuários e o backup é copiar um arquivo.
- **Sem framework no frontend** — uma página, sem build step, DOM montado por
  `textContent` (NFR-S11).

## Segurança

Controles da aplicação (detalhe em [SPEC-004](specs/004-nonfunctional-security.md)):
bcrypt, JWT HS256 com segredo validado na inicialização, rate limit global e
específico no login, helmet com CSP restritiva, CORS de origem exata, prepared
statements em todo acesso ao banco, contêiner não-root e read-only.

Portões no deploy (detalhe em [docs/security-gates.md](docs/security-gates.md)):

| SEC-1 | SEC-2 | SEC-3 | SEC-4 | SEC-5 |
|---|---|---|---|---|
| SonarQube + Quality Gate | `npm audit` | Trivy na imagem | Gitleaks | Checkov na IaC |

Nenhuma imagem chega à AWS sem passar por todos eles.

## Deploy na AWS

Passo a passo completo: [docs/runbook-aws.md](docs/runbook-aws.md).

```bash
cd infra/terraform
cp terraform.tfvars.example terraform.tfvars   # chave pública + seu IP/32
terraform init && terraform apply
terraform output public_ip                      # → segredo EC2_HOST
```

Depois, com os segredos configurados no repositório, cada push na `main`
constrói a imagem, passa pelos scanners, publica no GHCR e faz o deploy via SSH
com smoke test e rollback automático.

## Como este projeto pratica SDD

Leia [docs/sdd-process.md](docs/sdd-process.md). Em resumo: toda mudança de
comportamento começa na spec, cada requisito tem identificador
(`FR-n`, `BR-n`, `NFR-n`, `AC-n`), e o CI falha se a
[matriz de rastreabilidade](specs/traceability.md) deixar de bater com o código.

## Licença e autoria

Trabalho acadêmico — disciplina de SSDLC.
