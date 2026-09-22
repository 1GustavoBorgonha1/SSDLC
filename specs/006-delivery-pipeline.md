# SPEC-006 — Entrega, Infraestrutura e Pipeline

## 1. Topologia alvo (AWS)

```
Internet
   │  :80/tcp                      :22/tcp (CIDR restrito)
   ▼                                   ▲
┌──────────────────── EC2 t3.micro (Amazon Linux 2023) ───────────────────┐
│  Docker Engine + Docker Compose                                          │
│                                                                          │
│   ┌── caddy/nginx? não (v1) ──┐   ┌──────── salafacil (app) ─────────┐    │
│   │  porta 80 publicada       │──▶│ Node 22 · Fastify · porta 3000   │    │
│   └───────────────────────────┘   │ usuário não-root, read_only      │    │
│                                   └───────────┬──────────────────────┘    │
│                                    volume docker `salafacil-data`         │
│                                        /data/salafacil.db (SQLite, WAL)   │
└──────────────────────────────────────────────────────────────────────────┘
```

Recursos Terraform (`infra/terraform/`): VPC default, Security Group,
Key Pair, Elastic IP, instância EC2 com `user_data` que instala Docker,
cria `/opt/salafacil` e habilita o serviço. Root EBS `gp3` criptografado,
IMDSv2 obrigatório (INF-S1..S4).

## 2. Pipeline (GitHub Actions — `.github/workflows/ci-cd.yml`)

```
push/PR
  │
  ├─ job: quality ──────────────────────────────────────────────┐
  │    lint → typecheck → test + cobertura lcov → npm audit      │
  │    → Gitleaks (SEC-4) → SonarQube scan (SEC-1)               │
  │    → wait for Quality Gate (falha o build se vermelho)       │
  │                                                              │
  ├─ job: iac-scan ── Checkov em infra/terraform (SEC-5) ────────┤
  │                                                              │
  ├─ job: build (precisa de quality + iac-scan) ─────────────────┤
  │    docker build → Trivy image scan (SEC-3, CRITICAL/HIGH)    │
  │    → push para GHCR com tags `sha-<sha>` e `latest`          │
  │                                                              │
  └─ job: deploy (só em `main`, ambiente `production`) ──────────┘
       SSH na EC2 → docker compose pull → up -d → smoke test /health
       → rollback para a tag anterior se o smoke test falhar
```

Segredos necessários no repositório:

| Segredo | Uso |
|---|---|
| `SONAR_TOKEN` | autenticação no SonarQube/SonarCloud |
| `SONAR_HOST_URL` | URL do SonarQube (omitir para SonarCloud) |
| `EC2_HOST` | IP elástico da instância |
| `EC2_SSH_KEY` | chave privada do deploy |
| `APP_JWT_SECRET` | `JWT_SECRET` do ambiente de produção |
| `SEED_ADMIN_PASSWORD`, `SEED_PROFESSOR_PASSWORD` | carga inicial |

`GITHUB_TOKEN` (automático) publica no GHCR.

## 3. Estratégia de deploy

Imagem imutável identificada por `sha-<commit>`; a EC2 nunca compila código.
`docker compose up -d` recria o contêiner (downtime ≈ 5 s, NFR-6).
Rollback = redeploy da tag anterior, que continua no GHCR.

## 4. Ambientes

| Ambiente | Onde | Banco | Segredos |
|---|---|---|---|
| local | `docker compose up` ou `npm run dev` | `./data/salafacil.db` | `.env` a partir de `.env.example` |
| ci | runner efêmero | `:memory:` | gerados no job |
| production | EC2 | volume `salafacil-data` | segredos do GitHub |

## 5. Definition of Done

Uma mudança está pronta quando: a spec correspondente foi atualizada, existe
teste para cada `AC` afetado, a matriz de rastreabilidade está consistente
(`npm run verify:traceability`), o pipeline está verde incluindo os portões
SEC-1..SEC-5, e `GET /health` na EC2 responde a nova versão.
